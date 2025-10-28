/**
 * 筛选领域类型定义
 *
 * 包含筛选功能相关的所有类型定义
 */

import type { ID, Timestamp } from '../core/common'
import type { BookmarkRecord } from './bookmark'

/**
 * 筛选策略类型
 *
 * 定义可用的筛选策略
 */
export type SearchStrategy = 'fuse'

/**
 * 筛选排序字段
 *
 * 可以用于排序的字段
 */
export type SearchSortBy = 'relevance' | 'title' | 'date' | 'frequency' | 'url'

/**
 * 排序顺序
 *
 * 升序或降序
 */
export type SortOrder = 'asc' | 'desc'

/**
 * 筛选选项接口
 *
 * 配置筛选行为的选项
 *
 * @example
 * ```typescript
 * const options: SearchOptions = {
 *   strategy: 'fuse',
 *   limit: 50,
 *   highlight: true,
 *   sortBy: 'relevance'
 * }
 * ```
 */
export interface SearchOptions extends Record<string, unknown> {
  /** 筛选策略（已废弃，固定为 'fuse'） */
  strategy?: SearchStrategy

  /** 结果限制数量 */
  limit?: number

  /** 偏移量（分页） */
  offset?: number

  /** 排序字段 */
  sortBy?: SearchSortBy

  /** 排序顺序 */
  sortOrder?: SortOrder

  /** 是否过滤文件夹 */
  filterFolders?: boolean

  /** 是否过滤书签 */
  filterBookmarks?: boolean

  /** 域名过滤列表 */
  domainFilter?: string[]

  /** 是否启用高亮 */
  highlight?: boolean

  /** 高亮标签名 */
  highlightTag?: string

  /** 是否使用缓存 */
  useCache?: boolean

  /** 仅使用缓存（不执行新筛选） */
  cacheOnly?: boolean

  /** 超时时间（毫秒） */
  timeout?: number

  /** 最低分数阈值 */
  minScore?: number

  /** 模糊匹配阈值 (0-1) */
  fuzzyThreshold?: number

  /** 是否包含元数据 */
  includeMetadata?: boolean
}

/**
 * 高亮片段接口
 *
 * 表示文本中的一个片段，标记是否为匹配部分
 *
 * @example
 * ```typescript
 * const segment: HighlightSegment = {
 *   text: 'React',
 *   isMatch: true,
 *   start: 0,
 *   end: 5
 * }
 * ```
 */
export interface HighlightSegment {
  /** 片段文本内容 */
  text: string

  /** 是否为匹配部分 */
  isMatch: boolean

  /** 起始位置 */
  start: number

  /** 结束位置 */
  end: number
}

/**
 * 相关性因素接口
 *
 * 影响筛选结果相关性的各个因素及其权重
 */
export interface RelevanceFactors {
  /** 标题匹配度 (0-1) */
  titleMatch: number

  /** URL匹配度 (0-1) */
  urlMatch: number

  /** 域名匹配度 (0-1) */
  domainMatch: number

  /** 关键词匹配度 (0-1) */
  keywordMatch: number

  /** 精确匹配加分 (0-1) */
  exactMatch: number

  /** 最近使用加分 (0-1) */
  recencyBoost: number

  /** 点击频率加分 (0-1) */
  clickBoost: number
}

/**
 * 增强筛选结果接口
 *
 * 包含书签信息、评分、高亮等完整筛选结果
 *
 * @example
 * ```typescript
 * const result: EnhancedSearchResult = {
 *   bookmark: bookmarkRecord,
 *   score: 0.95,
 *   matchedFields: ['title', 'url'],
 *   highlights: {
 *     title: [{ text: 'React', isMatch: true, start: 0, end: 5 }]
 *   }
 * }
 * ```
 */
export interface EnhancedSearchResult {
  /** 书签记录 */
  bookmark: BookmarkRecord

  /** 相关性分数 (0-1，越大越相关) */
  score: number

