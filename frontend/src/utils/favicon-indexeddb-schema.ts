/**
 * Favicon IndexedDB存储结构设计
 * 独立存储，域名级缓存
 */

// 更新IndexedDB版本和存储结构
export const FAVICON_SCHEMA = {
    // 数据库升级到版本2
    DB_VERSION: 2,

    // 新增对象存储
    NEW_STORES: {
        DOMAIN_FAVICONS: 'domainFavicons',     // 域名favicon缓存
        FAVICON_STATS: 'faviconStats'          // favicon统计信息
    },

    // 完整存储列表
    ALL_STORES: {
        BOOKMARKS: 'bookmarks',
        SEARCH_INDEX: 'searchIndex',
        GLOBAL_STATS: 'globalStats',
        SETTINGS: 'settings',
        SEARCH_HISTORY: 'searchHistory',
        DOMAIN_FAVICONS: 'domainFavicons',     // 新增
        FAVICON_STATS: 'faviconStats'          // 新增
    }
}

// 域名favicon记录接口
export interface DomainFaviconRecord {
    domain: string,           // 主键：域名（如 "google.com"）
    faviconUrl: string,       // Google Favicon API URL
    size: number,            // 图标尺寸（16, 32, 64等）
    timestamp: number,        // 获取时间戳
    lastAccessed: number,     // 最后访问时间
    accessCount: number,      // 访问次数
    bookmarkCount: number,    // 该域名下的书签数量
    quality: 'high' | 'medium' | 'low',  // 图标质量等级
    isPreloaded: boolean,     // 是否通过预获取得到
    retryCount: number,       // 失败重试次数
    errorMessage?: string,    // 最后一次错误信息
    isPopular: boolean       // 是否为热门域名（书签数≥5）
}

// favicon统计信息
export interface FaviconStatsRecord {
    key: string,             // 主键：统计类型
    value: number | string | object,  // 统计值
    updatedAt: number        // 更新时间
}

// 预定义的统计类型
export const FAVICON_STATS_KEYS = {
    TOTAL_DOMAINS: 'total_domains',           // 总域名数
    CACHED_DOMAINS: 'cached_domains',         // 已缓存域名数
    CACHE_HIT_RATE: 'cache_hit_rate',        // 缓存命中率
    LAST_PREFETCH: 'last_prefetch_time',     // 最后预获取时间
    PREFETCH_PROGRESS: 'prefetch_progress',   // 预获取进度
    FAILED_DOMAINS: 'failed_domains',        // 失败域名列表
    POPULAR_DOMAINS: 'popular_domains'       // 热门域名列表
} as const

// IndexedDB升级函数
export function upgradeFaviconSchema(db: IDBDatabase, oldVersion: number, newVersion: number) {
    console.log(`🔧 升级IndexedDB从版本 ${oldVersion} 到 ${newVersion}`)

    if (oldVersion < 2) {
        // 创建域名favicon表
        if (!db.objectStoreNames.contains(FAVICON_SCHEMA.NEW_STORES.DOMAIN_FAVICONS)) {
            const faviconStore = db.createObjectStore(
                FAVICON_SCHEMA.NEW_STORES.DOMAIN_FAVICONS,
                { keyPath: 'domain' }  // 以域名为主键
            )

            // 创建索引以支持高效查询
            faviconStore.createIndex('timestamp', 'timestamp', { unique: false })
            faviconStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })
            faviconStore.createIndex('accessCount', 'accessCount', { unique: false })
            faviconStore.createIndex('bookmarkCount', 'bookmarkCount', { unique: false })
            faviconStore.createIndex('isPopular', 'isPopular', { unique: false })
            faviconStore.createIndex('isPreloaded', 'isPreloaded', { unique: false })
            faviconStore.createIndex('size', 'size', { unique: false })

            console.log('✅ 创建 domainFavicons 对象存储')
        }

        // 创建favicon统计表
        if (!db.objectStoreNames.contains(FAVICON_SCHEMA.NEW_STORES.FAVICON_STATS)) {
            const statsStore = db.createObjectStore(
                FAVICON_SCHEMA.NEW_STORES.FAVICON_STATS,
                { keyPath: 'key' }
            )

            statsStore.createIndex('updatedAt', 'updatedAt', { unique: false })

            console.log('✅ 创建 faviconStats 对象存储')
        }
    }
}

// 数据示例（用于调试和理解）
export const FAVICON_DATA_EXAMPLES = {
    // 域名favicon记录示例
    domainFavicon: {
        domain: "google.com",
        faviconUrl: "https://www.google.com/s2/favicons?domain=google.com&sz=16",
        size: 16,
        timestamp: 1703123456789,
        lastAccessed: 1703123456789,
        accessCount: 25,
        bookmarkCount: 12,
        quality: "high" as const,
        isPreloaded: true,
        retryCount: 0,
        isPopular: true
    },

    // 统计信息示例
    stats: {
        total_domains: { key: "total_domains", value: 1850, updatedAt: 1703123456789 },
        cached_domains: { key: "cached_domains", value: 1203, updatedAt: 1703123456789 },
        cache_hit_rate: { key: "cache_hit_rate", value: 85.2, updatedAt: 1703123456789 },
        prefetch_progress: {
            key: "prefetch_progress",
            value: { total: 1850, completed: 1203, inProgress: 15, failed: 32 },
            updatedAt: 1703123456789
        }
    }
} as const
