/**
 * IndexedDB 数据库模式定义
 *
 * 职责：
 * - 定义数据库配置和版本
 * - 定义所有数据表结构
 * - 提供类型安全的数据库操作接口
 */

// ==================== 数据库配置 ====================
/**
 * IndexedDB 数据库配置
 */
export const DB_CONFIG = {
  NAME: 'AcuityBookmarksDB',
  VERSION: 8, // 升级版本以强制触发 onupgradeneeded

  // 存储表名
  STORES: {
    BOOKMARKS: 'bookmarks',
    GLOBAL_STATS: 'globalStats',
    SETTINGS: 'settings',
    SEARCH_HISTORY: 'searchHistory',
    FAVICON_CACHE: 'faviconCache',
    FAVICON_STATS: 'faviconStats',
    CRAWL_METADATA: 'crawlMetadata',
    EMBEDDINGS: 'embeddings',
    AI_JOBS: 'ai_jobs'
  } as const
} as const

// ==================== 索引配置 ====================
/**
 * 索引配置
 */
export const INDEX_CONFIG = {
  BOOKMARKS: {
    // 主键
    PRIMARY_KEY: 'id',

    // 单字段索引
    PARENT_ID: 'parentId',
    TITLE_LOWER: 'titleLower',
    URL_LOWER: 'urlLower',
    DOMAIN: 'domain',
    IS_FOLDER: 'isFolder',
    DEPTH: 'depth',
    CREATED_YEAR: 'createdYear',
    CREATED_MONTH: 'createdMonth',
    LAST_VISITED: 'lastVisited',
    VISIT_COUNT: 'visitCount',

    // 复合索引
    PARENT_INDEX: 'parentIndex',
    DOMAIN_CATEGORY: 'domainCategory',
    METADATA_UPDATED: 'metadataUpdatedAt',

    // 数组字段索引
    PATH_IDS: 'pathIds',
    ANCESTOR_IDS: 'ancestorIds',
    KEYWORDS: 'keywords',
    TAGS: 'tags'
  }
} as const

// ==================== 核心数据接口 ====================

/**
 * 书签记录 - 包含所有预处理的增强字段
 */
export interface BookmarkRecord {
  // Chrome原生字段
  id: string
  parentId?: string
  title: string
  url?: string
  dateAdded?: number
  dateGroupModified?: number
  index: number

  // 层级关系预处理字段
  path: string[]
  pathString: string
  pathIds: string[]
  pathIdsString: string
  ancestorIds: string[]
  siblingIds: string[]
  depth: number

  // 搜索优化字段
  titleLower: string
  urlLower?: string
  domain?: string
  keywords: string[]

  // 类型和统计字段
  isFolder: boolean
  childrenCount: number
  bookmarksCount: number
  folderCount: number

  // 扩展属性
  tags: string[]
  category?: string
  notes?: string
  lastVisited?: number
  visitCount?: number

  // 元数据
  createdYear: number
  createdMonth: number
  domainCategory?: string

  // 网页元数据关联
  hasMetadata?: boolean
  metadataUpdatedAt?: number
  metadataSource?: 'chrome' | 'crawler' | 'merged'

  // 爬虫元数据的派生字段
  metaTitleLower?: string
  metaDescriptionLower?: string
  metaKeywordsTokens?: string[]
  metaBoost?: number

  // 虚拟化支持
  flatIndex?: number
  isVisible?: boolean
  sortKey?: string

  // 版本控制
  dataVersion: number
  lastCalculated: number
}

/**
 * 全局统计记录
 */
export interface GlobalStats {
  id: string
  totalBookmarks: number
  totalFolders: number
  totalDomains: number
  lastUpdated: number
  dataVersion: number
}

/**
 * 应用设置记录
 */
export interface AppSettings {
  key: string
  value: unknown
  type: 'string' | 'number' | 'boolean' | 'object'
  description?: string
  updatedAt: number
}

/**
 * 搜索历史记录
 */
