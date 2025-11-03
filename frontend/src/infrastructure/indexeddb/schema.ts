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
  VERSION: 11, // 升级：添加 isDuplicate 重复书签标记

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
    IS_INVALID: 'isInvalid',
    IS_DUPLICATE: 'isDuplicate',
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
  /** 主键 */
  // Chrome原生字段
  id: string
  /** 父级ID */
  parentId?: string
  /** 标题 */
  title: string
  /** URL */
  url?: string
  /** 创建时间 */
  dateAdded?: number
  /** 修改时间 */
  dateGroupModified?: number
  /** 索引 */
  index: number

  // 层级关系预处理字段
  /** 路径 */
  path: string[]
  /** 路径字符串 */
  pathString: string
  /** 路径ID */
  pathIds: string[]
  /** 路径ID字符串 */
  pathIdsString: string
  /** 祖先ID */
  ancestorIds: string[]
  /** 兄弟ID */
  siblingIds: string[]
  /** 深度 */
  depth: number

  // 筛选优化字段
  /** 标题小写 */
  titleLower: string
  /** URL小写 */
  urlLower?: string
  domain?: string
  /** 关键词 */
  keywords: string[]

  // 类型和统计字段
  isFolder: boolean
  /** 子级数量 */
  childrenCount: number
  /** 书签数量 */
  bookmarksCount: number
  /** 文件夹数量 */
  folderCount: number

  // 扩展属性
  /** 标签 */
  tags: string[]
  /** 健康标签集合，如 duplicate/invalid */
  healthTags: string[]
  /** 健康标签元数据 */
  /** 每个健康标签的元数据（检测时间、来源等） */
  healthMetadata?: Array<{
    tag: 'duplicate' | 'invalid'
    detectedAt: number
    source: 'worker' | 'user' | 'imported'
    notes?: string
  }>
  /** 失效书签标记（URL格式错误或404等），用于快速筛选和跳过爬取 */
  isInvalid?: boolean
  /** 失效原因：url_format（URL格式错误）| http_error（404/500等）| unknown */
  invalidReason?: 'url_format' | 'http_error' | 'unknown'
  /** HTTP 状态码（如果是网络错误导致的失效） */
  httpStatus?: number
  /** 重复书签标记（URL完全相同），用于快速筛选 */
  isDuplicate?: boolean
  /** 原始书签ID（如果这是重复书签，指向第一个出现的原始书签） */
  duplicateOf?: string
  /** 分类 */
  category?: string
  /** 备注 */
  notes?: string
  /** 最后访问时间 */
  lastVisited?: number
  /** 访问次数 */
  visitCount?: number

  // 收藏功能
  /** 是否已收藏 */
  isFavorite?: boolean
  /** 收藏顺序（用于排序，数字越小越靠前） */
  favoriteOrder?: number
  /** 收藏时间戳 */
  favoritedAt?: number

  // 元数据
  /** 创建年份 */
  createdYear: number
  /** 创建月份 */
  createdMonth: number
  /** 域名分类 */
  domainCategory?: string

  // 网页元数据关联
  hasMetadata?: boolean
  /** 元数据更新时间 */
  metadataUpdatedAt?: number
  /** 元数据来源 */
  metadataSource?: 'chrome' | 'crawler' | 'merged'

  // 爬虫元数据的派生字段
  /** 元数据标题小写 */
  metaTitleLower?: string
  /** 元数据描述小写 */
  metaDescriptionLower?: string
  /** 元数据关键词小写 */
  metaKeywordsTokens?: string[]
  /** 元数据权重 */
  metaBoost?: number

  // 虚拟化支持
  /** 虚拟化索引 */
  flatIndex?: number
  /** 是否可见 */
  isVisible?: boolean
  /** 排序键 */
  sortKey?: string

  // 版本控制
  dataVersion: number
  /** 最后计算时间 */
  lastCalculated: number
}

/**
 * 全局统计记录
 */
export interface GlobalStats {
  /** 主键 */
  key: string
  /** 兼容旧版本字段 */
  id?: string
  /** 书签数量 */
  totalBookmarks: number
  /** 文件夹数量 */
  totalFolders: number
  totalDomains: number
  /** 最后更新时间 */
  lastUpdated: number
  /** 数据版本 */
  dataVersion: number
}

/**
 * 应用设置记录
 */
export interface AppSettings {
  /** 主键 */
  key: string
  /** 值 */
  value: unknown
  type: 'string' | 'number' | 'boolean' | 'object'
  description?: string
  /** 更新时间 */
  updatedAt: number
}

/**
 * 筛选历史记录
 */
export interface SearchHistoryRecord {
  /** 主键 */
  id?: number
  /** 查询关键词 */
  query: string
  /** 结果数量 */
  results: number
  /** 执行时间 */
  executionTime: number
  /** 来源 */
  source: 'popup' | 'management' | 'side-panel'
  /** 时间戳 */
  timestamp: number
}

/**
 * 网站图标缓存记录
 */
export interface FaviconCacheRecord {
  /** 域名 */
  domain: string
  /** 图标URL */
  faviconUrl: string
  /** 数据URL */
  dataUrl?: string
  /** 大小 */
  size: number
  /** 格式 */
  format: 'ico' | 'png' | 'svg' | 'gif'
  /** 时间戳 */
  timestamp: number
  /** 最后访问时间 */
  lastAccessed: number
  /** 访问次数 */
  accessCount: number
  /** 过期时间 */
  expiresAt: number
  /** 质量 */
  quality: 'high' | 'medium' | 'low'
  /** 是否默认 */
  isDefault: boolean
  /** 加载时间 */
  loadTime?: number
  /** 书签数量 */
  bookmarkCount: number
  /** 是否流行 */
  isPopular: boolean
  /** 重试次数 */
  retryCount: number
  /** 最后错误 */
  lastError?: string
  /** 是否阻塞 */
  isBlocked: boolean
  /** 更新时间 */
  updatedAt: number
}

