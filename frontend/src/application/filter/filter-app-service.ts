/**
 * 应用层：统一书签筛选服务封装
 *
 * 实际功能是"筛选（Filter）"而非"搜索（Search）"：
 * - 所有数据都在本地 IndexedDB
 * - 不存在网络请求
 * - 从已有集合中过滤符合条件的书签
 *
 * 对外 API 统一使用"筛选（Filter）"术语
 *
 * 职责：
 * - 封装统一筛选服务
 * - 提供简洁的应用层接口
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

/**
 * 书签筛选应用服务类
 *
 * 统一封装筛选功能，提供简洁的应用层接口
 *
 * 注：内部使用 search 作为方法名是为了兼容底层 API
 */
export class FilterAppService {
  private performanceMonitor = getPerformanceMonitor()
  private initialized = false

  /**
   * 初始化筛选服务
   *
   * 完成筛选服务的初始化准备工作
   */
  async initialize(): Promise<void> {
    await unifiedSearchService.initialize()
    this.initialized = true
    logger.info('FilterAppService', '✅ 筛选服务初始化完成')
  }

  /**
   * 确保服务已初始化
   *
   * 内部方法，在执行筛选前检查并确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.initialize()
  }

  /**
   * 筛选书签
   *
   * @param query - 筛选条件字符串
   * @param options - 可选的筛选选项
   * @returns 筛选结果数组
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    const startTime = performance.now()

    await this.ensureInitialized()

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
   * 筛选（返回完整响应，包含元数据）
   *
   * @param query - 筛选条件字符串
   * @param options - 可选的筛选选项
   * @returns 完整的筛选响应对象，包括结果和元数据
   */
  async searchWithMetadata(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResponse> {
    const startTime = performance.now()

    await this.ensureInitialized()

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
   *
   * 内部方法，用于记录每次筛选的性能数据
   *
   * @param query - 筛选条件字符串
   * @param startTime - 筛选开始时间
   * @param response - 筛选响应对象
   * @param success - 筛选是否成功
   * @param error - 可选的错误对象
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
   * 使缓存失效
   *
   * @param pattern - 可选的匹配模式，用于选择性失效缓存
   */
  invalidateCache(pattern?: string): void {
    unifiedSearchService.invalidateCache(pattern)
    logger.info(
      'SearchAppService',
      `✅ 缓存已失效${pattern ? `: ${pattern}` : ''}`
    )
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    unifiedSearchService.clearCache()
    logger.info('SearchAppService', '✅ 缓存已清空')
  }

  /**
   * 获取缓存统计信息
   *
   * @returns 缓存统计数据对象
   */
  getCacheStats() {
    return unifiedSearchService.getCacheStats()
  }

  /**
   * 获取索引状态
   *
   * @returns 索引状态信息
   */
  getIndexStatus() {
    return unifiedSearchService.getIndexStatus()
  }

  /**
   * 获取性能统计
   *
   * @returns 性能统计数据
   */
  getPerformanceStats() {
    return this.performanceMonitor.getPerformanceStats()
  }

  /**
   * 获取优化建议
   *
   * @returns 基于性能统计的优化建议列表
   */
  getOptimizationSuggestions() {
    return this.performanceMonitor.getOptimizationSuggestions()
  }
}

/**
 * 筛选应用服务单例
 *
 * 全局共享的筛选服务实例
 */
export const filterAppService = new FilterAppService()

/**
 * @deprecated 使用 filterAppService 替代
 * 保留此导出以兼容旧代码，将在下个版本移除
 */
export const searchAppService = filterAppService
