/**
 * 应用层：搜索服务（重构版）
 *
 * 职责：
 * - 封装统一搜索服务
 * - 提供简单的应用层接口
 * - 集成错误处理
 * - 性能监控
 */

import {
  unifiedSearchService,
  type SearchResponse,
  type EnhancedSearchResult
} from '@/core/search'
import type { SearchOptions } from '@/types/domain/search'
import { logger } from '@/infrastructure/logging/logger'
import { getPerformanceMonitor } from '@/services/search-performance-monitor'

export class SearchAppService {
  private performanceMonitor = getPerformanceMonitor()

  /**
   * 初始化搜索服务
   */
  async initialize(): Promise<void> {
    await unifiedSearchService.initialize()
    logger.info('SearchAppService', '✅ 搜索服务初始化完成')
  }

  /**
   * 搜索书签
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    const startTime = performance.now()

    try {
      const response = await unifiedSearchService.search(query, options)

      // 记录性能
      this.recordPerformance(query, startTime, response, true)

      return response.results
    } catch (error) {
      this.recordPerformance(query, startTime, null, false, error as Error)
      throw error
    }
  }

  /**
   * 搜索（完整响应）
   */
  async searchWithMetadata(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResponse> {
    const startTime = performance.now()

    try {
      const response = await unifiedSearchService.search(query, options)
      this.recordPerformance(query, startTime, response, true)
      return response
    } catch (error) {
      this.recordPerformance(query, startTime, null, false, error as Error)
      throw error
    }
  }

  /**
   * 记录性能指标
   */
  private recordPerformance(
    query: string,
    startTime: number,
    response: SearchResponse | null,
    success: boolean,
    error?: Error
  ): void {
    const duration = performance.now() - startTime

    this.performanceMonitor.recordSearch({
      query,
      duration,
      resultCount: response?.results.length || 0,
      cacheHit: response?.metadata.cacheHit || false,
      searchMode: response?.metadata.strategy || 'unknown',
      sources: response?.metadata.strategy ? [response.metadata.strategy] : [],
      success,
      errorMessage: error?.message
    })
  }

  /**
   * 失效缓存
   */
  invalidateCache(pattern?: string): void {
    unifiedSearchService.invalidateCache(pattern)
    logger.info(
      'SearchAppService',
      `✅ 缓存已失效${pattern ? `: ${pattern}` : ''}`
    )
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    unifiedSearchService.clearCache()
    logger.info('SearchAppService', '✅ 缓存已清空')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return unifiedSearchService.getCacheStats()
  }

  /**
   * 获取索引状态
   */
  getIndexStatus() {
    return unifiedSearchService.getIndexStatus()
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return this.performanceMonitor.getPerformanceStats()
  }

  /**
   * 获取优化建议
   */
  getOptimizationSuggestions() {
    return this.performanceMonitor.getOptimizationSuggestions()
  }
}

// 导出单例
export const searchAppService = new SearchAppService()
