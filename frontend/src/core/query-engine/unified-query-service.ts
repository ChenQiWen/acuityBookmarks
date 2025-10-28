/**
 * 统一筛选服务
 *
 * 功能：
 * - 统一筛选接口
 * - 多策略支持（Fuse、Native、Hybrid）
 * - 查询缓存
 * - 结果高亮
 * - 性能监控
 * - Worker 支持
 */

import { logger } from '@/infrastructure/logging/logger'
import {
  indexedDBManager,
  type BookmarkRecord
} from '@/infrastructure/indexeddb/manager'
import { SearchEngine } from './engine'
import { FuseSearchStrategy } from './strategies/fuse-strategy'
import { QueryCache } from './query-cache'
import { HighlightEngine } from './highlight'
import { queryWorkerAdapter } from '@/services/query-worker-adapter'
import type {
  SearchOptions,
  EnhancedSearchResult,
  SearchResponse,
  SearchResultMetadata,
  RelevanceFactors,
  IndexStatus
} from './unified-query-types'

export class UnifiedQueryService {
  private static instance: UnifiedQueryService
  private queryCache: QueryCache
  private highlightEngine: HighlightEngine
  private fuseEngine: SearchEngine
  private indexStatus: IndexStatus
  private initialized: boolean = false

  private constructor() {
    this.queryCache = new QueryCache({ maxSize: 1000, ttl: 5 * 60 * 1000 })
    this.highlightEngine = new HighlightEngine()
    this.fuseEngine = new SearchEngine(new FuseSearchStrategy())
    this.indexStatus = {
      isBuilding: false,
      isReady: false,
      lastBuilt: null,
      documentCount: 0,
      version: 1
    }
  }

  static getInstance(): UnifiedQueryService {
    if (!UnifiedQueryService.instance) {
      UnifiedQueryService.instance = new UnifiedQueryService()
    }
    return UnifiedQueryService.instance
  }

  /**
   * 初始化筛选服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('UnifiedQueryService', '🚀 初始化统一筛选服务...')

    try {
      // 初始化 IndexedDB
      await indexedDBManager.initialize()

      // 初始化 Worker
      await queryWorkerAdapter.initFromIDB()

      // 更新索引状态
      this.indexStatus.isReady = true
      this.indexStatus.lastBuilt = Date.now()

      this.initialized = true
      logger.info('UnifiedQueryService', '✅ 筛选服务初始化完成')
    } catch (error) {
      logger.error('Component', 'UnifiedQueryService', '❌ 初始化失败:', error)
      throw error
    }
  }

  /**
   * 统一筛选接口
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const startTime = performance.now()
    const {
      limit = 100,
      offset = 0,
      useCache = true,
      highlight = true,
      timeout: _timeout = 5000
    } = options

    // 规范化查询
    const normalizedQuery = this.normalizeQuery(query)
    logger.info(
      'UnifiedQueryService',
      `🔍 接收到筛选请求: "${normalizedQuery}"`
    )
    if (!normalizedQuery) {
      logger.debug('UnifiedQueryService', '⚪ 空查询，返回空结果')
      return this.emptyResponse(startTime, 'fuse')
    }

    try {
      // 检查缓存
      if (useCache) {
        const cached = this.queryCache.get(normalizedQuery, options)
        if (cached) {
          logger.info('UnifiedQueryService', `✅ 缓存命中: ${normalizedQuery}`)
          return {
            results: cached.slice(offset, offset + limit),
            metadata: this.createMetadata(
              startTime,
              cached.length,
              true,
              'fuse',
              normalizedQuery
            )
          }
        }
      }

      // 执行筛选（统一使用 Fuse 策略）
      let results = await this.searchWithFuse(normalizedQuery, options)
      logger.info('UnifiedQueryService', `📦 Fuse 结果数: ${results.length}`)

      // 添加高亮
      if (highlight) {
        results = this.addHighlights(results, normalizedQuery)
      }

      // 排序
      results = this.sortResults(results, options)

      // 缓存结果
      if (useCache) {
        this.queryCache.set(normalizedQuery, results, options)
      }

      const duration = performance.now() - startTime
      logger.info(
        'UnifiedQueryService',
        `✅ 筛选完成: "${normalizedQuery}" - ${duration.toFixed(2)}ms, ${results.length} 条结果`
      )

      return {
        results: results.slice(offset, offset + limit),
        metadata: this.createMetadata(
          startTime,
          results.length,
          false,
          'fuse',
          normalizedQuery
        )
      }
    } catch (error) {
      logger.error('Component', 'UnifiedQueryService', '❌ 筛选失败:', error)
      throw error
    }
  }

  /**
   * Fuse 筛选
   */
  private async searchWithFuse(
    query: string,
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    try {
      // 优先使用 Worker
      const workerResults = await queryWorkerAdapter.search(
        query,
        options.limit || 100
      )
      return this.convertToEnhanced(workerResults, query)
    } catch (_error) {
      // 降级到主线程
      logger.warn('UnifiedQueryService', 'Worker 筛选失败，降级到主线程')
      const bookmarks = await indexedDBManager.getAllBookmarks()
      const results = this.fuseEngine.search(query, bookmarks)
      return this.convertToEnhanced(results, query)
    }
  }

