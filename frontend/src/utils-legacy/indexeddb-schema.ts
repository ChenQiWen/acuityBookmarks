/**
 * IndexedDB统一Schema定义
 * 所有IndexedDB相关的类型定义和常量
 * 确保Service Worker和前端使用相同的数据结构
 */

// ==================== 数据库配置 ====================
/**
 * IndexedDB 数据库配置
 * - NAME：数据库名称
 * - VERSION：架构版本（升级触发 onupgradeneeded 与表/索引迁移）
 * - STORES：各存储表名常量（用于创建与事务访问）
 */
export const DB_CONFIG = {
  NAME: 'AcuityBookmarksDB',
  VERSION: 8, // 升级版本以强制触发 onupgradeneeded

  // 存储表名
  STORES: {
    BOOKMARKS: 'bookmarks', // 书签与文件夹统一记录（核心表）
    GLOBAL_STATS: 'globalStats', // 全局统计快照/维度项（键值存储）
    SETTINGS: 'settings', // 应用设置项（类型安全键值）
    SEARCH_HISTORY: 'searchHistory', // 搜索历史记录与性能数据
    FAVICON_CACHE: 'faviconCache', // 网站图标缓存与质量标注
    FAVICON_STATS: 'faviconStats', // 图标相关统计项（键值）
    CRAWL_METADATA: 'crawlMetadata', // 页面/爬虫元数据缓存
    EMBEDDINGS: 'embeddings', // 书签嵌入向量（搜索/推荐）
    AI_JOBS: 'ai_jobs' // AI 作业队列（生成嵌入等）
  } as const
} as const

// ==================== 核心数据接口 ====================

/**
 * 书签记录 - 包含所有预处理的增强字段
 */
/**
 * 书签记录（统一节点：书签 + 文件夹）
 * 目的：在 IndexedDB 中保存所有与检索、统计、展示相关的数据。
 * 字段分组：
 * - Chrome原生：id, parentId, title, url, dateAdded, dateGroupModified, index
 * - 层级关系：path, pathString, pathIds, pathIdsString, ancestorIds, siblingIds, depth
 * - 搜索优化：titleLower, urlLower, domain, keywords
 * - 类型与统计：isFolder, childrenCount, bookmarksCount, folderCount
 * - 扩展属性：tags, category, notes, lastVisited, visitCount
 * - 时间/分类：createdYear, createdMonth, domainCategory
 * - 元数据关联：hasMetadata, metadataUpdatedAt, metadataSource
 * - 爬虫派生：metaTitleLower, metaDescriptionLower, metaKeywordsTokens, metaBoost
 * - 虚拟化：flatIndex, isVisible, sortKey
 * - 版本：dataVersion, lastCalculated
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
/**
 * 全局统计信息快照（聚合维度数据）
 * 用途：展示概览、支持分析与健康检查。
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
/** 域名统计条目（TOP、分布等） */
export interface DomainStat {
  domain: string
  count: number
  percentage: number
  category?: string
}

/**
 * 应用设置
 */
/** 应用设置项（类型安全键值） */
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
/** 搜索历史记录与性能数据 */
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
/** 网站图标缓存记录（含质量与使用信息） */
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
/** 图标统计键值记录 */
export interface FaviconStatsRecord {
  key: string // 统计键
  value: number | string | object // 统计值
  updatedAt: number // 更新时间
}

// ==================== 网页爬虫/页面元数据相关 ====================

/**
 * 网页元数据缓存记录（爬虫/Chrome页面信息合并）
 */
/**
 * 网页元数据缓存记录（爬虫/Chrome页面信息合并）
 * 用途：搜索增强、LLM 摘要与推荐基础。
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
/** 书签嵌入向量记录（搜索/推荐） */
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
/** AI 作业记录（生成嵌入等后台任务） */
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
/** 搜索选项（控制候选集、排序与匹配策略） */
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
/** 搜索结果（含得分与高亮） */
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
/** 书签预处理产生的元数据与性能指标 */
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
/** 书签预处理的输出（数据 + 统计 + 元信息） */
export interface TransformResult {
  bookmarks: BookmarkRecord[]
  stats: GlobalStats
  metadata: TransformMetadata
}

// ==================== 数据库操作相关 ====================

/**
 * 数据库健康状态
 */
/** 数据库健康状态（结构一致性与错误） */
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
/** 数据库统计（容量与对象数） */
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
/** 批量操作选项（批大小、并发与回调） */
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
/**
 * IndexedDB 表索引配置
 * 作用：为常用查询提供 O(logN) 或前缀检索能力；多值字段使用 multiEntry。
 * 注意：复合索引如 `parentId_index` 用于保持子节点读取顺序。
 */
