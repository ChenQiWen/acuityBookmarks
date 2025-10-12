/**
 * 搜索模块统一导出
 */

// 核心搜索引擎
export { SearchEngine } from './engine'
export type { SearchStrategy } from './engine'

// 搜索策略
export { FuseSearchStrategy } from './strategies/fuse-strategy'

// 统一搜索服务
export {
  UnifiedSearchService,
  unifiedSearchService
} from './unified-search-service'

// 查询缓存
export { QueryCache } from './query-cache'

// 高亮引擎
export { HighlightEngine } from './highlight'

// 类型定义
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
} from './unified-search-types'
