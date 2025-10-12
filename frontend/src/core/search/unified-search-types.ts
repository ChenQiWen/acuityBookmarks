/**
 * 统一搜索系统类型定义
 *
 * ⚠️ DEPRECATED: 此文件已迁移到 @/types/domain/search
 *
 * 为保持向后兼容，此文件暂时保留，仅重新导出类型。
 * 新代码请直接从 @/types 导入。
 *
 * @deprecated 使用 import type { SearchOptions, EnhancedSearchResult } from '@/types'
 */

// 从新的类型定义文件重新导出
export type {
  SearchOptions,
  SearchStrategy,
  SearchSortBy,
  SortOrder,
  HighlightSegment,
  RelevanceFactors,
  SearchResultMetadata,
  EnhancedSearchResult,
  SearchResponse,
  SearchStats,
  SearchEventType,
  SearchEvent,
  IndexStatus,
  CacheConfig,
  WorkerConfig
} from '@/types/domain/search'
