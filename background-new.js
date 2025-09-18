/**
 * AcuityBookmarks Service Worker - 统一架构版本
 * 
 * 核心职责：
 * 1. 数据预处理中心 - 从Chrome API获取数据，进行深度处理
 * 2. IndexedDB管理 - 统一的数据存储和访问
 * 3. 消息处理中心 - 响应前端页面的API调用
 * 4. 数据同步服务 - 定期与Chrome书签同步
 * 5. 图标缓存管理 - 网站图标获取和缓存
 */

// ==================== 导入核心模块 ====================

// 注意：Service Worker中无法直接import ES模块
// 需要将核心组件的类定义复制到这里，或者使用importScripts

// 由于Chrome扩展的限制，我们需要重新定义核心类
// 在真实项目中，可以考虑使用打包工具来处理这个问题

// ==================== 数据库配置 ====================

const DB_CONFIG = {
    NAME: 'AcuityBookmarksDB',
    VERSION: 2,
    STORES: {
        BOOKMARKS: 'bookmarks',
        GLOBAL_STATS: 'globalStats',
        SETTINGS: 'settings',
        SEARCH_HISTORY: 'searchHistory',
        FAVICON_CACHE: 'faviconCache',
        FAVICON_STATS: 'faviconStats'
    }
}

const CURRENT_DATA_VERSION = '2.0.0'
const SYNC_INTERVAL = 60000 // 1分钟同步间隔

// ==================== IndexedDB管理器 ====================

class ServiceWorkerIndexedDBManager {
    constructor() {
        this.db = null
        this.isInitialized = false
        this.initPromise = null
    }

    async initialize() {
        if (this.isInitialized) {
            return
        }

        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = this._doInitialize()
        return this.initPromise
    }

    async _doInitialize() {
        console.log('🚀 [Service Worker] IndexedDB初始化开始...', {
            name: DB_CONFIG.NAME,
            version: DB_CONFIG.VERSION
        })

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)

            request.onerror = () => {
                const error = request.error
                console.error('❌ [Service Worker] IndexedDB初始化失败:', error)
                this.initPromise = null
                reject(new Error(`IndexedDB初始化失败: ${error?.message || 'Unknown error'}`))
            }

            request.onsuccess = () => {
                this.db = request.result
                this.isInitialized = true
                this.initPromise = null

                console.log('✅ [Service Worker] IndexedDB初始化成功', {
                    version: this.db.version,
                    stores: Array.from(this.db.objectStoreNames)
                })

                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = event.target.result
                const oldVersion = event.oldVersion
                const newVersion = event.newVersion

                console.log('🔧 [Service Worker] 数据库升级', {
                    from: oldVersion,
                    to: newVersion
                })

                try {
                    this._createStores(db)
                    console.log('✅ [Service Worker] 表结构创建完成')
                } catch (error) {
                    console.error('❌ [Service Worker] 表结构创建失败:', error)
                    throw error
                }
            }

