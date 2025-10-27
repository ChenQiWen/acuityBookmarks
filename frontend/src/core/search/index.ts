/**
 * 筛选模块统一导出
 */

// 核心筛选引擎
export { SearchEngine } from './engine'
export type { SearchStrategy } from './engine'

// 筛选策略
export { FuseSearchStrategy } from './strategies/fuse-strategy'

// 统一筛选服务
export {
  UnifiedSearchService,
  unifiedSearchService
} from './unified-search-service'

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
} from '@/types/domain/search'
