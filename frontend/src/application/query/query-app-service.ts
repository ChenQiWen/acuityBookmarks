/**
 * 应用层：统一书签查询服务封装
 *
 * 实际功能是"查询（Filter）"而非"搜索（Search）"：
 * - 所有数据都在本地 IndexedDB
 * - 不存在网络请求
 * - 从已有集合中过滤符合条件的书签
 *
 * 对外 API 统一使用"查询（Filter）"术语
 *
 * 职责：
 * - 封装统一查询服务
 * - 提供简洁的应用层接口
 * - 集成错误处理
 * - 性能监控
 */

import {
  unifiedQueryService,
  type SearchResponse,
  type EnhancedSearchResult
} from '@/core/query-engine'
import type { SearchOptions } from '@/types/domain/query'
import { logger } from '@/infrastructure/logging/logger'
import { getPerformanceMonitor } from '@/services/query-performance-monitor'

/**
 * 书签查询应用服务类
 *
 * 统一封装查询功能，提供简洁的应用层接口
 *
 * 注：内部使用 search 作为方法名是为了兼容底层 API
 */
export class QueryAppService {
  private performanceMonitor = getPerformanceMonitor()
  private initialized = false

  /**
   * 初始化查询服务
   *
   * 完成查询服务的初始化准备工作
   */
  async initialize(): Promise<void> {
    await unifiedQueryService.initialize()
    this.initialized = true
    logger.info('QueryAppService', '✅ 查询服务初始化完成')
  }

  /**
   * 确保服务已初始化
   *
   * 内部方法，在执行查询前检查并确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.initialize()
  }

  /**
   * 查询书签
   *
   * @param query - 查询条件字符串
   * @param options - 可选的查询选项
   * @returns 查询结果数组
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    const startTime = performance.now()

    await this.ensureInitialized()

    try {
      const response = await unifiedQueryService.search(query, options)

      // 记录性能
      this.recordPerformance(query, startTime, response, true)

      return response.results
    } catch (error) {
      this.recordPerformance(query, startTime, null, false, error as Error)
      throw error
    }
  }

  /**
   * 查询（返回完整响应，包含元数据）
   *
   * @param query - 查询条件字符串
   * @param options - 可选的查询选项
   * @returns 完整的查询响应对象，包括结果和元数据
   */
  async searchWithMetadata(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResponse> {
    const startTime = performance.now()

    await this.ensureInitialized()

    try {
      const response = await unifiedQueryService.search(query, options)
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
   * 内部方法，用于记录每次查询的性能数据
   *
   * @param query - 查询条件字符串
   * @param startTime - 查询开始时间
   * @param response - 查询响应对象
   * @param success - 查询是否成功
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
    unifiedQueryService.invalidateCache(pattern)
    logger.info(
      'SearchAppService',
      `✅ 缓存已失效${pattern ? `: ${pattern}` : ''}`
    )
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    unifiedQueryService.clearCache()
    logger.info('SearchAppService', '✅ 缓存已清空')
  }

  /**
   * 获取缓存统计信息
   *
   * @returns 缓存统计数据对象
   */
  getCacheStats() {
    return unifiedQueryService.getCacheStats()
  }

  /**
   * 获取索引状态
   *
   * @returns 索引状态信息
   */
  getIndexStatus() {
    return unifiedQueryService.getIndexStatus()
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
 * 查询应用服务单例
 *
 * 全局共享的查询服务实例
 */
export const queryAppService = new QueryAppService()

/**
 * @deprecated 使用 queryAppService 替代
 * 保留此导出以兼容旧代码，将在下个版本移除
 */
export const searchAppService = queryAppService
export const filterAppService = queryAppService