            request.onblocked = () => {
                console.warn('⚠️ [Service Worker] 升级被阻塞，其他标签页可能正在使用数据库')
            }
        })
    }

    _createStores(db) {
        // 创建书签表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOOKMARKS)) {
            console.log('📊 [Service Worker] 创建书签表...')
            const bookmarkStore = db.createObjectStore(DB_CONFIG.STORES.BOOKMARKS, {
                keyPath: 'id'
            })

            // 创建高性能索引
            bookmarkStore.createIndex('parentId', 'parentId', { unique: false })
            bookmarkStore.createIndex('url', 'url', { unique: false })
            bookmarkStore.createIndex('domain', 'domain', { unique: false })
            bookmarkStore.createIndex('titleLower', 'titleLower', { unique: false })
            bookmarkStore.createIndex('depth', 'depth', { unique: false })
            bookmarkStore.createIndex('pathIds', 'pathIds', { unique: false, multiEntry: true })
            bookmarkStore.createIndex('keywords', 'keywords', { unique: false, multiEntry: true })
            bookmarkStore.createIndex('tags', 'tags', { unique: false, multiEntry: true })
            bookmarkStore.createIndex('dateAdded', 'dateAdded', { unique: false })
            bookmarkStore.createIndex('isFolder', 'isFolder', { unique: false })
            bookmarkStore.createIndex('category', 'category', { unique: false })
            bookmarkStore.createIndex('createdYear', 'createdYear', { unique: false })
            bookmarkStore.createIndex('visitCount', 'visitCount', { unique: false })

            console.log('✅ [Service Worker] 书签表创建完成')
        }

        // 创建全局统计表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.GLOBAL_STATS)) {
            console.log('📊 [Service Worker] 创建全局统计表...')
            db.createObjectStore(DB_CONFIG.STORES.GLOBAL_STATS, {
                keyPath: 'key'
            })
            console.log('✅ [Service Worker] 全局统计表创建完成')
        }

        // 创建设置表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SETTINGS)) {
            console.log('📊 [Service Worker] 创建设置表...')
            const settingsStore = db.createObjectStore(DB_CONFIG.STORES.SETTINGS, {
                keyPath: 'key'
            })
            settingsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
            settingsStore.createIndex('type', 'type', { unique: false })
            console.log('✅ [Service Worker] 设置表创建完成')
        }

        // 创建搜索历史表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SEARCH_HISTORY)) {
            console.log('📊 [Service Worker] 创建搜索历史表...')
            const historyStore = db.createObjectStore(DB_CONFIG.STORES.SEARCH_HISTORY, {
                keyPath: 'id',
                autoIncrement: true
            })
            historyStore.createIndex('query', 'query', { unique: false })
            historyStore.createIndex('timestamp', 'timestamp', { unique: false })
            historyStore.createIndex('source', 'source', { unique: false })
            console.log('✅ [Service Worker] 搜索历史表创建完成')
        }

        // 创建图标缓存表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_CACHE)) {
            console.log('📊 [Service Worker] 创建图标缓存表...')
            const faviconStore = db.createObjectStore(DB_CONFIG.STORES.FAVICON_CACHE, {
                keyPath: 'domain'
            })
            faviconStore.createIndex('timestamp', 'timestamp', { unique: false })
            faviconStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })
            faviconStore.createIndex('accessCount', 'accessCount', { unique: false })
            faviconStore.createIndex('bookmarkCount', 'bookmarkCount', { unique: false })
            faviconStore.createIndex('isPopular', 'isPopular', { unique: false })
            faviconStore.createIndex('quality', 'quality', { unique: false })
            faviconStore.createIndex('expiresAt', 'expiresAt', { unique: false })
            console.log('✅ [Service Worker] 图标缓存表创建完成')
        }

        // 创建图标统计表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_STATS)) {
            console.log('📊 [Service Worker] 创建图标统计表...')
            const faviconStatsStore = db.createObjectStore(DB_CONFIG.STORES.FAVICON_STATS, {
                keyPath: 'key'
            })
            faviconStatsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
            console.log('✅ [Service Worker] 图标统计表创建完成')
        }
    }

    _ensureDB() {
        if (!this.db) {
            throw new Error('IndexedDB未初始化，请先调用initialize()')
        }
        return this.db
    }

    // 批量插入书签
    async insertBookmarks(bookmarks) {
        const db = this._ensureDB()
        const batchSize = 1000

        console.log(`📥 [Service Worker] 开始批量插入 ${bookmarks.length} 条书签...`)
        const startTime = performance.now()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)

            let processed = 0

            transaction.oncomplete = () => {
                const duration = performance.now() - startTime
                console.log(`✅ [Service Worker] 批量插入完成: ${processed}/${bookmarks.length} 条书签, 耗时: ${duration.toFixed(2)}ms`)
                resolve()
            }

            transaction.onerror = () => {
                console.error('❌ [Service Worker] 批量插入失败:', transaction.error)
                reject(transaction.error)
            }

            // 分批处理
            const processBatch = (startIndex) => {
                const endIndex = Math.min(startIndex + batchSize, bookmarks.length)

                for (let i = startIndex; i < endIndex; i++) {
                    const bookmark = bookmarks[i]
                    const request = store.put(bookmark)

                    request.onsuccess = () => {
                        processed++

                        if (processed % 100 === 0) {
                            console.log(`📊 [Service Worker] 插入进度: ${processed}/${bookmarks.length}`)
                        }

                        if (processed === endIndex && endIndex < bookmarks.length) {
                            setTimeout(() => processBatch(endIndex), 0)
                        }
                    }

                    request.onerror = () => {
                        console.error(`❌ [Service Worker] 插入书签失败: ${bookmark.id}`)
                    }
                }
            }

            processBatch(0)
        })
    }

    // 获取所有书签
    async getAllBookmarks() {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const request = store.getAll()

            request.onsuccess = () => {
                resolve(request.result || [])
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // 根据ID获取书签
    async getBookmarkById(id) {
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

    // 根据父ID获取子书签
    async getChildrenByParentId(parentId) {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const index = store.index('parentId')
            const request = index.getAll(parentId)

            request.onsuccess = () => {
                const results = request.result.sort((a, b) => a.index - b.index)
                resolve(results)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // 搜索书签
    async searchBookmarks(query, options = {}) {
        const db = this._ensureDB()
        const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)

        if (searchTerms.length === 0) {
            return []
        }

        const { limit = 100, minScore = 0 } = options

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const results = []

            const request = store.openCursor()

            request.onsuccess = () => {
                const cursor = request.result

                if (cursor && results.length < limit) {
                    const bookmark = cursor.value
                    const searchResult = this._calculateSearchScore(bookmark, searchTerms, options)

                    if (searchResult.score > minScore) {
                        results.push(searchResult)
                    }

                    cursor.continue()
                } else {
                    // 按分数排序
                    results.sort((a, b) => b.score - a.score)
                    resolve(results)
                }
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    _calculateSearchScore(bookmark, searchTerms, options) {
        let score = 0
        const matchedFields = []
        const highlights = {}

        for (const term of searchTerms) {
            // 标题匹配
            if (bookmark.titleLower.includes(term)) {
                const weight = bookmark.titleLower.startsWith(term) ? 100 : 50
                score += weight
                matchedFields.push('title')
                if (!highlights.title) highlights.title = []
                highlights.title.push(term)
            }

            // URL匹配
            if (bookmark.urlLower && bookmark.urlLower.includes(term)) {
                score += 30
                matchedFields.push('url')
                if (!highlights.url) highlights.url = []
                highlights.url.push(term)
            }

            // 域名匹配
            if (bookmark.domain && bookmark.domain.includes(term)) {
                score += 20
                matchedFields.push('domain')
                if (!highlights.domain) highlights.domain = []
                highlights.domain.push(term)
            }

            // 关键词匹配
            if (bookmark.keywords && bookmark.keywords.some(keyword => keyword.includes(term))) {
                score += 15
                matchedFields.push('keywords')
                if (!highlights.keywords) highlights.keywords = []
                highlights.keywords.push(term)
            }

            // 标签匹配
            if (bookmark.tags && bookmark.tags.some(tag => tag.toLowerCase().includes(term))) {
                score += 10
                matchedFields.push('tags')
                if (!highlights.tags) highlights.tags = []
                highlights.tags.push(term)
            }
        }

        return {
            bookmark,
            score,
            matchedFields: [...new Set(matchedFields)],
            highlights
        }
    }

    // 清空所有书签
    async clearAllBookmarks() {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const request = store.clear()

            request.onsuccess = () => {
                console.log('✅ [Service Worker] 所有书签已清空')
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // 更新全局统计
    async updateGlobalStats(stats) {
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

    // 获取全局统计
    async getGlobalStats() {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.GLOBAL_STATS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.GLOBAL_STATS)
            const request = store.get('basic')

            request.onsuccess = () => {
                const result = request.result
                if (result) {
                    const { key, ...stats } = result
                    resolve(stats)
                } else {
                    resolve(null)
                }
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // 添加搜索历史
    async addSearchHistory(query, results, executionTime = 0, source = 'management') {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)

            const historyRecord = {
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

    // 获取搜索历史
    async getSearchHistory(limit = 20) {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)
            const index = store.index('timestamp')

            const results = []
            const request = index.openCursor(null, 'prev')

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

    // 清空搜索历史
    async clearSearchHistory() {
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

    // 保存设置
    async saveSetting(key, value, type, description) {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SETTINGS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)

            const setting = {
                key,
                value,
                type: type || typeof value,
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

    // 获取设置
    async getSetting(key) {
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

    // 删除设置
    async deleteSetting(key) {
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

    // 检查数据库健康状态
    async checkDatabaseHealth() {
        try {
            const db = this._ensureDB()
            const expectedStores = Object.values(DB_CONFIG.STORES)
            const existingStores = Array.from(db.objectStoreNames)

            const missingStores = expectedStores.filter(store => !existingStores.includes(store))
            const extraStores = existingStores.filter(store => !expectedStores.includes(store))

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
                errors: [error.message]
            }
        }
    }

    // 获取数据库统计
    async getDatabaseStats() {
        const db = this._ensureDB()

        const getStoreCount = (storeName) => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly')
                const store = transaction.objectStore(storeName)
                const request = store.count()

                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
        }

        try {
            const [bookmarkCount, faviconCount, searchHistoryCount, settingsCount] = await Promise.all([
                getStoreCount(DB_CONFIG.STORES.BOOKMARKS),
                getStoreCount(DB_CONFIG.STORES.FAVICON_CACHE),
                getStoreCount(DB_CONFIG.STORES.SEARCH_HISTORY),
                getStoreCount(DB_CONFIG.STORES.SETTINGS)
            ])

            const totalSize = bookmarkCount * 1000 + faviconCount * 2000 + searchHistoryCount * 100 + settingsCount * 50

            return {
                bookmarkCount,
                faviconCount,
                searchHistoryCount,
                settingsCount,
                totalSize,
                indexSize: totalSize * 0.1,
                lastOptimized: Date.now()
            }
        } catch (error) {
            throw new Error(`获取数据库统计失败: ${error.message}`)
        }
    }
}

// ==================== 数据预处理器 ====================

class ServiceWorkerBookmarkPreprocessor {
    constructor() {
        this.urlRegex = /^https?:\/\//
        this.domainRegex = /^https?:\/\/([^\/]+)/
    }

    async processBookmarks() {
        console.log('🚀 [预处理器] 开始处理书签数据...')
        const startTime = performance.now()

        try {
            // 1. 从Chrome API获取原始数据
            const chromeTree = await this._getChromeBookmarks()
            const originalDataHash = this._generateDataHash(chromeTree)

            // 2. 扁平化处理
            const flatBookmarks = this._flattenBookmarks(chromeTree)
            console.log(`📊 [预处理器] 扁平化完成: ${flatBookmarks.length} 个节点`)

            // 3. 增强处理
            const enhancedBookmarks = this._enhanceBookmarks(flatBookmarks)

            // 4. 生成统计信息
            const stats = this._generateStats(enhancedBookmarks)

            const endTime = performance.now()
            const processingTime = endTime - startTime

            console.log(`✅ [预处理器] 处理完成: ${enhancedBookmarks.length} 条记录, 耗时: ${processingTime.toFixed(2)}ms`)

            return {
                bookmarks: enhancedBookmarks,
                stats,
                metadata: {
                    originalDataHash,
                    processedAt: Date.now(),
                    version: CURRENT_DATA_VERSION,
                    processingTime
                }
            }

        } catch (error) {
            console.error('❌ [预处理器] 处理失败:', error)
            throw new Error(`书签预处理失败: ${error.message}`)
        }
    }

    async _getChromeBookmarks() {
        return new Promise((resolve, reject) => {
            if (!chrome?.bookmarks?.getTree) {
                reject(new Error('Chrome Bookmarks API 不可用'))
                return
            }

            chrome.bookmarks.getTree((tree) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message))
                } else {
                    resolve(tree || [])
                }
            })
        })
    }

    _flattenBookmarks(tree, parentPath = [], parentIds = []) {
        const flattened = []

        for (const node of tree) {
            if (node.id === '0') {
                if (node.children) {
                    flattened.push(...this._flattenBookmarks(node.children, [], []))
                }
                continue
            }

            flattened.push({
                ...node,
                _parentPath: parentPath,
                _parentIds: parentIds
            })

            if (node.children && node.children.length > 0) {
                const childPath = [...parentPath, node.title]
                const childIds = [...parentIds, node.id]
                flattened.push(...this._flattenBookmarks(node.children, childPath, childIds))
            }
        }

        return flattened
    }

    _enhanceBookmarks(flatBookmarks) {
        const enhanced = []
        const childrenMap = new Map()

        // 建立父子关系映射
        for (const bookmark of flatBookmarks) {
            if (bookmark.parentId) {
                if (!childrenMap.has(bookmark.parentId)) {
                    childrenMap.set(bookmark.parentId, [])
                }
                childrenMap.get(bookmark.parentId).push(bookmark)
            }
        }

        for (let i = 0; i < flatBookmarks.length; i++) {
            const node = flatBookmarks[i]

            if (i % 100 === 0) {
                console.log(`📊 [预处理器] 增强进度: ${i}/${flatBookmarks.length}`)
            }

            const enhanced_record = this._enhanceSingleBookmark(node, childrenMap)
            enhanced.push(enhanced_record)
        }

        // 计算兄弟节点关系
        this._calculateSiblingRelations(enhanced)

        return enhanced
    }

    _enhanceSingleBookmark(node, childrenMap) {
        const isFolder = !node.url
        const children = childrenMap.get(node.id) || []

        const parentPath = node._parentPath || []
        const parentIds = node._parentIds || []
        const path = [...parentPath, node.title]
        const pathIds = [...parentIds, node.id]

        let domain, urlLower
        if (node.url) {
            urlLower = node.url.toLowerCase()
            const domainMatch = node.url.match(this.domainRegex)
            if (domainMatch) {
                domain = domainMatch[1].toLowerCase()
            }
        }

        const keywords = this._generateKeywords(node.title, node.url, domain)
        const { bookmarksCount, folderCount, childrenCount } = this._calculateCounts(children, childrenMap)
        const category = this._analyzeCategory(node.title, node.url, domain)

        return {
            id: node.id,
            parentId: node.parentId,
            title: node.title,
            url: node.url,
            dateAdded: node.dateAdded,
            dateGroupModified: node.dateGroupModified,
            index: node.index || 0,

            path,
            pathString: path.join(' / '),
            pathIds,
            pathIdsString: pathIds.join(' / '),
            ancestorIds: parentIds,
            siblingIds: [],
            depth: pathIds.length,

            titleLower: node.title.toLowerCase(),
            urlLower,
            domain,
            keywords,

            isFolder,
            childrenCount,
            bookmarksCount,
            folderCount,

            tags: [],
            category,
            notes: undefined,
            lastVisited: undefined,
            visitCount: 0,

            createdYear: node.dateAdded ? new Date(node.dateAdded).getFullYear() : new Date().getFullYear(),
            createdMonth: node.dateAdded ? new Date(node.dateAdded).getMonth() + 1 : new Date().getMonth() + 1,
            domainCategory: domain ? this._categorizeDomain(domain) : undefined,

            flatIndex: 0,
            isVisible: true,
            sortKey: `${String(node.index || 0).padStart(10, '0')}_${node.title}`,

            dataVersion: CURRENT_DATA_VERSION,
            lastCalculated: Date.now()
        }
    }

    _calculateSiblingRelations(bookmarks) {
        const siblingGroups = new Map()

        for (const bookmark of bookmarks) {
            const parentId = bookmark.parentId || 'root'
            if (!siblingGroups.has(parentId)) {
                siblingGroups.set(parentId, [])
            }
            siblingGroups.get(parentId).push(bookmark)
        }

        for (const siblings of siblingGroups.values()) {
            for (const bookmark of siblings) {
                bookmark.siblingIds = siblings
                    .filter(sibling => sibling.id !== bookmark.id)
                    .map(sibling => sibling.id)
            }
        }
    }

    _calculateCounts(children, childrenMap) {
        let bookmarksCount = 0
        let folderCount = 0
        const childrenCount = children.length

        for (const child of children) {
            if (child.url) {
                bookmarksCount++
            } else {
                folderCount++
                const grandChildren = childrenMap.get(child.id) || []
                const subCounts = this._calculateCounts(grandChildren, childrenMap)
                bookmarksCount += subCounts.bookmarksCount
                folderCount += subCounts.folderCount
            }
        }

        return { bookmarksCount, folderCount, childrenCount }
    }

    _generateKeywords(title, url, domain, maxKeywords = 10) {
        const keywords = new Set()

        const titleWords = title
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length >= 2)

        titleWords.forEach(word => keywords.add(word))

        if (url) {
            const urlKeywords = url
                .toLowerCase()
                .replace(/https?:\/\//, '')
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length >= 2)

            urlKeywords.slice(0, 3).forEach(word => keywords.add(word))
        }

        if (domain) {
            keywords.add(domain)
            const domainParts = domain.split('.')
            if (domainParts.length >= 2) {
                keywords.add(domainParts[domainParts.length - 2])
            }
        }

        return Array.from(keywords).slice(0, maxKeywords)
    }

    _analyzeCategory(title, url, domain) {
        const titleLower = title.toLowerCase()
        const urlLower = url?.toLowerCase() || ''

        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'github', 'stackoverflow', 'developer', 'api', 'documentation', 'code', 'programming',
            'react', 'vue', 'angular', 'javascript', 'typescript', 'python', 'java', 'css', 'html'
        ])) {
            return 'technology'
        }

        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'news', 'article', 'blog', 'medium', 'zhihu', 'juejin', '新闻', '文章', '博客'
        ])) {
            return 'news'
        }

        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'tool', 'utility', 'service', 'app', 'software', '工具', '应用', '服务'
        ])) {
            return 'tools'
        }

        return undefined
    }

    _matchesKeywords(text, keywords) {
        return keywords.some(keyword => text.includes(keyword))
    }

    _categorizeDomain(domain) {
        if (['twitter.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'weibo.com'].includes(domain)) {
            return 'social'
        }
        if (['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com'].includes(domain)) {
            return 'tech'
        }
        if (['bbc.com', 'cnn.com', 'nytimes.com', 'reuters.com', 'xinhuanet.com'].includes(domain)) {
            return 'news'
        }
        return 'other'
    }

    _generateStats(bookmarks) {
        const folderBookmarks = bookmarks.filter(b => b.isFolder)
        const urlBookmarks = bookmarks.filter(b => !b.isFolder)

        const domainCounts = new Map()
        urlBookmarks.forEach(bookmark => {
            if (bookmark.domain) {
                domainCounts.set(bookmark.domain, (domainCounts.get(bookmark.domain) || 0) + 1)
            }
        })

        const topDomains = Array.from(domainCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([domain, count]) => ({
                domain,
                count,
                percentage: Math.round((count / urlBookmarks.length) * 100 * 100) / 100
            }))

        const creationTimeline = new Map()
        bookmarks.forEach(bookmark => {
            if (bookmark.dateAdded) {
                const date = new Date(bookmark.dateAdded)
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                creationTimeline.set(key, (creationTimeline.get(key) || 0) + 1)
            }
        })

        const categoryDistribution = new Map()
        bookmarks.forEach(bookmark => {
            if (bookmark.category) {
                categoryDistribution.set(bookmark.category, (categoryDistribution.get(bookmark.category) || 0) + 1)
            }
        })

        const urlCounts = new Map()
        urlBookmarks.forEach(bookmark => {
            if (bookmark.url) {
                urlCounts.set(bookmark.url, (urlCounts.get(bookmark.url) || 0) + 1)
            }
        })
        const duplicateUrls = Array.from(urlCounts.values()).filter(count => count > 1).length

        const emptyFolders = folderBookmarks.filter(folder => folder.childrenCount === 0).length
        const maxDepth = Math.max(...bookmarks.map(b => b.depth), 0)

        return {
            totalBookmarks: urlBookmarks.length,
            totalFolders: folderBookmarks.length,
            totalNodes: bookmarks.length,
            maxDepth,
            totalDomains: domainCounts.size,
            topDomains,
            creationTimeline,
            categoryDistribution,
            duplicateUrls,
            emptyFolders,
            brokenLinks: 0,
            memoryUsage: {
                nodeCount: bookmarks.length,
                indexCount: 0,
                estimatedBytes: JSON.stringify(bookmarks).length
            },
            lastUpdated: Date.now(),
            version: CURRENT_DATA_VERSION
        }
    }

    _generateDataHash(data) {
        try {
            const simplified = this._simplifyDataForHash(data)
            const jsonString = JSON.stringify(simplified)

            if (!jsonString || jsonString === 'undefined' || jsonString === 'null' || jsonString === '[]') {
                return `empty_${Date.now()}`
            }

            return this._simpleHash(jsonString)
        } catch (error) {
            console.error('❌ [预处理器] 生成数据哈希失败:', error)
            return `error_${Date.now()}`
        }
    }

    _simplifyDataForHash(data) {
        if (!data) return null

        if (Array.isArray(data)) {
            return data.map(item => this._simplifyDataForHash(item))
        }

        if (typeof data === 'object') {
            const simplified = {}
            for (const [key, value] of Object.entries(data)) {
                if (['id', 'title', 'url', 'parentId', 'dateAdded'].includes(key)) {
                    simplified[key] = value
                }
            }
            return simplified
        }

        return data
    }

    _simpleHash(str) {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return Math.abs(hash).toString(36)
    }
}

