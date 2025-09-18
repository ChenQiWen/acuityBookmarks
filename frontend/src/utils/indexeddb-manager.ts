/**
 * 统一IndexedDB管理器
 * 提供标准化的IndexedDB操作接口
 * 支持十万条书签的高性能存储和查询
 * Service Worker和前端共享的核心组件
 */

import {
    DB_CONFIG,
    INDEX_CONFIG,
    type BookmarkRecord,
    type GlobalStats,
    type AppSettings,
    type SearchHistoryRecord,
    type FaviconCacheRecord,
    type DatabaseHealth,
    type DatabaseStats,
    type SearchOptions,
    type SearchResult,
    type BatchOptions
} from './indexeddb-schema'

/**
 * 统一IndexedDB管理器类
 */
export class IndexedDBManager {
    private static instance: IndexedDBManager | null = null
    private db: IDBDatabase | null = null
    private isInitialized = false
    private initPromise: Promise<void> | null = null

    private constructor() { }

    /**
     * 单例模式获取实例
     */
    static getInstance(): IndexedDBManager {
        if (!IndexedDBManager.instance) {
            IndexedDBManager.instance = new IndexedDBManager()
        }
        return IndexedDBManager.instance
    }

    /**
     * 初始化数据库
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return
        }

        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = this._doInitialize()
        return this.initPromise
    }

    private async _doInitialize(): Promise<void> {
        console.log('🚀 [IndexedDB] 初始化开始...', {
            name: DB_CONFIG.NAME,
            version: DB_CONFIG.VERSION
        })

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)

            request.onerror = () => {
                const error = request.error
                console.error('❌ [IndexedDB] 初始化失败:', error)
                this.initPromise = null
                reject(new Error(`IndexedDB初始化失败: ${error?.message || 'Unknown error'}`))
            }

            request.onsuccess = () => {
                this.db = request.result
                this.isInitialized = true
                this.initPromise = null

                console.log('✅ [IndexedDB] 初始化成功', {
                    version: this.db.version,
                    stores: Array.from(this.db.objectStoreNames)
                })

                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                const oldVersion = event.oldVersion
                const newVersion = event.newVersion

                console.log('🔧 [IndexedDB] 数据库升级', {
                    from: oldVersion,
                    to: newVersion
                })

                try {
                    this._createStores(db)
                    console.log('✅ [IndexedDB] 表结构创建完成')
                } catch (error) {
                    console.error('❌ [IndexedDB] 表结构创建失败:', error)
                    throw error
                }
            }

            request.onblocked = () => {
                console.warn('⚠️ [IndexedDB] 升级被阻塞，其他标签页可能正在使用数据库')
            }
        })
    }

    /**
     * 创建所有存储表和索引
     */
    private _createStores(db: IDBDatabase): void {
        // 创建书签表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOOKMARKS)) {
            console.log('📊 [IndexedDB] 创建书签表...')
            const bookmarkStore = db.createObjectStore(DB_CONFIG.STORES.BOOKMARKS, {
                keyPath: 'id'
            })

            // 创建所有索引
            INDEX_CONFIG[DB_CONFIG.STORES.BOOKMARKS].forEach(indexConfig => {
                bookmarkStore.createIndex(
                    indexConfig.name,
                    indexConfig.keyPath,
                    indexConfig.options
                )
            })

            console.log('✅ [IndexedDB] 书签表创建完成')
        }

