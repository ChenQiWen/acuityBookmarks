/**
 * IndexedDB存储适配器
 * 为书签数据提供高性能的IndexedDB存储接口
 */

import type { SuperEnhancedBookmarkNode, SuperBookmarkCache } from '../types/enhanced-bookmark'

export interface BookmarkQuery {
    id?: string
    parentId?: string
    domain?: string
    titleContains?: string
    urlContains?: string
    pathIds?: string[]
    limit?: number
    offset?: number
}

export interface QueryResult<T> {
    data: T[]
    total: number
    hasMore: boolean
}

export class IndexedDBStorageAdapter {
    private db: IDBDatabase | null = null
    private readonly DB_NAME = 'AcuityBookmarksDB'
    private readonly DB_VERSION = 2  // ✅ 修复：统一使用版本2
    private readonly STORES = {
        bookmarks: 'bookmarks',
        searchIndex: 'searchIndex',
        metadata: 'metadata'
    } as const

    /**
     * 初始化IndexedDB连接
     */
    async initialize(): Promise<void> {
        if (this.db) return // Already initialized

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
                this.db = request.result
                console.log('✅ IndexedDB Storage Adapter 初始化成功')
                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                const oldVersion = event.oldVersion
                const newVersion = event.newVersion || this.DB_VERSION

                console.log(`🔄 [IndexedDBStorageAdapter] 数据库升级: ${oldVersion} -> ${newVersion}`)

                // 兼容IndexedDBManager的数据库结构
                this.createStores(db, oldVersion, newVersion)
            }
        })
    }

    /**
     * 创建存储结构 - ✅ Phase 2: 兼容IndexedDBManager
     */
    private createStores(db: IDBDatabase, oldVersion: number = 0, newVersion: number = this.DB_VERSION): void {
        console.log(`🔄 [StorageAdapter] 检查数据库结构 (v${oldVersion} -> v${newVersion})`)

        // ✅ 优先使用IndexedDBManager的bookmarks表，避免冲突
        // IndexedDBManager应该已经创建了bookmarks表，这里只检查兼容性
        if (db.objectStoreNames.contains('bookmarks')) {
            console.log('✅ [StorageAdapter] 检测到IndexedDBManager的bookmarks表，使用现有结构')
        } else {
            // 如果没有现有的bookmarks表，创建我们自己的版本
            console.log('📚 [StorageAdapter] 创建书签存储...')
            const bookmarkStore = db.createObjectStore(this.STORES.bookmarks, {
                keyPath: 'id'
            })

            // 创建基础索引 (与IndexedDBManager兼容)
            try {
                bookmarkStore.createIndex('parentId', 'parentId', { unique: false })
                bookmarkStore.createIndex('url', 'url', { unique: false })
                bookmarkStore.createIndex('domain', 'domain', { unique: false })
                bookmarkStore.createIndex('title_search', 'titleLower', { unique: false })  // 使用titleLower字段
                bookmarkStore.createIndex('pathIds', 'pathIds', { unique: false, multiEntry: true })
                bookmarkStore.createIndex('dateAdded', 'dateAdded', { unique: false })
                bookmarkStore.createIndex('depth', 'depth', { unique: false })
                console.log('✅ [StorageAdapter] 书签存储索引创建完成')
            } catch (error) {
                console.warn('⚠️ [StorageAdapter] 索引创建部分失败:', error)
            }
        }

        // ✅ 搜索索引存储（用于全文搜索）- 仅在需要时创建
        if (!db.objectStoreNames.contains(this.STORES.searchIndex)) {
            try {
                console.log('🔍 [StorageAdapter] 创建搜索索引存储...')
                const searchStore = db.createObjectStore(this.STORES.searchIndex, {
                    keyPath: 'keyword'
                })
                searchStore.createIndex('bookmarkIds', 'bookmarkIds', { unique: false, multiEntry: true })
                console.log('✅ [StorageAdapter] 搜索索引存储创建完成')
            } catch (error) {
                console.warn('⚠️ [StorageAdapter] 搜索索引存储创建失败:', error)
            }
        }

        // ✅ 元数据存储 - 避免与IndexedDBManager的设置表冲突
        if (!db.objectStoreNames.contains(this.STORES.metadata)) {
            try {
                console.log('📊 [StorageAdapter] 创建元数据存储...')
                db.createObjectStore(this.STORES.metadata, { keyPath: 'key' })
                console.log('✅ [StorageAdapter] 元数据存储创建完成')
            } catch (error) {
                console.warn('⚠️ [StorageAdapter] 元数据存储创建失败:', error)
            }
        } else {
            console.log('✅ [StorageAdapter] 元数据存储已存在')
        }
    }

    /**
     * 保存完整的书签缓存
     */
    async saveSuperCache(cache: SuperBookmarkCache): Promise<void> {
        await this.ensureInitialized()

        const startTime = performance.now()
        const transaction = this.db!.transaction([
            this.STORES.bookmarks,
            this.STORES.searchIndex,
            this.STORES.metadata
        ], 'readwrite')

        try {
            // 清空现有数据
            await this.clearStore(transaction.objectStore(this.STORES.bookmarks))
            await this.clearStore(transaction.objectStore(this.STORES.searchIndex))

            // 保存书签数据
            const bookmarkStore = transaction.objectStore(this.STORES.bookmarks)
            for (const bookmark of cache.data) {
                await this.promisifyRequest(bookmarkStore.put(bookmark))
            }

            // 构建和保存搜索索引
            await this.buildSearchIndex(cache.data, transaction.objectStore(this.STORES.searchIndex))

            // 保存元数据
            const metadataStore = transaction.objectStore(this.STORES.metadata)
            await this.promisifyRequest(metadataStore.put({
                key: 'globalStats',
                value: cache.globalStats,
                timestamp: Date.now()
            }))
            await this.promisifyRequest(metadataStore.put({
                key: 'processingMetadata',
                value: cache.metadata,
                timestamp: Date.now()
            }))

            const saveTime = performance.now() - startTime
            console.log(`💾 IndexedDB保存完成: ${cache.data.length}条记录, 耗时: ${saveTime.toFixed(2)}ms`)

        } catch (error) {
            console.error('❌ IndexedDB保存失败:', error)
            throw error
        }
    }

    /**
     * 构建搜索索引
     */
    private async buildSearchIndex(bookmarks: SuperEnhancedBookmarkNode[], searchStore: IDBObjectStore): Promise<void> {
        const searchIndex = new Map<string, Set<string>>()

        // 为每个书签构建搜索关键词
        for (const bookmark of bookmarks) {
            const keywords = [
                ...bookmark.searchKeywords,
                ...bookmark.titleWords,
                bookmark.normalizedTitle,
                bookmark.domain || ''
            ].filter(word => word && word.length >= 2) // 过滤太短的词

            for (const keyword of keywords) {
                if (!searchIndex.has(keyword)) {
                    searchIndex.set(keyword, new Set())
                }
                searchIndex.get(keyword)!.add(bookmark.id)
            }
        }

        // 保存搜索索引
        for (const [keyword, bookmarkIds] of searchIndex.entries()) {
            await this.promisifyRequest(searchStore.put({
                keyword,
                bookmarkIds: Array.from(bookmarkIds),
                timestamp: Date.now()
            }))
        }

        console.log(`🔍 构建搜索索引: ${searchIndex.size}个关键词`)
    }

    /**
     * 根据查询条件查找书签
     */
    async queryBookmarks(query: BookmarkQuery): Promise<QueryResult<SuperEnhancedBookmarkNode>> {
        await this.ensureInitialized()

        const startTime = performance.now()
        const transaction = this.db!.transaction([this.STORES.bookmarks], 'readonly')
        const store = transaction.objectStore(this.STORES.bookmarks)

        let results: SuperEnhancedBookmarkNode[] = []

        try {
            if (query.id) {
                // 按ID精确查找
                const result = await this.promisifyRequest(store.get(query.id))
                results = result ? [result] : []
            } else if (query.parentId) {
                // 按父ID查找子节点
                const index = store.index('parentId')
                results = await this.promisifyRequest(index.getAll(query.parentId))
            } else if (query.domain) {
                // 按域名查找
                const index = store.index('domain')
                results = await this.promisifyRequest(index.getAll(query.domain))
            } else if (query.pathIds && query.pathIds.length > 0) {
                // 按路径ID查找（使用新增的pathIds字段）
                const targetId = query.pathIds[query.pathIds.length - 1]
                const result = await this.promisifyRequest(store.get(targetId))

                // 验证路径匹配
                if (result && this.pathMatches(result.pathIds, query.pathIds)) {
                    results = [result]
                }
            } else {
                // 全表扫描（慎用）
                results = await this.promisifyRequest(store.getAll())
            }

            // 应用额外过滤条件
            if (query.titleContains) {
                const searchTerm = query.titleContains.toLowerCase()
                results = results.filter(bookmark =>
                    bookmark.normalizedTitle.includes(searchTerm)
                )
            }

            if (query.urlContains) {
                const searchTerm = query.urlContains.toLowerCase()
                results = results.filter(bookmark =>
                    bookmark.url?.toLowerCase().includes(searchTerm)
                )
            }

            // 分页处理
            const total = results.length
            const offset = query.offset || 0
            const limit = query.limit || total

            if (offset > 0 || limit < total) {
                results = results.slice(offset, offset + limit)
            }

            const queryTime = performance.now() - startTime
            console.log(`🔍 查询完成: ${results.length}/${total}条结果, 耗时: ${queryTime.toFixed(2)}ms`)

            return {
                data: results,
                total,
                hasMore: offset + results.length < total
            }

        } catch (error) {
            console.error('❌ 查询失败:', error)
            throw error
        }
    }

    /**
     * 验证路径ID是否匹配
     */
    private pathMatches(actualPath: string[], expectedPath: string[]): boolean {
        if (actualPath.length !== expectedPath.length) return false
        return actualPath.every((id, index) => id === expectedPath[index])
    }

    /**
     * 全文搜索书签
     */
    async searchBookmarks(searchTerm: string, limit: number = 50): Promise<QueryResult<SuperEnhancedBookmarkNode>> {
        await this.ensureInitialized()

        const startTime = performance.now()
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length >= 2)

        if (keywords.length === 0) {
            return { data: [], total: 0, hasMore: false }
        }

        const transaction = this.db!.transaction([this.STORES.searchIndex, this.STORES.bookmarks], 'readonly')
        const searchStore = transaction.objectStore(this.STORES.searchIndex)
        const bookmarkStore = transaction.objectStore(this.STORES.bookmarks)

        try {
            // 收集匹配的书签ID
            const matchedBookmarkIds = new Set<string>()

            for (const keyword of keywords) {
                const searchResult = await this.promisifyRequest(searchStore.get(keyword))
                if (searchResult && searchResult.bookmarkIds) {
                    searchResult.bookmarkIds.forEach((id: string) => matchedBookmarkIds.add(id))
                }
            }

            // 获取书签详细信息
            const bookmarks: SuperEnhancedBookmarkNode[] = []
            for (const bookmarkId of Array.from(matchedBookmarkIds).slice(0, limit)) {
                const bookmark = await this.promisifyRequest(bookmarkStore.get(bookmarkId))
                if (bookmark) {
                    bookmarks.push(bookmark)
                }
            }

            const searchTime = performance.now() - startTime
            console.log(`🔍 全文搜索完成: ${bookmarks.length}条结果, 耗时: ${searchTime.toFixed(2)}ms`)

            return {
                data: bookmarks,
                total: matchedBookmarkIds.size,
                hasMore: matchedBookmarkIds.size > limit
            }

        } catch (error) {
            console.error('❌ 搜索失败:', error)
            throw error
        }
    }

    /**
     * 获取存储统计信息
     */
    async getStorageStats(): Promise<{
        totalBookmarks: number
        totalSize: number
        indexCount: number
        performanceMetrics: {
            avgQueryTime: number
            avgInsertTime: number
        }
    }> {
        await this.ensureInitialized()

        const transaction = this.db!.transaction([
            this.STORES.bookmarks,
            this.STORES.searchIndex,
            this.STORES.metadata
        ], 'readonly')

        try {
            const bookmarkCount = await this.promisifyRequest(
                transaction.objectStore(this.STORES.bookmarks).count()
            )
            const indexCount = await this.promisifyRequest(
                transaction.objectStore(this.STORES.searchIndex).count()
            )

            return {
                totalBookmarks: bookmarkCount,
                totalSize: 0, // 需要额外计算
                indexCount,
                performanceMetrics: {
                    avgQueryTime: 0, // 需要实际测量
                    avgInsertTime: 0  // 需要实际测量
                }
            }
        } catch (error) {
            console.error('❌ 获取统计信息失败:', error)
            throw error
        }
    }

    /**
     * 清空指定的对象存储
     */
    private async clearStore(store: IDBObjectStore): Promise<void> {
        await this.promisifyRequest(store.clear())
    }

    /**
     * 将IDBRequest转换为Promise
     */
    private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * 确保IndexedDB已初始化
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.db) {
            await this.initialize()
        }
    }

    /**
     * 关闭数据库连接
     */
    close(): void {
        if (this.db) {
            this.db.close()
            this.db = null
        }
    }
}

// 全局实例
export const indexedDBAdapter = new IndexedDBStorageAdapter()
