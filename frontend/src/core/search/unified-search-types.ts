/**
 * 统一搜索系统类型定义
 */

import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'

// === 搜索选项 ===

export interface SearchOptions {
  // 搜索策略
  strategy?: 'fuse' | 'native' | 'hybrid' | 'auto'

  // 结果限制
  limit?: number
  offset?: number

  // 排序选项
  sortBy?: 'relevance' | 'title' | 'date' | 'frequency'
  sortOrder?: 'asc' | 'desc'

  // 过滤选项
  filterFolders?: boolean
  filterBookmarks?: boolean
  domainFilter?: string[]

  // 高亮选项
  highlight?: boolean
  highlightTag?: string

  // 缓存选项
  useCache?: boolean
  cacheOnly?: boolean

  // 性能选项
  timeout?: number
  minScore?: number

  // 高级选项
  fuzzyThreshold?: number
  includeMetadata?: boolean
}

// === 搜索结果 ===

export interface HighlightSegment {
  text: string
  isMatch: boolean
  start: number
  end: number
}

export interface RelevanceFactors {
  titleMatch: number
  urlMatch: number
  domainMatch: number
  keywordMatch: number
  exactMatch: number
  recencyBoost: number
  clickBoost: number
}

export interface SearchResultMetadata {
  searchTime: number
  totalResults: number
  cacheHit: boolean
  strategy: string
  queryNormalized: string
}

export interface EnhancedSearchResult {
  bookmark: BookmarkRecord
  score: number
  matchedFields: string[]
  highlights: {
    title?: HighlightSegment[]
    url?: HighlightSegment[]
    domain?: HighlightSegment[]
  }
  relevanceFactors?: RelevanceFactors
}

export interface SearchResponse {
  results: EnhancedSearchResult[]
  metadata: SearchResultMetadata
  suggestions?: string[]
}

// === 搜索统计 ===

export interface SearchStats {
  totalSearches: number
  cacheHitRate: number
  averageSearchTime: number
  popularQueries: Array<{
    query: string
    count: number
    avgTime: number
  }>
}

// === 搜索事件 ===

export type SearchEventType =
  | 'search:start'
  | 'search:complete'
  | 'search:error'
  | 'search:cached'
  | 'index:building'
  | 'index:ready'
  | 'index:updated'

export interface SearchEvent {
  type: SearchEventType
  timestamp: number
  data?: Record<string, unknown>
}

// === 索引状态 ===

export interface IndexStatus {
  isBuilding: boolean
  isReady: boolean
  lastBuilt: number | null
  documentCount: number
  version: number
}

// === 缓存配置 ===

export interface CacheConfig {
  enabled: boolean
  maxSize: number
  ttl: number
  strategy: 'lru' | 'lfu' | 'fifo'
}

// === Worker 配置 ===

export interface WorkerConfig {
  enabled: boolean
  poolSize: number
  timeout: number
  batchSize: number
}