// ==================== 书签管理服务 ====================

class BookmarkManagerService {
    constructor() {
        this.dbManager = new ServiceWorkerIndexedDBManager()
        this.preprocessor = new ServiceWorkerBookmarkPreprocessor()
        this.isReady = false
        this.lastSyncTime = 0
        this.lastDataHash = null
    }

    async initialize() {
        console.log('🚀 [书签管理服务] 初始化开始...')

        try {
            // 1. 初始化数据库
            await this.dbManager.initialize()

            // 2. 检查是否需要首次数据加载
            const stats = await this.dbManager.getGlobalStats()
            if (!stats) {
                console.log('📊 [书签管理服务] 首次使用，加载书签数据...')
                await this.loadBookmarkData()
            } else {
                console.log('📊 [书签管理服务] 数据已存在，检查是否需要同步...')
                await this.checkAndSync()
            }

            this.isReady = true
            console.log('✅ [书签管理服务] 初始化完成')

            // 3. 启动定期同步
            this.startPeriodicSync()

        } catch (error) {
            console.error('❌ [书签管理服务] 初始化失败:', error)
            throw error
        }
    }

    async loadBookmarkData() {
        console.log('🔄 [书签管理服务] 重新加载书签数据...')

        try {
            // 1. 预处理书签数据
            const result = await this.preprocessor.processBookmarks()

            // 2. 清空现有数据
            await this.dbManager.clearAllBookmarks()

            // 3. 批量插入新数据
            await this.dbManager.insertBookmarks(result.bookmarks)

            // 4. 更新统计信息
            await this.dbManager.updateGlobalStats(result.stats)

            // 5. 更新状态
            this.lastDataHash = result.metadata.originalDataHash
            this.lastSyncTime = Date.now()

            console.log('✅ [书签管理服务] 书签数据加载完成')

        } catch (error) {
            console.error('❌ [书签管理服务] 加载书签数据失败:', error)
            throw error
        }
    }

