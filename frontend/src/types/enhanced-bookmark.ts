/**
 * 增强书签数据结构定义
 * 一次遍历，全面预计算的核心数据类型
 */

// === 增强书签节点（核心数据结构）===
export interface SuperEnhancedBookmarkNode {
    // === Chrome API核心字段（精简保留）===
    id: string
    title: string
    url?: string                    // 书签才有，文件夹为undefined
    parentId?: string
    children?: SuperEnhancedBookmarkNode[]
    index?: number
    dateAdded?: number

    // === 统计预计算字段 ===
    bookmarkCount: number           // 子树下书签总数
    folderCount: number            // 子树下文件夹总数
    totalCount: number             // 子树下总节点数
    depth: number                  // 在树中的深度级别
    maxSubDepth: number            // 子树的最大深度

    // === 路径和关系预计算 ===
    path: string[]                 // 从根到该节点的完整路径（基于名称）
    pathString: string             // 路径字符串形式 "Root/Folder/Subfolder"
    pathIds: string[]              // 从根到该节点的完整路径（基于ID）
    pathIdsString: string          // 基于ID的路径字符串形式 "0/1/2"
    ancestorIds: string[]          // 所有祖先节点的ID列表
    siblingIds: string[]           // 所有同级节点的ID列表

    // === 搜索索引预计算 ===
    domain?: string                // URL的域名部分
    normalizedTitle: string        // 标准化后的标题（小写、去特殊字符）
    searchKeywords: string[]       // 提取的搜索关键词
    titleWords: string[]           // 标题分词结果

    // === 清理检测预计算 ===
    duplicateUrlIds: string[]      // 相同URL的其他节点ID
    duplicateTitleIds: string[]    // 相似标题的其他节点ID
    hasInvalidUrl: boolean         // URL格式是否有效
    isEmpty: boolean               // 文件夹是否为空

    // === 虚拟化预计算 ===
    flatIndex: number              // 在扁平化列表中的索引位置
    isVisible: boolean             // 在当前展开状态下是否可见
    sortKey: string                // 排序键（名称+类型）

    // === 分析数据预计算 ===
    createdYear: number            // 创建年份
    createdMonth: number           // 创建月份  
    domainCategory?: string        // 域名分类（social、tool、doc等）

    // === 元数据 ===
    dataVersion: string            // 数据处理版本
    lastCalculated: number         // 计算时间戳
}

// === 虚拟化树节点（用于虚拟滚动）===
export interface FlatTreeNode {
    id: string
    title: string
    url?: string
    depth: number
    index: number
    isFolder: boolean
    isExpanded: boolean
    parentId?: string
    originalNode: SuperEnhancedBookmarkNode
}

// === 超级书签缓存（全局缓存对象）===
export interface SuperBookmarkCache {
    // === 原始数据 ===
    data: SuperEnhancedBookmarkNode[]

    // === 快速查找索引 ===
    nodeById: Map<string, SuperEnhancedBookmarkNode>       // ID → 节点
    nodesByUrl: Map<string, SuperEnhancedBookmarkNode[]>   // URL → 节点列表
    nodesByDomain: Map<string, SuperEnhancedBookmarkNode[]> // 域名 → 节点列表
    nodesByTitle: Map<string, SuperEnhancedBookmarkNode[]>  // 标题 → 节点列表

    // === 关系映射索引 ===
    childrenById: Map<string, string[]>                    // 父ID → 子ID列表
    parentById: Map<string, string>                        // 子ID → 父ID
    siblingsById: Map<string, string[]>                    // 节点ID → 同级ID列表

    // === 搜索索引 ===
    flatBookmarkList: SuperEnhancedBookmarkNode[]         // 扁平化书签列表
    searchIndex: Map<string, string[]>                     // 关键词 → 节点ID列表
    domainStats: Map<string, number>                       // 域名 → 书签数量

    // === 清理检测索引 ===
    duplicateUrls: Map<string, string[]>                   // URL → 重复节点ID列表
    duplicateTitles: Map<string, string[]>                 // 标题 → 重复节点ID列表
    invalidUrlIds: string[]                                // 无效URL的节点ID列表
    emptyFolderIds: string[]                               // 空文件夹的节点ID列表

    // === 虚拟化索引 ===
    flattenedTree: FlatTreeNode[]                          // 虚拟滚动用的扁平结构
    visibilityMap: Map<string, boolean>                    // 节点ID → 可见性