export const INDEX_CONFIG = {
  [DB_CONFIG.STORES.BOOKMARKS]: [
    { name: 'parentId', keyPath: 'parentId', options: { unique: false } }, // 父节点ID索引（用于查询子节点）
    { name: 'url', keyPath: 'url', options: { unique: false } }, // URL索引（用于唯一约束）
    { name: 'urlLower', keyPath: 'urlLower', options: { unique: false } }, // 小写URL索引（用于模糊搜索）
    { name: 'domain', keyPath: 'domain', options: { unique: false } }, // 域名索引（用于查询所有子域名）
    { name: 'titleLower', keyPath: 'titleLower', options: { unique: false } }, // 小写标题索引（用于模糊搜索）
    {
      // 父节点ID索引（用于查询子节点）
      name: 'parentId_index',
      keyPath: ['parentId', 'index'],
      options: { unique: false }
    },
    {
      // 路径ID索引（用于快速查询子节点）
      name: 'pathIds',
      keyPath: 'pathIds',
      options: { unique: false, multiEntry: true }
    },
    {
      // 关键词索引（多值字段）
      name: 'keywords',
      keyPath: 'keywords',
      options: { unique: false, multiEntry: true }
    },
    {
      // 标签索引（多值字段）
      name: 'tags',
      keyPath: 'tags',
      options: { unique: false, multiEntry: true }
    },
    { name: 'dateAdded', keyPath: 'dateAdded', options: { unique: false } } // 添加时间索引（用于按时间排序）
    // 精简低频/冗余索引：移除 depth, isFolder, category, createdYear, visitCount, 重复的 domain
  ],

  [DB_CONFIG.STORES.SEARCH_HISTORY]: [
    { name: 'query', keyPath: 'query', options: { unique: false } }, // 查询字符串索引（用于模糊搜索）
    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }, // 时间戳索引（用于按时间排序）
    { name: 'source', keyPath: 'source', options: { unique: false } } // 来源索引（用于区分不同搜索源）
  ],

  [DB_CONFIG.STORES.SETTINGS]: [
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } }, // 更新时间索引（用于按更新时间排序）
    { name: 'type', keyPath: 'type', options: { unique: false } } // 类型索引（用于查询不同配置项）
  ],

  [DB_CONFIG.STORES.FAVICON_CACHE]: [
    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }, // 缓存时间戳索引（用于按缓存时间排序）
    {
      name: 'lastAccessed',
      keyPath: 'lastAccessed',
      options: { unique: false }
    }, // 最后访问时间索引（用于按访问时间排序）
    { name: 'accessCount', keyPath: 'accessCount', options: { unique: false } }, // 访问次数索引（用于按访问频率排序）
    {
      name: 'bookmarkCount',
      keyPath: 'bookmarkCount',
      options: { unique: false }
    }, // 关联书签数索引（用于按关联书签数排序）
    { name: 'isPopular', keyPath: 'isPopular', options: { unique: false } }, // 受欢迎索引（用于查询受欢迎图标）
    { name: 'quality', keyPath: 'quality', options: { unique: false } }, // 质量索引（用于按图标质量排序）
    { name: 'expiresAt', keyPath: 'expiresAt', options: { unique: false } } // 过期时间索引（用于按过期时间排序）
  ],

  [DB_CONFIG.STORES.FAVICON_STATS]: [
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } } // 更新时间索引（用于按更新时间排序）
  ],

  [DB_CONFIG.STORES.CRAWL_METADATA]: [
    { name: 'bookmarkId', keyPath: 'bookmarkId', options: { unique: true } }, // 书签ID索引（用于唯一约束）
    { name: 'domain', keyPath: 'domain', options: { unique: false } }, // 域名索引（用于查询所有子域名）
    { name: 'source', keyPath: 'source', options: { unique: false } }, // 来源索引（用于区分不同搜索源）
    { name: 'httpStatus', keyPath: 'httpStatus', options: { unique: false } }, // HTTP状态码索引（用于按状态码分类）
    { name: 'statusGroup', keyPath: 'statusGroup', options: { unique: false } }, // 状态组索引（用于按状态码分组）
    { name: 'lastCrawled', keyPath: 'lastCrawled', options: { unique: false } }, // 最后爬取时间索引（用于按爬取时间排序）
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } } // 更新时间索引（用于按更新时间排序）
  ],

  [DB_CONFIG.STORES.EMBEDDINGS]: [
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } }, // 更新时间索引（用于按更新时间排序）
    { name: 'domain', keyPath: 'domain', options: { unique: false } } // 域名索引（用于查询所有子域名）
  ],

  [DB_CONFIG.STORES.AI_JOBS]: [
    { name: 'status', keyPath: 'status', options: { unique: false } }, // 状态索引（用于查询不同状态的任务）
    { name: 'type', keyPath: 'type', options: { unique: false } }, // 类型索引（用于查询不同类型的任务）
    { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } }, // 创建时间索引（用于按创建时间排序）
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } } // 更新时间索引（用于按更新时间排序）
  ]
} as const

// ==================== 导出类型别名 ====================

export type StoreNames = keyof typeof DB_CONFIG.STORES
export type StoreName = (typeof DB_CONFIG.STORES)[StoreNames]

// ==================== 常量导出 ====================

export { DB_CONFIG as DATABASE_CONFIG }
export const CURRENT_DATA_VERSION = '2.0.0' // 当前数据库版本
export const FAVICON_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天 缓存时间
export const POPULAR_DOMAIN_THRESHOLD = 5 // 5个书签以上算热门域名 热门域名阈值