    async checkAndSync() {
        try {
            // 简化的同步检查：直接重新加载
            // 在生产环境中，这里可以实现更精细的增量同步
            const chromeTree = await this.preprocessor._getChromeBookmarks()
            const currentHash = this.preprocessor._generateDataHash(chromeTree)

            if (currentHash !== this.lastDataHash) {
                console.log('🔄 [书签管理服务] 检测到Chrome书签变化，开始同步...')
                await this.loadBookmarkData()
                return true
            }

            console.log('✅ [书签管理服务] 数据已是最新，无需同步')
            return false

        } catch (error) {
            console.error('❌ [书签管理服务] 同步检查失败:', error)
            return false
        }
    }

    startPeriodicSync() {
        setInterval(async () => {
            try {
                await this.checkAndSync()
            } catch (error) {
                console.warn('⚠️ [书签管理服务] 定期同步失败:', error)
            }
        }, SYNC_INTERVAL)

        console.log(`🔄 [书签管理服务] 定期同步已启动，间隔: ${SYNC_INTERVAL}ms`)
    }

    // 健康检查
    async healthCheck() {
        try {
            await this.dbManager._ensureDB()
            const stats = await this.dbManager.getGlobalStats()

            return {
                success: true,
                ready: this.isReady && !!stats,
                initialized: this.dbManager.isInitialized,
                dataVersion: CURRENT_DATA_VERSION,
                lastUpdate: this.lastSyncTime
            }
        } catch (error) {
            return {
                success: false,
                ready: false,
                initialized: false,
                error: error.message
            }
        }
    }

