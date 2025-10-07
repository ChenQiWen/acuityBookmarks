/**
 * IndexedDB统一Schema定义
 * 所有IndexedDB相关的类型定义和常量
 * 确保Service Worker和前端使用相同的数据结构
 */

// ==================== 数据库配置 ====================
export const DB_CONFIG = {
  NAME: 'AcuityBookmarksDB',
  VERSION: 4,

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
  path: string[] // 名称路径 ['Root', 'Folder1', 'BookmarkName']
  pathString: string // 路径字符串 'Root / Folder1 / BookmarkName'
  pathIds: string[] // ID路径 ['0', '1', '123']
  pathIdsString: string // ID路径字符串 '0 / 1 / 123'
  ancestorIds: string[] // 祖先ID列表 ['0', '1']
  siblingIds: string[] // 兄弟节点ID列表
  depth: number // 层级深度

  // 搜索优化字段
  titleLower: string // 小写标题(用于搜索)
  urlLower?: string // 小写URL
  domain?: string // 域名
  keywords: string[] // 关键词列表

  // 类型和统计字段
  isFolder: boolean // 是否为文件夹
  childrenCount: number // 直接子节点数量
  bookmarksCount: number // 书签数量(递归)
  folderCount: number // 文件夹数量(递归)

  // 扩展属性
  tags: string[] // 用户标签
  category?: string // AI分类
  notes?: string // 用户备注
  lastVisited?: number // 最后访问时间
  visitCount?: number // 访问次数

  // 元数据
  createdYear: number // 创建年份
  createdMonth: number // 创建月份
  domainCategory?: string // 域名类别

  // 网页元数据关联（供 LLM 使用）
  hasMetadata?: boolean // 是否存在爬虫或Chrome页面信息缓存
  metadataUpdatedAt?: number // 元数据最后更新时间
  metadataSource?: 'chrome' | 'crawler' | 'merged' // 元数据来源

  // 爬虫元数据的派生字段（用于本地快速检索）
  metaTitleLower?: string // 规范化标题
  metaDescriptionLower?: string // 规范化描述
  metaKeywordsTokens?: string[] // 关键词分词（lowercase）
  metaBoost?: number // 评分加成系数（0.0~2.0）

  // 虚拟化支持
  flatIndex: number // 扁平化索引
  isVisible: boolean // 是否可见
  sortKey: string // 排序键

  // 数据版本
  dataVersion: string // 数据版本号
  lastCalculated: number // 最后计算时间
}

/**
 * 全局统计信息
 */
export interface GlobalStats {
  // 基础统计
  totalBookmarks: number // 总书签数(不含文件夹)
  totalFolders: number // 总文件夹数
  totalNodes: number // 总节点数
  maxDepth: number // 最大深度

  // 域名统计
  totalDomains: number // 总域名数
  topDomains: DomainStat[] // 热门域名TOP10

  // 时间分布
  creationTimeline: Map<string, number> // 按年月的创建统计

  // 分类分布
  categoryDistribution: Map<string, number> // AI分类分布

  // 质量分析
  duplicateUrls: number // 重复URL数量
  emptyFolders: number // 空文件夹数量
  brokenLinks: number // 失效链接数量

  // 内存使用情况
  memoryUsage: {
    nodeCount: number
    indexCount: number
    estimatedBytes: number
  }

  // 元数据
  lastUpdated: number // 最后更新时间
  version: string // 数据版本
  chromeVersion?: string // Chrome版本
}

/**
 * 域名统计
 */
export interface DomainStat {
  domain: string
  count: number
  percentage: number
  category?: string
}

/**
 * 应用设置
 */
export interface AppSettings {
  key: string
  value: unknown
  type: 'string' | 'number' | 'boolean' | 'object'
  description?: string
  updatedAt: number
  userId?: string
}

/**
 * 搜索历史记录
 */
export interface SearchHistoryRecord {
  id?: number // 自动递增ID
  query: string // 搜索查询
  results: number // 结果数量
  timestamp: number // 搜索时间
  executionTime: number // 执行时间(ms)
  source: 'popup' | 'management' | 'side-panel' // 搜索来源
}