  /** 书签完整路径字符串（用于展示层级信息） */
  pathString?: string

  /** 匹配的字段列表 */
  matchedFields: string[]

  /** 高亮信息 */
  highlights: {
    /** 标题高亮 */
    title?: HighlightSegment[]
    /** URL高亮 */
    url?: HighlightSegment[]
    /** 域名高亮 */
    domain?: HighlightSegment[]
  }

  /** 相关性因素（可选） */
  relevanceFactors?: RelevanceFactors
}

/**
 * 筛选结果元数据接口
 *
 * 筛选执行的元数据信息
 */
export interface SearchResultMetadata {
  /** 筛选耗时（毫秒） */
  searchTime: number

  /** 总结果数量 */
  totalResults: number

  /** 是否缓存命中 */
  cacheHit: boolean

  /** 使用的筛选策略 */
  strategy: string

  /** 规范化后的查询 */
  queryNormalized: string

  /** 查询时间戳 */
  timestamp?: Timestamp
}

/**
 * 筛选响应接口
 *
 * 完整的筛选响应，包含结果和元数据
 *
 * @example
 * ```typescript
 * const response: SearchResponse = {
 *   results: [],
 *   metadata: {
 *     searchTime: 45,
 *     totalResults: 100,
 *     cacheHit: false,
 *     strategy: 'fuse',
 *     queryNormalized: 'react'
 *   },
 *   suggestions: ['react hooks', 'react native']
 * }
 * ```
 */
export interface SearchResponse {
  /** 筛选结果列表 */
  results: EnhancedSearchResult[]

  /** 筛选元数据 */
  metadata: SearchResultMetadata

  /** 筛选建议（可选） */
  suggestions?: string[]

  /** 相关筛选（可选） */
  relatedSearches?: string[]
}

/**
 * 筛选统计信息接口
 *
 * 筛选功能的统计数据
 */
export interface SearchStats {
  /** 总筛选次数 */
  totalSearches: number

  /** 缓存命中率 (0-1) */
  cacheHitRate: number

  /** 平均筛选时间（毫秒） */
  averageSearchTime: number

  /** 中位数筛选时间（毫秒） */
  medianSearchTime?: number

  /** P95 响应时间（毫秒） */
  p95ResponseTime?: number

  /** 热门查询列表 */
  popularQueries: Array<{
    /** 查询文本 */
    query: string
    /** 查询次数 */
    count: number
    /** 平均耗时 */
    avgTime: number
    /** 最后使用时间 */
    lastUsed?: Timestamp
  }>

  /** 成功率 (0-1) */
  successRate?: number

  /** 错误率 (0-1) */
  errorRate?: number
}

/**
 * 筛选事件类型
 *
 * 筛选过程中可能触发的事件类型
 */
export type SearchEventType =
  | 'search:start'
  | 'search:complete'
  | 'search:error'
  | 'search:cached'
  | 'index:building'
  | 'index:ready'
  | 'index:updated'
  | 'index:error'

/**
 * 筛选事件接口
 *
 * 筛选事件的数据结构
 */
export interface SearchEvent {
  /** 事件类型 */
  type: SearchEventType

  /** 事件时间戳 */
  timestamp: Timestamp

  /** 事件数据 */
  data?: Record<string, unknown>

  /** 相关查询 */
  query?: string

  /** 错误信息（如果是错误事件） */
  error?: string
}

/**
 * 索引状态接口
 *
 * 筛选索引的当前状态
 */
export interface IndexStatus {
  /** 是否正在构建 */
  isBuilding: boolean

  /** 是否已就绪 */
  isReady: boolean

  /** 最后构建时间 */
  lastBuilt: Timestamp | null

  /** 文档数量 */
  documentCount: number

  /** 索引版本 */
  version: number

  /** 索引大小（字节） */
  size?: number

  /** 错误信息 */
  error?: string
}

