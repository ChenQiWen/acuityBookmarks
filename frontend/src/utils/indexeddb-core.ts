/**
 * IndexedDB核心数据库管理器
 * 支持十万条书签的企业级存储架构
 * 完全替代chrome.storage.local，移除所有缓存层
 */

export interface BookmarkRecord {
    id: string
    parentId?: string
    title: string
    url?: string
    dateAdded?: number
    dateGroupModified?: number

    // 增强字段
    index: number
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

    // 类型标识
    isFolder: boolean
    childrenCount: number
    bookmarksCount: number

    // 扩展属性
    tags: string[]
    category?: string
    notes?: string
    lastVisited?: number
    visitCount?: number
}

export interface SearchIndex {
    id: string
    bookmarkId: string
    keyword: string
    weight: number
    type: 'title' | 'url' | 'domain' | 'tag'
}

export interface GlobalStats {
    totalBookmarks: number
    totalFolders: number
    totalDomains: number
    maxDepth: number
    lastUpdated: number
    version: string
}

export interface AppSettings {
    key: string
    value: any
    updatedAt: number
}

/**
 * IndexedDB数据库管理器
 * 单一数据源，无缓存，直接读写
 */
export class IndexedDBCore {
    private static readonly DB_NAME = 'AcuityBookmarksDB'
    private static readonly DB_VERSION = 1  // 暂时回滚，修复阻塞问题
    private static instance: IndexedDBCore | null = null
    private db: IDBDatabase | null = null

    // 表名常量
    static readonly STORES = {
        BOOKMARKS: 'bookmarks',
        SEARCH_INDEX: 'searchIndex',
        GLOBAL_STATS: 'globalStats',
        SETTINGS: 'settings',
        SEARCH_HISTORY: 'searchHistory'
        // DOMAIN_FAVICONS: 'domainFavicons',  // 暂时禁用
        // FAVICON_STATS: 'faviconStats'       // 暂时禁用
    } as const

    /**
     * 单例模式
     */
    static getInstance(): IndexedDBCore {
        if (!this.instance) {
            this.instance = new IndexedDBCore()
        }
        return this.instance
    }

    /**
     * 初始化数据库
     */
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(IndexedDBCore.DB_NAME, IndexedDBCore.DB_VERSION)

            request.onerror = () => {
                console.error('❌ IndexedDB初始化失败:', request.error)
                reject(new Error(`IndexedDB初始化失败: ${request.error}`))
            }

            request.onsuccess = () => {
                this.db = request.result
                console.log('✅ IndexedDB初始化成功')
                resolve()
            }