    // API方法代理
    async getAllBookmarks() {
        return this.dbManager.getAllBookmarks()
    }

    async getBookmarkById(id) {
        return this.dbManager.getBookmarkById(id)
    }

    async getChildrenByParentId(parentId) {
        return this.dbManager.getChildrenByParentId(parentId)
    }

    async searchBookmarks(query, options) {
        return this.dbManager.searchBookmarks(query, options)
    }

    async getGlobalStats() {
        return this.dbManager.getGlobalStats()
    }

    async getDatabaseHealth() {
        return this.dbManager.checkDatabaseHealth()
    }

    async getDatabaseStats() {
        return this.dbManager.getDatabaseStats()
    }

    async getSearchHistory(limit) {
        return this.dbManager.getSearchHistory(limit)
    }

    async addSearchHistory(query, results, executionTime, source) {
        return this.dbManager.addSearchHistory(query, results, executionTime, source)
    }

    async clearSearchHistory() {
        return this.dbManager.clearSearchHistory()
    }

    async getSetting(key) {
        return this.dbManager.getSetting(key)
    }

    async saveSetting(key, value, type, description) {
        return this.dbManager.saveSetting(key, value, type, description)
    }

    async deleteSetting(key) {
        return this.dbManager.deleteSetting(key)
    }