/**
 * 缓存配置接口
 *
 * 筛选缓存的配置选项
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean

  /** 最大缓存条目数 */
  maxSize: number

  /** 缓存过期时间（毫秒） */
  ttl: number

  /** 缓存策略 */
  strategy: 'lru' | 'lfu' | 'fifo'

  /** 是否持久化 */
  persistent?: boolean
}

/**
 * Worker 配置接口
 *
 * 筛选 Worker 的配置选项
 */
export interface WorkerConfig {
  /** 是否启用 Worker */
  enabled: boolean

  /** Worker 池大小 */
  poolSize: number

  /** 超时时间（毫秒） */
  timeout: number

  /** 批处理大小 */
  batchSize: number

  /** 是否预热 */
  warmup?: boolean
}

/**
 * 筛选历史记录接口
 *
 * 用户的筛选历史
 */
export interface SearchHistory {
  /** 历史记录ID */
  id: ID

  /** 查询文本 */
  query: string

  /** 筛选时间 */
  timestamp: Timestamp

  /** 结果数量 */
  resultCount: number

  /** 是否点击了结果 */
  clicked: boolean

  /** 点击的书签ID */
  clickedBookmarkId?: ID

  /** 筛选耗时 */
  duration?: number
}

/**
 * 筛选建议接口
 *
 * 筛选自动补全建议
 */
export interface SearchSuggestion {
  /** 建议文本 */
  text: string

  /** 建议类型 */
  type: 'history' | 'popular' | 'completion' | 'related'

  /** 相关性分数 */
  score: number

  /** 使用次数 */
  frequency?: number

  /** 最后使用时间 */
  lastUsed?: Timestamp
}

/**
 * 筛选过滤器接口
 *
 * 高级筛选过滤条件
 */
export interface SearchFilter {
  /** 域名过滤 */
  domains?: string[]

  /** 标签过滤 */
  tags?: string[]

  /** 日期范围 */
  dateRange?: {
    /** 开始时间 */
    start?: Timestamp
    /** 结束时间 */
    end?: Timestamp
  }

  /** 文件夹ID过滤 */
  folderIds?: ID[]

  /** 是否已访问 */
  visited?: boolean

  /** 是否收藏 */
  favorited?: boolean
}

/**
 * 筛选结果简单格式
 *
 * 用于 Popup 等简单场景的筛选结果
 */
export interface SearchResult {
  /** 书签 ID */
  id: ID

  /** 评分（0-1） */
  score: number

  /** 书签记录 */
  bookmark: BookmarkRecord

  /** 书签完整路径字符串（用于展示层级信息） */
  pathString?: string
}

/**
 * Worker 筛选文档接口
 *
 * Worker 中使用的轻量级文档格式
 */
export interface WorkerDoc {
  /** 文档ID */
  id: string

  /** 标题（小写） */
  titleLower: string

  /** 原始标题（用于展示） */
  title?: string

  /** URL（小写） */
  urlLower?: string

  /** 原始 URL（用于展示） */
  url?: string

  /** 域名 */
  domain?: string

  /** 关键词 */
  keywords?: string[]

  /** 是否为文件夹 */
  isFolder?: boolean
}

/**
 * Worker 筛选命中结果
 *
 * Worker 返回的筛选结果
 */
export interface WorkerHit {
  /** 文档ID */
  id: string

  /** 相关性分数 */
  score: number
}

/**
 * 筛选性能指标接口
 *
 * 筛选性能监控指标
 */
export interface SearchPerformanceMetrics {
  /** 查询文本 */
  query: string

  /** 筛选耗时 */
  duration: number

  /** 结果数量 */
  resultCount: number

  /** 是否缓存命中 */
  cacheHit: boolean

  /** 筛选模式 */
  searchMode: string

  /** 时间戳 */
  timestamp: Timestamp

  /** 会话ID */
  sessionId?: string

  /** 数据源 */
  sources: string[]

  /** 是否成功 */
  success: boolean

  /** 错误信息 */
  errorMessage?: string
}