            request.onupgradeneeded = (event) => {
                console.log('🔧 IndexedDB升级中...')
                const db = (event.target as IDBOpenDBRequest).result

                // 创建书签表
                if (!db.objectStoreNames.contains(IndexedDBCore.STORES.BOOKMARKS)) {
                    const bookmarkStore = db.createObjectStore(IndexedDBCore.STORES.BOOKMARKS, { keyPath: 'id' })

                    // 创建索引 - 支持高性能查询
                    bookmarkStore.createIndex('parentId', 'parentId', { unique: false })
                    bookmarkStore.createIndex('url', 'url', { unique: false })
                    bookmarkStore.createIndex('domain', 'domain', { unique: false })
                    bookmarkStore.createIndex('titleLower', 'titleLower', { unique: false })
                    bookmarkStore.createIndex('depth', 'depth', { unique: false })
                    bookmarkStore.createIndex('pathIds', 'pathIds', { unique: false, multiEntry: true })
                    bookmarkStore.createIndex('keywords', 'keywords', { unique: false, multiEntry: true })
                    bookmarkStore.createIndex('dateAdded', 'dateAdded', { unique: false })
                    bookmarkStore.createIndex('isFolder', 'isFolder', { unique: false })
                }

                // 创建搜索索引表
                if (!db.objectStoreNames.contains(IndexedDBCore.STORES.SEARCH_INDEX)) {
                    const searchStore = db.createObjectStore(IndexedDBCore.STORES.SEARCH_INDEX, { keyPath: 'id' })
                    searchStore.createIndex('bookmarkId', 'bookmarkId', { unique: false })
                    searchStore.createIndex('keyword', 'keyword', { unique: false })
                    searchStore.createIndex('type', 'type', { unique: false })
                    searchStore.createIndex('weight', 'weight', { unique: false })
                }

                // 创建全局统计表
                if (!db.objectStoreNames.contains(IndexedDBCore.STORES.GLOBAL_STATS)) {
                    db.createObjectStore(IndexedDBCore.STORES.GLOBAL_STATS, { keyPath: 'key' })
                }

                // 创建设置表
                if (!db.objectStoreNames.contains(IndexedDBCore.STORES.SETTINGS)) {
                    const settingsStore = db.createObjectStore(IndexedDBCore.STORES.SETTINGS, { keyPath: 'key' })
                    settingsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
                }

                // 创建搜索历史表
                if (!db.objectStoreNames.contains(IndexedDBCore.STORES.SEARCH_HISTORY)) {
                    const historyStore = db.createObjectStore(IndexedDBCore.STORES.SEARCH_HISTORY, {
                        keyPath: 'id',
                        autoIncrement: true
                    })
                    historyStore.createIndex('query', 'query', { unique: false })
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false })
                }

                // 创建域名favicon缓存表 (暂时禁用，避免阻塞)
                /*
                if (!db.objectStoreNames.contains(IndexedDBCore.STORES.DOMAIN_FAVICONS)) {
                    const faviconStore = db.createObjectStore(IndexedDBCore.STORES.DOMAIN_FAVICONS, {
                        keyPath: 'domain'  // 以域名为主键
                    })
                    
                    // 创建索引以支持高效查询
                    faviconStore.createIndex('timestamp', 'timestamp', { unique: false })
                    faviconStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })
                    faviconStore.createIndex('accessCount', 'accessCount', { unique: false })
                    faviconStore.createIndex('bookmarkCount', 'bookmarkCount', { unique: false })
                    faviconStore.createIndex('isPopular', 'isPopular', { unique: false })
                    faviconStore.createIndex('size', 'size', { unique: false })
                    
                    console.log('✅ 创建域名favicon缓存表')
                }

                // 创建favicon统计表 (暂时禁用，避免阻塞)
                if (!db.objectStoreNames.contains(IndexedDBCore.STORES.FAVICON_STATS)) {
                    const statsStore = db.createObjectStore(IndexedDBCore.STORES.FAVICON_STATS, {
                        keyPath: 'key'
                    })
                    statsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
                    
                    console.log('✅ 创建favicon统计表')
                }
                */

                console.log('✅ IndexedDB表结构创建完成')
            }
        })
    }

    /**
     * 确保数据库已连接
     */
    private ensureDB(): IDBDatabase {
        if (!this.db) {
            throw new Error('IndexedDB未初始化，请先调用initialize()')
        }
        return this.db
    }

    // ==================== 书签操作 ====================

    /**
     * 批量插入书签（支持十万条高性能插入）
     */
    async insertBookmarks(bookmarks: BookmarkRecord[]): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)

            let completed = 0
            const total = bookmarks.length

            transaction.oncomplete = () => {
                console.log(`✅ 批量插入${total}条书签完成`)
                resolve()
            }

            transaction.onerror = () => {
                console.error('❌ 批量插入失败:', transaction.error)
                reject(transaction.error)
            }

            // 使用游标批量插入，避免内存压力
            bookmarks.forEach((bookmark) => {
                const request = store.put(bookmark)
                request.onsuccess = () => {
                    completed++
                    if (completed % 1000 === 0) {
                        console.log(`📊 已插入 ${completed}/${total} 条书签`)
                    }
                }
            })
        })
    }

    /**
     * 根据ID获取书签
     */
    async getBookmarkById(id: string): Promise<BookmarkRecord | null> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)
            const request = store.get(id)

            request.onsuccess = () => {
                resolve(request.result || null)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 获取所有书签（分页支持）
     */
    async getAllBookmarks(limit?: number, offset?: number): Promise<BookmarkRecord[]> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)
            const request = store.getAll()

            request.onsuccess = () => {
                let results = request.result

                if (offset) {
                    results = results.slice(offset)
                }

                if (limit) {
                    results = results.slice(0, limit)
                }

                resolve(results)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 根据父ID获取子书签
     */
    async getChildrenByParentId(parentId: string): Promise<BookmarkRecord[]> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)
            const index = store.index('parentId')
            const request = index.getAll(parentId)

            request.onsuccess = () => {
                // 按index排序
                const results = request.result.sort((a, b) => a.index - b.index)
                resolve(results)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 高性能搜索书签
     */
    async searchBookmarks(query: string, limit: number = 100): Promise<BookmarkRecord[]> {
        const db = this.ensureDB()
        const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)

        if (searchTerms.length === 0) {
            return []
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)
            const results: BookmarkRecord[] = []

            // 使用游标进行高效搜索
            const request = store.openCursor()

            request.onsuccess = () => {
                const cursor = request.result
                if (cursor && results.length < limit) {
                    const bookmark = cursor.value as BookmarkRecord

                    // 多字段匹配搜索
                    const matchScore = this.calculateMatchScore(bookmark, searchTerms)
                    if (matchScore > 0) {
                        results.push(bookmark)
                    }

                    cursor.continue()
                } else {
                    // 按匹配度排序
                    results.sort((a, b) => {
                        const scoreA = this.calculateMatchScore(a, searchTerms)
                        const scoreB = this.calculateMatchScore(b, searchTerms)
                        return scoreB - scoreA
                    })

                    resolve(results)
                }
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 计算匹配分数
     */
    private calculateMatchScore(bookmark: BookmarkRecord, searchTerms: string[]): number {
        let score = 0

        for (const term of searchTerms) {
            // 标题匹配（权重最高）
            if (bookmark.titleLower.includes(term)) {
                score += bookmark.titleLower.startsWith(term) ? 100 : 50
            }

            // URL匹配
            if (bookmark.urlLower && bookmark.urlLower.includes(term)) {
                score += 30
            }

            // 域名匹配
            if (bookmark.domain && bookmark.domain.includes(term)) {
                score += 20
            }

            // 关键词匹配
            if (bookmark.keywords.some(keyword => keyword.includes(term))) {
                score += 10
            }
        }

        return score
    }

    /**
     * 更新书签
     */
    async updateBookmark(bookmark: BookmarkRecord): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)
            const request = store.put(bookmark)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 删除书签
     */
    async deleteBookmark(id: string): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)
            const request = store.delete(id)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 清空所有书签
     */
    async clearAllBookmarks(): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.BOOKMARKS)
            const request = store.clear()

            request.onsuccess = () => {
                console.log('✅ 所有书签已清空')
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // ==================== 统计信息操作 ====================

    /**
     * 更新全局统计
     */
    async updateGlobalStats(stats: Partial<GlobalStats>): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.GLOBAL_STATS], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.GLOBAL_STATS)

            const statsRecord = {
                key: 'global',
                ...stats,
                lastUpdated: Date.now()
            }

            const request = store.put(statsRecord)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 获取全局统计
     */
    async getGlobalStats(): Promise<GlobalStats | null> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.GLOBAL_STATS], 'readonly')
            const store = transaction.objectStore(IndexedDBCore.STORES.GLOBAL_STATS)
            const request = store.get('global')

            request.onsuccess = () => {
                resolve(request.result || null)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // ==================== 设置操作 ====================

    /**
     * 保存设置
     */
    async saveSetting(key: string, value: any): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.SETTINGS], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.SETTINGS)

            const setting: AppSettings = {
                key,
                value,
                updatedAt: Date.now()
            }

            const request = store.put(setting)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 获取设置
     */
    async getSetting<T>(key: string): Promise<T | null> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.SETTINGS], 'readonly')
            const store = transaction.objectStore(IndexedDBCore.STORES.SETTINGS)
            const request = store.get(key)

            request.onsuccess = () => {
                const result = request.result
                resolve(result ? result.value : null)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 删除设置
     */
    async deleteSetting(key: string): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.SETTINGS], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.SETTINGS)
            const request = store.delete(key)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // ==================== 搜索历史操作 ====================

    /**
     * 添加搜索历史
     */
    async addSearchHistory(query: string, results: number): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.SEARCH_HISTORY], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.SEARCH_HISTORY)

            const historyRecord = {
                query,
                results,
                timestamp: Date.now()
            }

            const request = store.add(historyRecord)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 获取搜索历史
     */
    async getSearchHistory(limit: number = 20): Promise<any[]> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.SEARCH_HISTORY], 'readonly')
            const store = transaction.objectStore(IndexedDBCore.STORES.SEARCH_HISTORY)
            const index = store.index('timestamp')

            // 按时间倒序获取
            const request = index.openCursor(null, 'prev')
            const results: any[] = []

            request.onsuccess = () => {
                const cursor = request.result
                if (cursor && results.length < limit) {
                    results.push(cursor.value)
                    cursor.continue()
                } else {
                    resolve(results)
                }
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 清空搜索历史
     */
    async clearSearchHistory(): Promise<void> {
        const db = this.ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IndexedDBCore.STORES.SEARCH_HISTORY], 'readwrite')
            const store = transaction.objectStore(IndexedDBCore.STORES.SEARCH_HISTORY)
            const request = store.clear()

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // ==================== 数据库维护 ====================

    /**
     * 获取数据库统计信息
     */
    async getDatabaseInfo(): Promise<{
        bookmarkCount: number
        searchHistoryCount: number
        settingsCount: number
        estimatedSize: number
    }> {
        this.ensureDB()

        const bookmarks = await this.getAllBookmarks()
        const searchHistory = await this.getSearchHistory(1000)

        return {
            bookmarkCount: bookmarks.length,
            searchHistoryCount: searchHistory.length,
            settingsCount: 0, // TODO: 实现设置计数
            estimatedSize: JSON.stringify({ bookmarks, searchHistory }).length
        }
    }

    /**
     * 关闭数据库连接
     */
    /**
     * 执行事务（公共方法，供favicon管理器使用）
     */
    async executeTransaction<T>(
        storeNames: string[],
        mode: IDBTransactionMode,
        operation: (transaction: IDBTransaction) => Promise<T>
    ): Promise<T> {
        if (!this.db) {
            await this.initialize()
        }

        const transaction = this.db!.transaction(storeNames, mode)
        return await operation(transaction)
    }

    close(): void {
        if (this.db) {
            this.db.close()
            this.db = null
            console.log('✅ IndexedDB连接已关闭')
        }
    }
}

// ==================== Favicon相关数据接口 ====================

export interface DomainFaviconRecord {
    domain: string           // 主键：域名（如 "google.com"）
    faviconUrl: string       // Google Favicon API URL
    size: number            // 图标尺寸（16, 32, 64等）
    timestamp: number        // 获取时间戳
    lastAccessed: number     // 最后访问时间
    accessCount: number      // 访问次数
    bookmarkCount: number    // 该域名下的书签数量
    quality: 'high' | 'medium' | 'low'  // 图标质量等级
    isPreloaded: boolean     // 是否通过预获取得到
    retryCount: number       // 失败重试次数
    errorMessage?: string    // 最后一次错误信息
    isPopular: boolean      // 是否为热门域名（书签数≥5）
}

export interface FaviconStatsRecord {
    key: string             // 主键：统计类型
    value: number | string | object  // 统计值
    updatedAt: number       // 更新时间
}
