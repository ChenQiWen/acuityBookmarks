/**
 * 统一搜索服务
 *
 * 功能：
 * - 统一搜索接口
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
import { searchWorkerAdapter } from '@/services/search-worker-adapter'
import type {
  SearchOptions,
  EnhancedSearchResult,
  SearchResponse,
  SearchResultMetadata,
  RelevanceFactors,
  IndexStatus
} from './unified-search-types'

export class UnifiedSearchService {
  private static instance: UnifiedSearchService
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

  static getInstance(): UnifiedSearchService {
    if (!UnifiedSearchService.instance) {
      UnifiedSearchService.instance = new UnifiedSearchService()
    }
    return UnifiedSearchService.instance
  }

  /**
   * 初始化搜索服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('UnifiedSearchService', '🚀 初始化统一搜索服务...')

    try {
      // 初始化 IndexedDB
      await indexedDBManager.initialize()

      // 初始化 Worker
      await searchWorkerAdapter.initFromIDB()

      // 更新索引状态
      this.indexStatus.isReady = true
      this.indexStatus.lastBuilt = Date.now()

      this.initialized = true
      logger.info('UnifiedSearchService', '✅ 搜索服务初始化完成')
    } catch (error) {
      logger.error('UnifiedSearchService', '❌ 初始化失败:', error)
      throw error
    }
  }

  /**
   * 统一搜索接口
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const startTime = performance.now()
    const {
      strategy = 'auto',
      limit = 100,
      offset = 0,
      useCache = true,
      highlight = true,
      timeout: _timeout = 5000
    } = options

    // 规范化查询
    const normalizedQuery = this.normalizeQuery(query)
    if (!normalizedQuery) {
      return this.emptyResponse(startTime, strategy)
    }

    try {
      // 检查缓存
      if (useCache) {
        const cached = this.queryCache.get(normalizedQuery, options)
        if (cached) {
          logger.info('UnifiedSearchService', `✅ 缓存命中: ${normalizedQuery}`)
          return {
            results: cached.slice(offset, offset + limit),
            metadata: this.createMetadata(
              startTime,
              cached.length,
              true,
              strategy,
              normalizedQuery
            )
          }
        }
      }

      // 选择搜索策略
      const selectedStrategy =
        strategy === 'auto' ? this.selectStrategy(normalizedQuery) : strategy

      // 执行搜索
      let results: EnhancedSearchResult[] = []

      switch (selectedStrategy) {
        case 'fuse':
          results = await this.searchWithFuse(normalizedQuery, options)
          break
        case 'native':
          results = await this.searchWithNative(normalizedQuery, options)
          break
        case 'hybrid':
          results = await this.searchWithHybrid(normalizedQuery, options)
          break
        default:
          results = await this.searchWithFuse(normalizedQuery, options)
      }

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
        'UnifiedSearchService',
        `✅ 搜索完成: "${normalizedQuery}" - ${duration.toFixed(2)}ms, ${results.length} 条结果`
      )

      return {
        results: results.slice(offset, offset + limit),
        metadata: this.createMetadata(
          startTime,
          results.length,
          false,
          selectedStrategy,
          normalizedQuery
        )
      }
    } catch (error) {
      logger.error('UnifiedSearchService', '❌ 搜索失败:', error)
      throw error
    }
  }

  /**
   * Fuse 搜索
   */
  private async searchWithFuse(
    query: string,
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    try {
      // 优先使用 Worker
      const workerResults = await searchWorkerAdapter.search(
        query,
        options.limit || 100
      )
      return this.convertToEnhanced(workerResults, query)
    } catch (_error) {
      // 降级到主线程
      logger.warn('UnifiedSearchService', 'Worker 搜索失败，降级到主线程')
      const bookmarks = await indexedDBManager.getAllBookmarks()
      const results = this.fuseEngine.search(query, bookmarks)
      return this.convertToEnhanced(results, query)
    }
  }

  /**
   * Native 搜索（Chrome API）
   */
  private async searchWithNative(
    query: string,
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    if (typeof chrome === 'undefined' || !chrome?.bookmarks?.search) {
      // 降级到 Fuse
      return this.searchWithFuse(query, options)
    }

    try {
      const nodes = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
        (resolve, reject) => {
          chrome.bookmarks.search(query, result => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve(result || [])
            }
          })
        }
      )

      // 转换为 EnhancedSearchResult
      const bookmarks = await indexedDBManager.getAllBookmarks()
      const byId = new Map(bookmarks.map(b => [b.id, b]))

      const results: EnhancedSearchResult[] = nodes
        .filter(n => n.url) // 只要书签
        .map(n => {
          const bookmark = byId.get(n.id)
          if (!bookmark) return null

          return {
            bookmark,
            score: 0.9, // Native 搜索给高分
            matchedFields: ['title', 'url'],
            highlights: {}
          }
        })
        .filter((r): r is EnhancedSearchResult => r !== null)

      return results
    } catch (error) {
      logger.error('UnifiedSearchService', 'Native 搜索失败:', error)
      return this.searchWithFuse(query, options)
    }
  }

  /**
   * 混合搜索（Fuse + Native）
   */
  private async searchWithHybrid(
    query: string,
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    try {
      // 并行执行两种搜索
      const [fuseResults, nativeResults] = await Promise.all([
        this.searchWithFuse(query, options),
        this.searchWithNative(query, options)
      ])

      // 合并结果，去重并取最高分
      const merged = new Map<string, EnhancedSearchResult>()

      for (const result of fuseResults) {
        merged.set(result.bookmark.id, result)
      }

      for (const result of nativeResults) {
        const existing = merged.get(result.bookmark.id)
        if (!existing || existing.score < result.score) {
          merged.set(result.bookmark.id, result)
        }
      }

      return Array.from(merged.values())
    } catch (error) {
      logger.error('UnifiedSearchService', '混合搜索失败:', error)
      return this.searchWithFuse(query, options)
    }
  }

  /**
   * 规范化查询
   */
  private normalizeQuery(query: string): string {
    return String(query || '')
      .trim()
      .toLowerCase()
  }

  /**
   * 选择搜索策略
   */
  private selectStrategy(query: string): 'fuse' | 'native' | 'hybrid' {
    // 简单策略：短查询用 native，长查询用 fuse
    if (query.length <= 3) {
      return 'native'
    } else if (query.length > 20) {
      return 'fuse'
    } else {
      return 'hybrid'
    }
  }

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
export const unifiedSearchService = UnifiedSearchService.getInstance()