  /**
   * Native 筛选（Chrome API）
   */
  private normalizeQuery(query: string): string {
    return String(query || '')
      .trim()
      .toLowerCase()
  }

  /**
   * 选择筛选策略
   */
  /**
   * 转换为增强结果
   */
  private convertToEnhanced(
    results: Array<{ bookmark: BookmarkRecord; score: number }>,
    query: string
  ): EnhancedSearchResult[] {
    return results.map(result => ({
      bookmark: result.bookmark,
      score: result.score,
      pathString: result.bookmark.pathString,
      matchedFields: this.detectMatchedFields(result.bookmark, query),
      highlights: {},
      relevanceFactors: this.calculateRelevanceFactors(
        result.bookmark,
        query,
        result.score
      )
    }))
  }

  /**
   * 检测匹配字段
   */
  private detectMatchedFields(
    bookmark: BookmarkRecord,
    query: string
  ): string[] {
    const fields: string[] = []
    const lowerQuery = query.toLowerCase()

    if (bookmark.titleLower.includes(lowerQuery)) {
      fields.push('title')
    }
    if (bookmark.urlLower?.includes(lowerQuery)) {
      fields.push('url')
    }
    if (bookmark.domain?.toLowerCase().includes(lowerQuery)) {
      fields.push('domain')
    }

    return fields
  }

  /**
   * 计算相关性因素
   */
  private calculateRelevanceFactors(
    bookmark: BookmarkRecord,
    query: string,
    _baseScore: number
  ): RelevanceFactors {
    const lowerQuery = query.toLowerCase()

    return {
      titleMatch: bookmark.titleLower.includes(lowerQuery) ? 1.0 : 0.0,
      urlMatch: bookmark.urlLower?.includes(lowerQuery) ? 0.8 : 0.0,
      domainMatch: bookmark.domain?.toLowerCase().includes(lowerQuery)
        ? 0.6
        : 0.0,
      keywordMatch: 0.0, // TODO: 实现关键词匹配
      exactMatch: bookmark.titleLower === lowerQuery ? 1.0 : 0.0,
      recencyBoost: 0.0, // TODO: 实现最近使用加分
      clickBoost: 0.0 // TODO: 实现点击频率加分
    }
  }

  /**
   * 添加高亮
   */
  private addHighlights(
    results: EnhancedSearchResult[],
    query: string
  ): EnhancedSearchResult[] {
    return results.map(result => ({
      ...result,
      highlights: {
        title: this.highlightEngine.highlight(result.bookmark.title, query),
        url: result.bookmark.url
          ? this.highlightEngine.highlight(result.bookmark.url, query)
          : undefined
      }
    }))
  }

  /**
   * 排序结果
   */
  private sortResults(
    results: EnhancedSearchResult[],
    options: SearchOptions
  ): EnhancedSearchResult[] {
    const { sortBy = 'relevance', sortOrder = 'desc' } = options

    results.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'relevance':
          comparison = b.score - a.score
          break
        case 'title':
          comparison = a.bookmark.title.localeCompare(b.bookmark.title)
          break
        case 'date':
          comparison = (b.bookmark.dateAdded || 0) - (a.bookmark.dateAdded || 0)
          break
        default:
          comparison = b.score - a.score
      }

      return sortOrder === 'asc' ? -comparison : comparison
    })

    return results
  }

  /**
   * 创建元数据
   */
  private createMetadata(
    startTime: number,
    totalResults: number,
    cacheHit: boolean,
    strategy: string,
    queryNormalized: string
  ): SearchResultMetadata {
    return {
      searchTime: performance.now() - startTime,
      totalResults,
      cacheHit,
      strategy,
      queryNormalized
    }
  }

  /**
   * 空响应
   */
  private emptyResponse(startTime: number, strategy: string): SearchResponse {
    return {
      results: [],
      metadata: this.createMetadata(startTime, 0, false, strategy, '')
    }
  }

  /**
   * 失效缓存
   */
  invalidateCache(pattern?: string): void {
    this.queryCache.invalidate(pattern)
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.queryCache.clear()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.queryCache.getStats()
  }

  /**
   * 获取索引状态
   */
  getIndexStatus(): IndexStatus {
    return { ...this.indexStatus }
  }
}

// 导出单例
export const unifiedQueryService = UnifiedQueryService.getInstance()

// 兼容旧名称（废弃）
/** @deprecated 请使用 unifiedQueryService */
export const unifiedSearchService = unifiedQueryService
/** @deprecated 请使用 unifiedQueryService */
export const unifiedFilterService = unifiedQueryService
