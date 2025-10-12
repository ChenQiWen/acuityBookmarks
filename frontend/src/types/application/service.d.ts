/**
 * 服务层类型定义
 *
 * 包含各种应用服务的配置和选项类型
 */

/**
 * 搜索 Worker 适配器选项
 *
 * 配置 Search Worker 的行为
 */
export interface SearchWorkerAdapterOptions {
  /** 搜索结果数量限制 */
  limit?: number
}

/**
 * 性能监控选项
 *
 * 配置性能监控器的行为
 */
export interface PerformanceMonitorOptions {
  /** 是否启用 */
  enabled?: boolean

  /** 采样率 (0-1) */
  sampleRate?: number

  /** 是否记录详细信息 */
  verbose?: boolean
}

/**
 * 推荐引擎选项
 *
 * 配置智能推荐引擎的行为
 */
export interface RecommendationEngineOptions {
  /** 最大推荐数量 */
  maxRecommendations?: number

  /** 最小置信度阈值 (0-1) */
  minConfidence?: number

  /** 是否启用上下文感知 */
  contextAware?: boolean
}

/**
 * 书签增强器选项
 *
 * 配置书签增强器的行为
 */
export interface BookmarkEnhancerOptions {
  /** 是否自动获取元数据 */
  autoFetchMetadata?: boolean

  /** 超时时间（毫秒） */
  timeout?: number

  /** 是否缓存结果 */
  cacheResults?: boolean
}

/**
 * 现代书签服务选项
 *
 * 配置现代书签服务的行为
 */
export interface ModernBookmarkServiceOptions {
  /** 是否启用虚拟滚动 */
  virtualScroll?: boolean

  /** 每页数量 */
  pageSize?: number

  /** 是否启用懒加载 */
  lazyLoad?: boolean
}
