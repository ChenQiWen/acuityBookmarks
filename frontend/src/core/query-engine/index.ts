/**
 * 查询模块统一导出
 */

// 核心查询引擎
export { SearchEngine } from './engine'
export type { SearchStrategy } from './engine'

// 查询策略
export { FuseSearchStrategy } from './strategies/fuse-strategy'

// 查询服务（新名称）
export { QueryService, queryService } from './query-service'

// 向后兼容：保留旧名称
/** @deprecated 使用 QueryService 代替 */
export { UnifiedQueryService, unifiedQueryService } from './query-service'

// 查询缓存
export { QueryCache } from './query-cache'

// 高亮引擎
export { HighlightEngine } from './highlight'

// 类型定义 (重新导出自 @/types)
export type {
  SearchOptions,
  EnhancedSearchResult,
  SearchResponse,
  SearchResultMetadata,
  HighlightSegment,
  RelevanceFactors,
  SearchStats,
  SearchEvent,
  SearchEventType,
  IndexStatus,
  CacheConfig,
  WorkerConfig
} from '@/types/domain/query'