// ==================== 图标缓存相关 ====================

/**
 * 网站图标缓存记录
 */
export interface FaviconCacheRecord {
  domain: string // 主键：域名
  faviconUrl: string // 图标URL
  faviconData?: string // Base64图标数据(可选)
  size: number // 图标尺寸
  format: 'ico' | 'png' | 'svg' | 'gif' // 图标格式

  // 缓存信息
  timestamp: number // 缓存时间
  lastAccessed: number // 最后访问时间
  accessCount: number // 访问次数
  expiresAt: number // 过期时间

  // 质量信息
  quality: 'high' | 'medium' | 'low' // 图标质量
  isDefault: boolean // 是否为默认图标
  loadTime?: number // 加载耗时

  // 关联信息
  bookmarkCount: number // 该域名的书签数量
  isPopular: boolean // 是否为热门域名(书签数≥5)

  // 错误处理
  retryCount: number // 重试次数
  lastError?: string // 最后错误信息
  isBlocked: boolean // 是否被阻止访问
}

/**
 * 图标统计信息
 */
export interface FaviconStatsRecord {
  key: string // 统计键
  value: number | string | object // 统计值
  updatedAt: number // 更新时间
}

// ==================== 网页爬虫/页面元数据相关 ====================

/**
 * 网页元数据缓存记录（爬虫/Chrome页面信息合并）
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

// ==================== AI 嵌入与作业 ====================

/**
 * 书签嵌入向量记录
 */
export interface EmbeddingRecord {
  bookmarkId: string // 关联书签ID（主键）
  url?: string // 书签URL（便于调试）
  domain?: string // 域名（索引）
  title?: string // 标题（可选）
  model: string // 模型名称
  vector: number[] // 向量数据
  dimension: number // 维度
  updatedAt: number // 更新时间
}

/**
 * AI 作业记录
 */
export interface AIJobRecord {
  id: string // 作业ID（主键）
  type: string // 作业类型，如 'GENERATE_EMBEDDINGS'
  status: 'pending' | 'running' | 'done' | 'failed'
  params?: Record<string, unknown> // 参数
  result?: Record<string, unknown> // 结果
  error?: string // 错误信息
  attempts?: number // 重试次数
  createdAt: number // 创建时间
  updatedAt: number // 更新时间
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  limit?: number
  includeUrl?: boolean
  includeDomain?: boolean
  includeKeywords?: boolean
  includeTags?: boolean
  includeContent?: boolean
  sortBy?: 'relevance' | 'title' | 'dateAdded' | 'visitCount'
  minScore?: number
  exactMatch?: boolean
  fuzzyMatch?: boolean
}

/**
 * 搜索结果
 */
export interface SearchResult {
  bookmark: BookmarkRecord
  score: number
  matchedFields: string[]
  highlights: Record<string, string[]>
}

// ==================== 预处理结果类型 ====================

/**
 * 书签预处理产生的元数据
 */
export interface TransformMetadata {
  originalDataHash: string
  processedAt: number
  version: string
  processingTime: number

  // 性能指标（可选但在当前实现中会填充）
  cacheHitRate?: number
  indexBuildTime?: number
  performance?: {
    transformTime: number
    indexTime: number
    cleanupTime: number
    searchTime: number
    virtualTime: number
    analyticsTime: number
  }
}

/**
 * 书签预处理结果结构
 */
export interface TransformResult {
  bookmarks: BookmarkRecord[]
  stats: GlobalStats
  metadata: TransformMetadata
}

// ==================== 数据库操作相关 ====================

/**
 * 数据库健康状态
 */
export interface DatabaseHealth {
  isHealthy: boolean
  version: number
  expectedStores: string[]
  existingStores: string[]
  missingStores: string[]
  extraStores: string[]
  lastCheck: number
  errors: string[]
}

/**
 * 数据库统计
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

/**
 * 批量操作选项
 */
export interface BatchOptions {
  batchSize?: number
  maxConcurrency?: number
  progressCallback?: (progress: number, total: number) => void
  errorCallback?: (error: Error, item: unknown) => void
}