        // 创建全局统计表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.GLOBAL_STATS)) {
            console.log('📊 [IndexedDB] 创建全局统计表...')
            db.createObjectStore(DB_CONFIG.STORES.GLOBAL_STATS, {
                keyPath: 'key'
            })
            console.log('✅ [IndexedDB] 全局统计表创建完成')
        }

        // 创建设置表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SETTINGS)) {
            console.log('📊 [IndexedDB] 创建设置表...')
            const settingsStore = db.createObjectStore(DB_CONFIG.STORES.SETTINGS, {
                keyPath: 'key'
            })

            INDEX_CONFIG[DB_CONFIG.STORES.SETTINGS].forEach(indexConfig => {
                settingsStore.createIndex(
                    indexConfig.name,
                    indexConfig.keyPath,
                    indexConfig.options
                )
            })

            console.log('✅ [IndexedDB] 设置表创建完成')
        }

        // 创建搜索历史表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SEARCH_HISTORY)) {
            console.log('📊 [IndexedDB] 创建搜索历史表...')
            const historyStore = db.createObjectStore(DB_CONFIG.STORES.SEARCH_HISTORY, {
                keyPath: 'id',
                autoIncrement: true
            })

            INDEX_CONFIG[DB_CONFIG.STORES.SEARCH_HISTORY].forEach(indexConfig => {
                historyStore.createIndex(
                    indexConfig.name,
                    indexConfig.keyPath,
                    indexConfig.options
                )
            })

            console.log('✅ [IndexedDB] 搜索历史表创建完成')
        }

        // 创建图标缓存表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_CACHE)) {
            console.log('📊 [IndexedDB] 创建图标缓存表...')
            const faviconStore = db.createObjectStore(DB_CONFIG.STORES.FAVICON_CACHE, {
                keyPath: 'domain'
            })

            INDEX_CONFIG[DB_CONFIG.STORES.FAVICON_CACHE].forEach(indexConfig => {
                faviconStore.createIndex(
                    indexConfig.name,
                    indexConfig.keyPath,
                    indexConfig.options
                )
            })

            console.log('✅ [IndexedDB] 图标缓存表创建完成')
        }

        // 创建图标统计表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_STATS)) {
            console.log('📊 [IndexedDB] 创建图标统计表...')
            const faviconStatsStore = db.createObjectStore(DB_CONFIG.STORES.FAVICON_STATS, {
                keyPath: 'key'
            })

            INDEX_CONFIG[DB_CONFIG.STORES.FAVICON_STATS].forEach(indexConfig => {
                faviconStatsStore.createIndex(
                    indexConfig.name,
                    indexConfig.keyPath,
                    indexConfig.options
                )
            })

            console.log('✅ [IndexedDB] 图标统计表创建完成')
        }
    }

    /**
     * 确保数据库已初始化
     */
    private _ensureDB(): IDBDatabase {
        if (!this.db) {
            throw new Error('IndexedDB未初始化，请先调用initialize()')
        }
        return this.db
    }

    // ==================== 书签操作 ====================

    /**
     * 批量插入书签 - 支持十万条高性能插入
     */
    async insertBookmarks(bookmarks: BookmarkRecord[], options: BatchOptions = {}): Promise<void> {
        const db = this._ensureDB()
        const { progressCallback } = options

        console.log(`📥 [IndexedDB] 开始批量插入 ${bookmarks.length} 条书签...`)
        const startTime = performance.now()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)

            let processed = 0
            const errors: Error[] = []

            transaction.oncomplete = () => {
                const duration = performance.now() - startTime
                console.log(`✅ [IndexedDB] 批量插入完成: ${processed}/${bookmarks.length} 条书签, 耗时: ${duration.toFixed(2)}ms`)
                resolve()
            }

            transaction.onerror = () => {
                console.error('❌ [IndexedDB] 批量插入失败:', transaction.error)
                reject(transaction.error)
            }

            // 修复：直接在单个事务中处理所有数据，避免异步分批导致事务结束
            try {
                for (let i = 0; i < bookmarks.length; i++) {
                    const bookmark = bookmarks[i]
                    const request = store.put(bookmark)

                    request.onsuccess = () => {
                        processed++

                        // 进度回调
                        if (progressCallback && processed % 500 === 0) {
                            progressCallback(processed, bookmarks.length)
                        }
                    }

                    request.onerror = () => {
                        const error = new Error(`插入书签失败: ${bookmark.id}`)
                        errors.push(error)
                        if (options.errorCallback) {
                            options.errorCallback(error, bookmark)
                        }
                    }
                }

                console.log(`🚀 [IndexedDB] 已提交 ${bookmarks.length} 条书签到事务队列`)
            } catch (error) {
                console.error('❌ [IndexedDB] 批量插入过程中发生错误:', error)
                transaction.abort()
                reject(error)
            }
        })
    }

    /**
     * 根据ID获取书签
     */
    async getBookmarkById(id: string): Promise<BookmarkRecord | null> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
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
     * 获取所有书签（支持分页）
     */
    async getAllBookmarks(limit?: number, offset?: number): Promise<BookmarkRecord[]> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)

            const results: BookmarkRecord[] = []
            let skipped = 0
            const targetOffset = offset || 0
            const targetLimit = limit || Infinity

            const request = store.openCursor()

            request.onsuccess = () => {
                const cursor = request.result

                if (cursor && results.length < targetLimit) {
                    if (skipped < targetOffset) {
                        skipped++
                        cursor.continue()
                    } else {
                        results.push(cursor.value)
                        cursor.continue()
                    }
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
     * 根据父ID获取子书签
     */
    async getChildrenByParentId(parentId: string): Promise<BookmarkRecord[]> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const index = store.index('parentId')
            const request = index.getAll(parentId)

            request.onsuccess = () => {
                // 按index字段排序
                const results = request.result.sort((a: BookmarkRecord, b: BookmarkRecord) => a.index - b.index)
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
    async searchBookmarks(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const db = this._ensureDB()
        const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)

        if (searchTerms.length === 0) {
            return []
        }

        const {
            limit = 100,
            sortBy = 'relevance',
            minScore = 0
        } = options

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const results: SearchResult[] = []

            const request = store.openCursor()

            request.onsuccess = () => {
                const cursor = request.result

                if (cursor && results.length < limit) {
                    const bookmark = cursor.value as BookmarkRecord
                    const searchResult = this._calculateSearchScore(bookmark, searchTerms, options)

                    if (searchResult.score > minScore) {
                        results.push(searchResult)
                    }

                    cursor.continue()
                } else {
                    // 排序结果
                    if (sortBy === 'relevance') {
                        results.sort((a, b) => b.score - a.score)
                    } else if (sortBy === 'title') {
                        results.sort((a, b) => a.bookmark.title.localeCompare(b.bookmark.title))
                    } else if (sortBy === 'dateAdded') {
                        results.sort((a, b) => (b.bookmark.dateAdded || 0) - (a.bookmark.dateAdded || 0))
                    }

                    resolve(results)
                }
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 计算搜索匹配分数和高亮
     */
    private _calculateSearchScore(
        bookmark: BookmarkRecord,
        searchTerms: string[],
        options: SearchOptions
    ): SearchResult {
        let score = 0
        const matchedFields: string[] = []
        const highlights: Record<string, string[]> = {}

        for (const term of searchTerms) {
            // 标题匹配（权重最高）
            if (bookmark.titleLower.includes(term)) {
                const weight = bookmark.titleLower.startsWith(term) ? 100 : 50
                score += weight
                matchedFields.push('title')
                if (!highlights.title) highlights.title = []
                highlights.title.push(term)
            }

            // URL匹配
            if (options.includeUrl && bookmark.urlLower && bookmark.urlLower.includes(term)) {
                score += 30
                matchedFields.push('url')
                if (!highlights.url) highlights.url = []
                highlights.url.push(term)
            }

            // 域名匹配
            if (options.includeDomain && bookmark.domain && bookmark.domain.includes(term)) {
                score += 20
                matchedFields.push('domain')
                if (!highlights.domain) highlights.domain = []
                highlights.domain.push(term)
            }

            // 关键词匹配
            if (options.includeKeywords && bookmark.keywords.some(keyword => keyword.includes(term))) {
                score += 15
                matchedFields.push('keywords')
                if (!highlights.keywords) highlights.keywords = []
                highlights.keywords.push(term)
            }

            // 标签匹配
            if (options.includeTags && bookmark.tags.some(tag => tag.toLowerCase().includes(term))) {
                score += 10
                matchedFields.push('tags')
                if (!highlights.tags) highlights.tags = []
                highlights.tags.push(term)
            }
        }

        return {
            bookmark,
            score,
            matchedFields: [...new Set(matchedFields)], // 去重
            highlights
        }
    }

    /**
     * 更新书签
     */
    async updateBookmark(bookmark: BookmarkRecord): Promise<void> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const request = store.clear()

            request.onsuccess = () => {
                console.log('✅ [IndexedDB] 所有书签已清空')
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
    async updateGlobalStats(stats: GlobalStats): Promise<void> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.GLOBAL_STATS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.GLOBAL_STATS)

            const statsRecord = {
                key: 'basic',
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.GLOBAL_STATS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.GLOBAL_STATS)
            const request = store.get('basic')

            request.onsuccess = () => {
                const result = request.result
                if (result) {
                    // 移除key字段，返回纯统计数据
                    const { key, ...stats } = result
                    resolve(stats as GlobalStats)
                } else {
                    resolve(null)
                }
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
    async saveSetting(key: string, value: any, type?: string, description?: string): Promise<void> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SETTINGS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)

            const setting: AppSettings = {
                key,
                value,
                type: (type || typeof value) as 'string' | 'number' | 'boolean' | 'object',
                description,
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SETTINGS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SETTINGS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)
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
    async addSearchHistory(
        query: string,
        results: number,
        executionTime: number = 0,
        source: SearchHistoryRecord['source'] = 'management'
    ): Promise<void> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)

            const historyRecord: Omit<SearchHistoryRecord, 'id'> = {
                query,
                results,
                executionTime,
                source,
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
    async getSearchHistory(limit: number = 20): Promise<SearchHistoryRecord[]> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)
            const index = store.index('timestamp')

            const results: SearchHistoryRecord[] = []
            const request = index.openCursor(null, 'prev') // 按时间倒序

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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)
            const request = store.clear()

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // ==================== 图标缓存操作 ====================

    /**
     * 保存图标缓存
     */
    async saveFaviconCache(faviconRecord: FaviconCacheRecord): Promise<void> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.FAVICON_CACHE], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.FAVICON_CACHE)
            const request = store.put(faviconRecord)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 获取图标缓存
     */
    async getFaviconCache(domain: string): Promise<FaviconCacheRecord | null> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.FAVICON_CACHE], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.FAVICON_CACHE)
            const request = store.get(domain)

            request.onsuccess = () => {
                resolve(request.result || null)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // ==================== 数据库维护 ====================

    /**
     * 检查数据库健康状态
     */
    async checkDatabaseHealth(): Promise<DatabaseHealth> {
        try {
            const db = this._ensureDB()
            const expectedStores = Object.values(DB_CONFIG.STORES)
            const existingStores = Array.from(db.objectStoreNames)

            const missingStores = expectedStores.filter(store => !existingStores.includes(store))
            const extraStores = existingStores.filter(store => !expectedStores.includes(store as any))

            const isHealthy = missingStores.length === 0 && extraStores.length === 0

            return {
                isHealthy,
                version: db.version,
                expectedStores,
                existingStores,
                missingStores,
                extraStores,
                lastCheck: Date.now(),
                errors: []
            }
        } catch (error) {
            return {
                isHealthy: false,
                version: 0,
                expectedStores: Object.values(DB_CONFIG.STORES),
                existingStores: [],
                missingStores: Object.values(DB_CONFIG.STORES),
                extraStores: [],
                lastCheck: Date.now(),
                errors: [error instanceof Error ? error.message : String(error)]
            }
        }
    }

    /**
     * 获取数据库统计信息
     */
    async getDatabaseStats(): Promise<DatabaseStats> {
        const [bookmarkCount, faviconCount, searchHistoryCount, settingsCount] = await Promise.all([
            this._getStoreCount(DB_CONFIG.STORES.BOOKMARKS),
            this._getStoreCount(DB_CONFIG.STORES.FAVICON_CACHE),
            this._getStoreCount(DB_CONFIG.STORES.SEARCH_HISTORY),
            this._getStoreCount(DB_CONFIG.STORES.SETTINGS)
        ])

        // 估算总大小（粗略计算）
        const totalSize = bookmarkCount * 1000 + faviconCount * 2000 + searchHistoryCount * 100 + settingsCount * 50

        return {
            bookmarkCount,
            faviconCount,
            searchHistoryCount,
            settingsCount,
            totalSize,
            indexSize: totalSize * 0.1, // 估算索引大小为数据的10%
            lastOptimized: Date.now()
        }
    }

    /**
     * 获取指定存储的记录数
     */
    private async _getStoreCount(storeName: string): Promise<number> {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName as keyof typeof DB_CONFIG.STORES], 'readonly')
            const store = transaction.objectStore(storeName)
            const request = store.count()

            request.onsuccess = () => {
                resolve(request.result)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 关闭数据库连接
     */
    close(): void {
        if (this.db) {
            this.db.close()
            this.db = null
            this.isInitialized = false
            console.log('✅ [IndexedDB] 数据库连接已关闭')
        }
    }

    /**
     * 销毁实例
     */
    static destroy(): void {
        if (IndexedDBManager.instance) {
            IndexedDBManager.instance.close()
            IndexedDBManager.instance = null
        }
    }
}

// 导出单例实例
export const indexedDBManager = IndexedDBManager.getInstance()