    // === 全局统计分析 ===
    globalStats: {
        totalBookmarks: number
        totalFolders: number
        maxDepth: number
        avgDepth: number
        topDomains: Array<{ domain: string; count: number }>
        creationTimeline: Map<string, number>                // "YYYY-MM" → 数量
        categoryDistribution: Map<string, number>            // 分类 → 数量
        memoryUsage: {
            nodeCount: number
            indexCount: number
            estimatedBytes: number
        }
    }

    // === 缓存元数据 ===
    metadata: {
        originalDataHash: string       // Chrome原始数据的哈希值
        processedAt: number           // 处理时间戳
        version: string               // 处理器版本号
        processingTime: number        // 处理耗时(ms)
        cacheHitRate: number         // 缓存命中率
        indexBuildTime: number       // 索引构建耗时(ms)

        // 存储优化相关字段
        compressed?: boolean          // 是否为压缩版本
        lightweight?: boolean         // 是否为轻量版本
        minimal?: boolean            // 是否为最小版本
        originalSize?: number        // 原始数据大小
        totalNodes?: number          // 总节点数（用于最小版本）

        // 性能统计
        performance: {
            transformTime: number       // 数据转换耗时
            indexTime: number          // 索引构建耗时
            cleanupTime: number        // 清理检测耗时
            searchTime: number         // 搜索索引耗时
            virtualTime: number        // 虚拟化预处理耗时
            analyticsTime: number      // 分析统计耗时
        }
    }
}

// === 域名分类枚举 ===
export enum DomainCategory {
    Development = 'development',    // 开发相关：github.com, stackoverflow.com
    Documentation = 'documentation', // 文档相关：docs.google.com, developer.mozilla.org
    Social = 'social',             // 社交媒体：twitter.com, linkedin.com
    Entertainment = 'entertainment', // 娱乐：youtube.com, netflix.com
    Shopping = 'shopping',         // 购物：amazon.com, taobao.com
    News = 'news',                // 新闻：cnn.com, bbc.com
    Education = 'education',      // 教育：coursera.org, udemy.com
    Tool = 'tool',               // 工具：figma.com, notion.so
    Search = 'search',           // 搜索引擎：google.com, bing.com
    Other = 'other'              // 其他未分类
}

// === 处理器配置选项 ===
export interface ProcessorOptions {
    // 性能相关
    enableCache: boolean           // 是否启用缓存
    cacheTimeout: number          // 缓存超时时间(ms)
    maxMemoryUsage: number        // 最大内存使用量(bytes)

    // 功能开关
    enableDuplicateDetection: boolean    // 启用重复检测
    enableSearchIndex: boolean           // 启用搜索索引
    enableVirtualization: boolean        // 启用虚拟化预处理
    enableAnalytics: boolean            // 启用分析统计

    // 清理检测配置
    duplicateDetection: {
        urlSimilarity: number              // URL相似度阈值(0-1)
        titleSimilarity: number           // 标题相似度阈值(0-1)
        ignoreCase: boolean              // 忽略大小写
        ignoreProtocol: boolean          // 忽略协议(http/https)
    }

    // 搜索索引配置
    searchIndex: {
        minKeywordLength: number         // 最小关键词长度
        maxKeywords: number             // 每个书签最大关键词数
        enableFuzzySearch: boolean      // 启用模糊搜索
    }
}

// === 默认处理器配置 ===
export const DEFAULT_PROCESSOR_OPTIONS: ProcessorOptions = {
    // 性能配置
    enableCache: true,
    cacheTimeout: 30 * 60 * 1000,    // 30分钟
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB

    // 功能开关
    enableDuplicateDetection: true,
    enableSearchIndex: true,
    enableVirtualization: true,
    enableAnalytics: true,

    // 清理检测配置
    duplicateDetection: {
        urlSimilarity: 0.9,
        titleSimilarity: 0.8,
        ignoreCase: true,
        ignoreProtocol: true
    },

    // 搜索索引配置
    searchIndex: {
        minKeywordLength: 3,
        maxKeywords: 10,
        enableFuzzySearch: false
    }
}

// === 缓存状态枚举 ===
export enum CacheStatus {
    FRESH = 'fresh',           // 缓存新鲜
    STALE = 'stale',          // 缓存过期但可用
    INVALID = 'invalid',       // 缓存无效
    MISSING = 'missing'        // 缓存不存在
}

// === 处理器错误类型 ===
export class ProcessorError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message)
        this.name = 'ProcessorError'
    }
}

export const PROCESSOR_ERROR_CODES = {
    INVALID_INPUT: 'INVALID_INPUT',
    PROCESSING_FAILED: 'PROCESSING_FAILED',
    CACHE_ERROR: 'CACHE_ERROR',
    MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
    TIMEOUT: 'TIMEOUT'
} as const