// ==================== 索引配置 ====================

/**
 * IndexedDB表索引配置
 */
export const INDEX_CONFIG = {
  [DB_CONFIG.STORES.BOOKMARKS]: [
    { name: 'parentId', keyPath: 'parentId', options: { unique: false } },
    { name: 'url', keyPath: 'url', options: { unique: false } },
    { name: 'domain', keyPath: 'domain', options: { unique: false } },
    { name: 'titleLower', keyPath: 'titleLower', options: { unique: false } },
    { name: 'depth', keyPath: 'depth', options: { unique: false } },
    {
      name: 'pathIds',
      keyPath: 'pathIds',
      options: { unique: false, multiEntry: true }
    },
    {
      name: 'keywords',
      keyPath: 'keywords',
      options: { unique: false, multiEntry: true }
    },
    {
      name: 'tags',
      keyPath: 'tags',
      options: { unique: false, multiEntry: true }
    },
    { name: 'dateAdded', keyPath: 'dateAdded', options: { unique: false } },
    { name: 'isFolder', keyPath: 'isFolder', options: { unique: false } },
    { name: 'category', keyPath: 'category', options: { unique: false } },
    { name: 'domain', keyPath: 'domain', options: { unique: false } },
    { name: 'createdYear', keyPath: 'createdYear', options: { unique: false } },
    { name: 'visitCount', keyPath: 'visitCount', options: { unique: false } }
  ],

  [DB_CONFIG.STORES.SEARCH_HISTORY]: [
    { name: 'query', keyPath: 'query', options: { unique: false } },
    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
    { name: 'source', keyPath: 'source', options: { unique: false } }
  ],

  [DB_CONFIG.STORES.SETTINGS]: [
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
    { name: 'type', keyPath: 'type', options: { unique: false } }
  ],

  [DB_CONFIG.STORES.FAVICON_CACHE]: [
    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
    {
      name: 'lastAccessed',
      keyPath: 'lastAccessed',
      options: { unique: false }
    },
    { name: 'accessCount', keyPath: 'accessCount', options: { unique: false } },
    {
      name: 'bookmarkCount',
      keyPath: 'bookmarkCount',
      options: { unique: false }
    },
    { name: 'isPopular', keyPath: 'isPopular', options: { unique: false } },
    { name: 'quality', keyPath: 'quality', options: { unique: false } },
    { name: 'expiresAt', keyPath: 'expiresAt', options: { unique: false } }
  ],

  [DB_CONFIG.STORES.FAVICON_STATS]: [
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } }
  ],

  [DB_CONFIG.STORES.CRAWL_METADATA]: [
    { name: 'bookmarkId', keyPath: 'bookmarkId', options: { unique: true } },
    { name: 'domain', keyPath: 'domain', options: { unique: false } },
    { name: 'source', keyPath: 'source', options: { unique: false } },
    { name: 'httpStatus', keyPath: 'httpStatus', options: { unique: false } },
    { name: 'statusGroup', keyPath: 'statusGroup', options: { unique: false } },
    { name: 'lastCrawled', keyPath: 'lastCrawled', options: { unique: false } },
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } }
  ],

  [DB_CONFIG.STORES.EMBEDDINGS]: [
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
    { name: 'domain', keyPath: 'domain', options: { unique: false } }
  ],

  [DB_CONFIG.STORES.AI_JOBS]: [
    { name: 'status', keyPath: 'status', options: { unique: false } },
    { name: 'type', keyPath: 'type', options: { unique: false } },
    { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } }
  ]
} as const

// ==================== 导出类型别名 ====================

export type StoreNames = keyof typeof DB_CONFIG.STORES
export type StoreName = (typeof DB_CONFIG.STORES)[StoreNames]

// ==================== 常量导出 ====================

export { DB_CONFIG as DATABASE_CONFIG }
export const CURRENT_DATA_VERSION = '2.0.0'
export const FAVICON_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天
export const POPULAR_DOMAIN_THRESHOLD = 5 // 5个书签以上算热门域名