export interface SearchHistoryRecord {
  id?: number
  query: string
  results: number
  executionTime: number
  source: 'popup' | 'management' | 'side-panel'
  timestamp: number
}

/**
 * 网站图标缓存记录
 */
export interface FaviconCacheRecord {
  domain: string
  faviconUrl: string
  dataUrl?: string
  size: number
  format: 'ico' | 'png' | 'svg' | 'gif'
  timestamp: number
  lastAccessed: number
  accessCount: number
  expiresAt: number
  quality: 'high' | 'medium' | 'low'
  isDefault: boolean
  loadTime?: number
  bookmarkCount: number
  isPopular: boolean
  retryCount: number
  lastError?: string
  isBlocked: boolean
  updatedAt: number
}

/**
 * 爬虫元数据记录
 */
export interface CrawlMetadataRecord {
  bookmarkId: string // 关联书签ID（主键）
  url: string // 原始URL
  finalUrl?: string // 跟随重定向后的最终URL
  domain?: string

  // 标题与描述
  pageTitle?: string
  description?: string
  keywords?: string

  // Open Graph / 社交元数据
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogSiteName?: string

  // 其他可选信息
  faviconUrl?: string
  contentSummary?: string // 页面摘要（可供LLM使用）

  // 状态与来源
  source: 'chrome' | 'crawler' | 'merged'
  status?: 'success' | 'failed' | 'partial'
  httpStatus?: number // HTTP状态码
  statusGroup?: '2xx' | '3xx' | '4xx' | '5xx' | 'error' // 状态分组（用于统计）
  robotsAllowed?: boolean // 是否允许爬取（robots.txt）
  crawlSuccess?: boolean
  crawlCount?: number
  lastCrawled?: number // 最后爬取时间
  crawlDuration?: number

  // 维护信息
  updatedAt: number // 记录更新时间
  version: string // 记录版本
}

/**
 * 嵌入向量记录
 */
export interface EmbeddingRecord {
  id: string
  bookmarkId: string
  vector: number[]
  model: string
  createdAt: number
}

/**
 * AI 作业记录
 */
export interface AIJobRecord {
  id: string
  type: 'embedding' | 'classification' | 'recommendation'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input: unknown
  output?: unknown
  error?: string
  createdAt: number
  completedAt?: number
}

// ==================== 搜索相关接口 ====================

/**
 * 搜索选项
 */
export interface SearchOptions {
  query: string
  limit?: number
  offset?: number
  includeFolders?: boolean
  includeBookmarks?: boolean
  domains?: string[]
  tags?: string[]
  dateRange?: {
    start: number
    end: number
  }
  sortBy?: 'relevance' | 'date' | 'title' | 'visitCount'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 搜索结果
 */
export interface SearchResult {
  record: BookmarkRecord
  score: number
  matchedFields: string[]
  highlights: Array<{
    field: string
    matches: string[]
  }>
}

// ==================== 批量操作接口 ====================

/**
 * 批量操作选项
 */
export interface BatchOptions {
  batchSize?: number
  delay?: number
  onProgress?: (processed: number, total: number) => void
  onError?: (error: Error, item: unknown) => void
}

/**
 * 批量操作结果
 */
export interface BatchResult<T> {
  success: boolean
  processed: number
  successful: number
  failed: number
  errors: Error[]
  results: T[]
}

// ==================== 数据库健康检查接口 ====================

/**
 * 数据库健康状态
 */
export interface DatabaseHealth {
  isHealthy: boolean
  expectedStores: string[]
  existingStores: string[]
  missingStores: string[]
  extraStores: string[]
  lastCheck: number
  errors: string[]
}

/**
 * 数据库统计信息
 */
export interface DatabaseStats {
  bookmarkCount: number
  faviconCount: number
  searchHistoryCount: number
  settingsCount: number
  crawlMetadataCount: number
  totalSize: number
  indexSize: number
  lastOptimized: number
}