/**
 * 爬虫元数据记录
 */
export interface CrawlMetadataRecord {
  /** 关联书签ID（主键） */
  bookmarkId: string
  /** 原始URL */
  url: string
  /** 跟随重定向后的最终URL */
  finalUrl?: string
  /** 域名 */
  domain?: string
  /** 页面标题 */
  pageTitle?: string
  /** 页面描述 */
  description?: string
  /** 页面关键词 */
  keywords?: string
  /** Open Graph / 社交元数据 */
  ogTitle?: string
  /** Open Graph / 社交元数据描述 */
  ogDescription?: string
  /** Open Graph / 社交元数据图像 */
  ogImage?: string
  /** Open Graph / 社交元数据站点名称 */
  ogSiteName?: string
  /** 其他可选信息 */
  faviconUrl?: string
  /** 页面摘要（可供LLM使用） */
  contentSummary?: string
  /** 状态与来源 */
  source: 'chrome' | 'crawler' | 'merged'
  /** 状态 */
  status?: 'success' | 'failed' | 'partial'
  /** HTTP状态码 */
  httpStatus?: number
  /** 状态分组（用于统计） */
  statusGroup?: '2xx' | '3xx' | '4xx' | '5xx' | 'error'
  /** 是否允许爬取（robots.txt） */
  robotsAllowed?: boolean
  /** 爬取成功 */
  crawlSuccess?: boolean
  /** 爬取次数 */
  crawlCount?: number
  /** 最后爬取时间 */
  lastCrawled?: number
  /** 爬取耗时 */
  crawlDuration?: number

  // 维护信息
  /** 记录更新时间 */
  updatedAt: number
  /** 记录版本 */
  version: string
}

/**
 * 嵌入向量记录
 */
export interface EmbeddingRecord {
  /** 主键 */
  id: string
  /** 关联书签ID */
  bookmarkId: string
  /** 向量 */
  vector: number[]
  /** 模型 */
  model: string
  /** 创建时间 */
  createdAt: number
}

/**
 * AI 作业记录
 */
export interface AIJobRecord {
  /** 主键 */
  id: string
  /** 作业类型 */
  type: 'embedding' | 'classification' | 'recommendation'
  /** 作业状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** 作业输入 */
  input: unknown
  /** 作业输出 */
  output?: unknown
  /** 作业错误 */
  error?: string
  /** 创建时间 */
  createdAt: number
  /** 完成时间 */
  completedAt?: number
}

// ==================== 筛选相关接口 ====================

/**
 * 筛选选项
 */
export interface SearchOptions {
  /** 查询关键词 */
  query: string
  /** 限制结果数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 包含文件夹 */
  includeFolders?: boolean
  /** 包含书签 */
  includeBookmarks?: boolean
  /** 域名 */
  domains?: string[]
  /** 标签 */
  tags?: string[]
  /** 日期范围 */
  dateRange?: {
    start: number
    end: number
  }
  /** 排序字段 */
  sortBy?: 'relevance' | 'date' | 'title' | 'visitCount'
  /** 排序顺序 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 筛选结果
 */
export interface SearchResult {
  /** 书签记录 */
  record: BookmarkRecord
  /** 匹配分数 */
  score: number
  /** 匹配字段 */
  matchedFields: string[]
  /** 路径字符串 */
  pathString?: string
  highlights: Array<{
    field: string
    /** 匹配内容 */
    matches: string[]
  }>
}

// ==================== 批量操作接口 ====================

/**
 * 批量操作选项
 */
export interface BatchOptions {
  /** 批量大小 */
  batchSize?: number
  /** 延迟时间 */
  delay?: number
  /** 进度回调 */
  onProgress?: (processed: number, total: number) => void
  /** 错误回调 */
  onError?: (error: Error, item: unknown) => void
}

/**
 * 批量操作结果
 */
export interface BatchResult<T> {
  /** 是否成功 */
  success: boolean
  /** 处理数量 */
  processed: number
  /** 成功数量 */
  successful: number
  /** 失败数量 */
  failed: number
  /** 错误列表 */
  errors: Error[]
  /** 结果列表 */
  results: T[]
}

// ==================== 数据库健康检查接口 ====================

/**
 * 数据库健康状态
 */
export interface DatabaseHealth {
  /** 是否健康 */
  isHealthy: boolean
  /** 预期存储 */
  expectedStores: string[]
  /** 现有存储 */
  existingStores: string[]
  /** 缺失存储 */
  missingStores: string[]
  /** 额外存储 */
  extraStores: string[]
  /** 最后检查时间 */
  lastCheck: number
  /** 错误列表 */
  errors: string[]
}

/**
 * 数据库统计信息
 */
export interface DatabaseStats {
  /** 书签数量 */
  bookmarkCount: number
  /** 图标数量 */
  faviconCount: number
  /** 筛选历史记录数量 */
  searchHistoryCount: number
  /** 设置数量 */
  settingsCount: number
  /** 爬虫元数据数量 */
  crawlMetadataCount: number
  /** 总大小 */
  totalSize: number
  /** 索引大小 */
  indexSize: number
  /** 最后优化时间 */
  lastOptimized: number
}