    async forceReload() {
        await this.loadBookmarkData()
    }

    async syncBookmarks() {
        return this.checkAndSync()
    }
}

// ==================== 全局实例 ====================

const bookmarkManager = new BookmarkManagerService()

// ==================== 消息处理中心 ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, data } = message

    console.log(`📨 [Service Worker] 收到消息: ${type}`, data)

    const handleMessage = async () => {
        try {
            switch (type) {
                case 'HEALTH_CHECK':
                    return await bookmarkManager.healthCheck()

                case 'GET_ALL_BOOKMARKS':
                    const bookmarks = await bookmarkManager.getAllBookmarks()
                    return { success: true, data: bookmarks }

                case 'GET_BOOKMARK_BY_ID':
                    const bookmark = await bookmarkManager.getBookmarkById(data.id)
                    return { success: true, data: bookmark }

                case 'GET_CHILDREN_BY_PARENT_ID':
                    const children = await bookmarkManager.getChildrenByParentId(data.parentId)
                    return { success: true, data: children }

                case 'SEARCH_BOOKMARKS':
                    const results = await bookmarkManager.searchBookmarks(data.query, data.options)
                    return { success: true, data: results }

                case 'GET_GLOBAL_STATS':
                    const stats = await bookmarkManager.getGlobalStats()
                    return { success: true, data: stats }

                case 'SYNC_BOOKMARKS':
                    const changed = await bookmarkManager.syncBookmarks()
                    return { success: true, data: { changed } }

                case 'FORCE_RELOAD_DATA':
                    await bookmarkManager.forceReload()
                    return { success: true }

                case 'GET_DATABASE_HEALTH':
                    const health = await bookmarkManager.getDatabaseHealth()
                    return { success: true, data: health }

                case 'GET_DATABASE_STATS':
                    const dbStats = await bookmarkManager.getDatabaseStats()
                    return { success: true, data: dbStats }

                case 'GET_SEARCH_HISTORY':
                    const history = await bookmarkManager.getSearchHistory(data.limit)
                    return { success: true, data: history }

                case 'ADD_SEARCH_HISTORY':
                    await bookmarkManager.addSearchHistory(data.query, data.resultCount, data.executionTime, data.source)
                    return { success: true }

                case 'CLEAR_SEARCH_HISTORY':
                    await bookmarkManager.clearSearchHistory()
                    return { success: true }

                case 'GET_SETTING':
                    const setting = await bookmarkManager.getSetting(data.key)
                    return { success: true, data: setting }

                case 'SAVE_SETTING':
                    await bookmarkManager.saveSetting(data.key, data.value, undefined, data.description)
                    return { success: true }

                case 'DELETE_SETTING':
                    await bookmarkManager.deleteSetting(data.key)
                    return { success: true }

                default:
                    throw new Error(`未知消息类型: ${type}`)
            }
        } catch (error) {
            console.error(`❌ [Service Worker] 处理消息失败 ${type}:`, error)
            return { success: false, error: error.message }
        }
    }

    // 异步处理消息
    handleMessage().then(response => {
        console.log(`📤 [Service Worker] 响应消息 ${type}:`, response)
        sendResponse(response)
    }).catch(error => {
        console.error(`❌ [Service Worker] 消息处理异常 ${type}:`, error)
        sendResponse({ success: false, error: error.message })
    })

    // 返回true表示异步响应
    return true
})

// ==================== Service Worker生命周期 ====================

// Service Worker安装事件
self.addEventListener('install', (event) => {
    console.log('🚀 [Service Worker] 安装中...')
    self.skipWaiting()
})

// Service Worker激活事件
self.addEventListener('activate', (event) => {
    console.log('🚀 [Service Worker] 激活中...')
    event.waitUntil(clients.claim())
})

// ==================== 初始化 ====================

// 立即初始化
bookmarkManager.initialize().catch(error => {
    console.error('❌ [Service Worker] 初始化失败:', error)
})

console.log('✅ [Service Worker] AcuityBookmarks Service Worker 已启动')
