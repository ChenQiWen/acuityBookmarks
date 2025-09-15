/**
 * AcuityBookmarks Service Worker - IndexedDB版本
 * 企业级架构，支持十万条书签，移除所有缓存层
 * 完全基于IndexedDB，保证数据一致性
 */

// ==================== 核心常量 ====================
const DB_NAME = 'AcuityBookmarksDB'
const DB_VERSION = 1
const SYNC_INTERVAL = 60000 // 1分钟同步间隔

// IndexedDB存储表名
const STORES = {
    BOOKMARKS: 'bookmarks',
    SEARCH_INDEX: 'searchIndex',
    GLOBAL_STATS: 'globalStats',
    SETTINGS: 'settings',
    SEARCH_HISTORY: 'searchHistory'
}

// ==================== IndexedDB核心管理器 ====================
class ServiceWorkerIndexedDB {
    static db = null
    static isInitialized = false

    /**
     * 初始化IndexedDB
     */
    static async initialize() {
        if (this.isInitialized) return true

        console.log('🚀 Service Worker IndexedDB 初始化开始...')

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)

            request.onerror = () => {
                console.error('❌ Service Worker IndexedDB初始化失败:', request.error)
                reject(request.error)
            }

            request.onsuccess = () => {
                this.db = request.result
                this.isInitialized = true
                console.log('✅ Service Worker IndexedDB初始化成功')
                resolve(true)
            }

            request.onupgradeneeded = (event) => {
                console.log('🔧 Service Worker IndexedDB升级中...')
                const db = event.target.result

                // 创建书签表
                if (!db.objectStoreNames.contains(STORES.BOOKMARKS)) {
                    const bookmarkStore = db.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' })

                    // 创建高性能索引
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

                // 创建全局统计表
                if (!db.objectStoreNames.contains(STORES.GLOBAL_STATS)) {
                    db.createObjectStore(STORES.GLOBAL_STATS, { keyPath: 'key' })
                }

                // 创建设置表
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    const settingsStore = db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
                    settingsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
                }

                // 创建搜索索引表
                if (!db.objectStoreNames.contains(STORES.SEARCH_INDEX)) {
                    const searchIndexStore = db.createObjectStore(STORES.SEARCH_INDEX, { keyPath: 'id' })
                    searchIndexStore.createIndex('term', 'term', { unique: false })
                    searchIndexStore.createIndex('bookmarkId', 'bookmarkId', { unique: false })
                }

                // 创建搜索历史表
                if (!db.objectStoreNames.contains(STORES.SEARCH_HISTORY)) {
                    const historyStore = db.createObjectStore(STORES.SEARCH_HISTORY, { keyPath: 'id', autoIncrement: true })
                    historyStore.createIndex('term', 'term', { unique: false })
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false })
                }

                console.log('✅ Service Worker IndexedDB表结构创建完成')
            }
        })
    }

    /**
     * 获取数据库实例
     */
    static getDB() {
        if (!this.db) {
            throw new Error('IndexedDB未初始化')
        }
        return this.db
    }

    /**
     * 批量插入书签
     */
    static async insertBookmarks(bookmarks) {
        const db = this.getDB()

        // 验证输入参数
        if (!bookmarks || !Array.isArray(bookmarks)) {
            console.warn('⚠️ insertBookmarks: Invalid bookmarks data:', bookmarks)
            return Promise.resolve() // 返回成功，避免阻塞流程
        }

        if (bookmarks.length === 0) {
            console.log('✅ insertBookmarks: No bookmarks to insert')
            return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(STORES.BOOKMARKS)

            let completed = 0
            const total = bookmarks.length

            transaction.oncomplete = () => {
                console.log(`✅ Service Worker 批量插入${total}条书签完成`)
                resolve()
            }

            transaction.onerror = () => {
                console.error('❌ Service Worker 批量插入失败:', transaction.error)
                reject(transaction.error)
            }

            bookmarks.forEach(bookmark => {
                const request = store.put(bookmark)
                request.onsuccess = () => {
                    completed++
                    if (completed % 1000 === 0) {
                        console.log(`📊 Service Worker 已插入 ${completed}/${total} 条书签`)
                    }
                }
            })
        })
    }

    /**
     * 清空所有书签
     */
    static async clearAllBookmarks() {
        const db = this.getDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(STORES.BOOKMARKS)
            const request = store.clear()

            request.onsuccess = () => {
                console.log('✅ Service Worker 所有书签已清空')
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * 更新全局统计
     */
    static async updateGlobalStats(stats) {
        const db = this.getDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.GLOBAL_STATS], 'readwrite')
            const store = transaction.objectStore(STORES.GLOBAL_STATS)

            const statsRecord = {
                key: 'global',
                ...stats,
                lastUpdated: Date.now()
            }

            const request = store.put(statsRecord)

            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * 保存设置
     */
    static async saveSetting(key, value) {
        const db = this.getDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.SETTINGS], 'readwrite')
            const store = transaction.objectStore(STORES.SETTINGS)

            const setting = {
                key,
                value,
                updatedAt: Date.now()
            }

            const request = store.put(setting)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * 获取设置
     */
    static async getSetting(key) {
        const db = this.getDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.SETTINGS], 'readonly')
            const store = transaction.objectStore(STORES.SETTINGS)
            const request = store.get(key)

            request.onsuccess = () => {
                const result = request.result
                resolve(result ? result.value : null)
            }

            request.onerror = () => reject(request.error)
        })
    }

    /**
     * 获取所有书签
     */
    static async getAllBookmarks() {
        const db = this.getDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(STORES.BOOKMARKS)
            const request = store.getAll()

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * 搜索书签
     */
    static async searchBookmarks(query, limit = 50) {
        const db = this.getDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(STORES.BOOKMARKS)
            const request = store.getAll()

            request.onsuccess = () => {
                const allBookmarks = request.result
                const searchTerm = query.toLowerCase()

                const results = allBookmarks
                    .filter(bookmark =>
                        bookmark.title.toLowerCase().includes(searchTerm) ||
                        (bookmark.url && bookmark.url.toLowerCase().includes(searchTerm)) ||
                        (bookmark.searchKeywords && bookmark.searchKeywords.some(keyword =>
                            keyword.toLowerCase().includes(searchTerm)
                        ))
                    )
                    .slice(0, limit)
                    .map(bookmark => ({
                        id: bookmark.id,
                        title: bookmark.title,
                        url: bookmark.url || '',
                        parentId: bookmark.parentId,
                        isFolder: bookmark.isFolder,
                        path: bookmark.path,
                        matchScore: this.calculateMatchScore(bookmark, searchTerm)
                    }))
                    .sort((a, b) => b.matchScore - a.matchScore)

                resolve(results)
            }

            request.onerror = () => reject(request.error)
        })
    }

    /**
     * 计算搜索匹配分数
     */
    static calculateMatchScore(bookmark, searchTerm) {
        let score = 0

        // 标题完全匹配
        if (bookmark.title.toLowerCase() === searchTerm) {
            score += 100
        } else if (bookmark.title.toLowerCase().includes(searchTerm)) {
            score += 50
        }

        // URL匹配
        if (bookmark.url && bookmark.url.toLowerCase().includes(searchTerm)) {
            score += 30
        }

        // 关键词匹配
        if (bookmark.searchKeywords) {
            bookmark.searchKeywords.forEach(keyword => {
                if (keyword.toLowerCase().includes(searchTerm)) {
                    score += 20
                }
            })
        }

        return score
    }
}

// ==================== 书签数据转换器 ====================
class BookmarkTransformer {
    static VERSION = '3.0.0'

    /**
     * 将Chrome书签数据转换为IndexedDB格式
     */
    static async transformChromeBookmarks(chromeData) {
        console.log('🔄 Service Worker 开始书签数据转换...')

        // 验证输入数据
        if (!chromeData || !Array.isArray(chromeData)) {
            console.error('❌ Invalid chromeData:', chromeData)
            throw new Error('Invalid bookmark data: expected array')
        }

        const startTime = performance.now()

        const bookmarks = []
        let bookmarkCount = 0
        let folderCount = 0
        let maxDepth = 0
        const domains = new Set()

        // 递归转换节点
        const processNode = (node, parentPath = [], parentPathIds = [], depth = 0) => {
            // 验证节点数据
            if (!node || !node.id || !node.title) {
                console.warn('⚠️ Invalid node data:', node)
                return
            }

            maxDepth = Math.max(maxDepth, depth)

            const currentPath = [...parentPath, node.title]
            const currentPathIds = [...parentPathIds, node.id]

            // 提取域名
            let domain
            if (node.url) {
                try {
                    domain = new URL(node.url).hostname.toLowerCase()
                    domains.add(domain)
                } catch (e) {
                    // 忽略无效URL
                }
            }

            // 生成关键词
            const keywords = []
            const titleWords = node.title.toLowerCase().split(/\\W+/).filter(w => w.length > 2)
            keywords.push(...titleWords)

            if (node.url) {
                const urlWords = node.url.toLowerCase().split(/\\W+/).filter(w => w.length > 2)
                keywords.push(...urlWords.slice(0, 5))
            }

            if (domain) {
                const domainParts = domain.split('.')
                keywords.push(...domainParts.filter(p => p.length > 2))
            }

            const isFolder = !!(node.children && node.children.length > 0)
            const childrenCount = node.children ? node.children.length : 0

            // 推断分类
            const category = this.inferCategory(node.title, node.url, domain)

            // 创建书签记录
            const bookmarkRecord = {
                id: node.id,
                parentId: node.parentId,
                title: node.title,
                url: node.url,
                dateAdded: node.dateAdded,
                dateGroupModified: node.dateGroupModified,

                index: node.index || 0,
                path: currentPath,
                pathString: currentPath.join(' / '),
                pathIds: currentPathIds,
                pathIdsString: currentPathIds.join(' / '),
                ancestorIds: parentPathIds.slice(),
                siblingIds: [],
                depth,

                titleLower: node.title.toLowerCase(),
                urlLower: node.url ? node.url.toLowerCase() : undefined,
                domain,
                keywords: [...new Set(keywords)],

                isFolder,
                childrenCount,
                bookmarksCount: 0,

                tags: [],
                category,
                notes: '',
                lastVisited: undefined,
                visitCount: 0
            }

            bookmarks.push(bookmarkRecord)

            if (isFolder) {
                folderCount++
            } else {
                bookmarkCount++
            }

            // 处理子节点
            if (node.children) {
                node.children.forEach((child, index) => {
                    child.index = index
                    processNode(child, currentPath, currentPathIds, depth + 1)
                })
            }
        }

        // 处理根节点
        chromeData.forEach((rootNode, index) => {
            rootNode.index = index
            processNode(rootNode)
        })

        // 后处理：填充兄弟节点信息
        this.postProcessBookmarks(bookmarks)

        const transformTime = performance.now() - startTime

        const stats = {
            totalBookmarks: bookmarkCount,
            totalFolders: folderCount,
            totalDomains: domains.size,
            maxDepth,
            lastUpdated: Date.now(),
            version: this.VERSION
        }

        console.log(`✅ Service Worker 数据转换完成，耗时: ${transformTime.toFixed(2)}ms`)
        console.log(`📊 Service Worker 转换结果: ${bookmarkCount}个书签, ${folderCount}个文件夹`)

        return { bookmarks, stats, transformTime }
    }

    /**
     * 后处理：填充兄弟节点信息
     */
    static postProcessBookmarks(bookmarks) {
        const childrenByParent = new Map()

        bookmarks.forEach(bookmark => {
            if (bookmark.parentId) {
                if (!childrenByParent.has(bookmark.parentId)) {
                    childrenByParent.set(bookmark.parentId, [])
                }
                childrenByParent.get(bookmark.parentId).push(bookmark)
            }
        })

        // 填充兄弟节点信息
        bookmarks.forEach(bookmark => {
            if (bookmark.parentId) {
                const siblings = childrenByParent.get(bookmark.parentId) || []
                bookmark.siblingIds = siblings
                    .filter(s => s.id !== bookmark.id)
                    .map(s => s.id)
            }
        })

        // 计算文件夹的书签数量
        const calculateBookmarkCount = (parentId) => {
            const children = childrenByParent.get(parentId) || []
            let count = 0

            children.forEach(child => {
                if (child.isFolder) {
                    count += calculateBookmarkCount(child.id)
                } else {
                    count += 1
                }
            })

            return count
        }

        bookmarks.forEach(bookmark => {
            if (bookmark.isFolder) {
                bookmark.bookmarksCount = calculateBookmarkCount(bookmark.id)
            }
        })
    }

    /**
     * 推断书签分类
     */
    static inferCategory(title, url, domain) {
        if (!url) return undefined

        const titleLower = title.toLowerCase()

        if (/github|gitlab|stackoverflow|codepen/i.test(domain || '')) {
            return 'development'
        }

        if (/twitter|facebook|instagram|linkedin/i.test(domain || '')) {
            return 'social'
        }

        if (/news|bbc|cnn|reddit/i.test(domain || '')) {
            return 'news'
        }

        if (/learn|course|tutorial|doc|guide/i.test(titleLower)) {
            return 'education'
        }

        if (/tool|util|app/i.test(titleLower)) {
            return 'tools'
        }

        if (/amazon|shop|buy|store/i.test(domain || '')) {
            return 'shopping'
        }

        return undefined
    }

    /**
     * 生成数据指纹
     */
    static generateDataFingerprint(tree) {
        // 验证输入参数
        if (!tree || (Array.isArray(tree) && tree.length === 0)) {
            console.warn('⚠️ generateDataFingerprint: Invalid tree data:', tree)
            return 'empty-tree-hash'
        }

        const simplified = JSON.stringify(tree, (key, value) => {
            if (['id', 'title', 'url', 'parentId', 'index'].includes(key)) {
                return value
            }
            if (key === 'children' && Array.isArray(value)) {
                return value
            }
            return undefined
        })

        // 验证JSON序列化结果
        if (!simplified || simplified === 'undefined' || simplified === 'null') {
            console.warn('⚠️ generateDataFingerprint: JSON.stringify returned invalid result:', simplified)
            return 'invalid-json-hash'
        }

        let hash = 0
        for (let i = 0; i < simplified.length; i++) {
            const char = simplified.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }

        return hash.toString(16)
    }
}

// ==================== 核心书签管理器 ====================
class IndexedDBBookmarkManager {
    static isProcessing = false
    static lastSyncTime = 0
    static syncInterval = null

    /**
     * 初始化管理器
     */
    static async initialize() {
        console.log('🚀 IndexedDBBookmarkManager 初始化开始...')

        try {
            // 1. 初始化IndexedDB
            await ServiceWorkerIndexedDB.initialize()

            // 2. 检查是否需要首次数据加载
            const lastFingerprint = await ServiceWorkerIndexedDB.getSetting('data_fingerprint')
            if (!lastFingerprint) {
                console.log('📊 首次使用，加载Chrome书签数据...')
                await this.loadFromChrome()
            }

            // 3. 启动定期同步
            this.startPeriodicSync()

            console.log('✅ IndexedDBBookmarkManager 初始化完成')
            return true

        } catch (error) {
            console.error('❌ IndexedDBBookmarkManager 初始化失败:', error)
            return false
        }
    }

    /**
     * 从Chrome API加载书签数据
     */
    static async loadFromChrome() {
        if (this.isProcessing) {
            console.log('⚠️ 数据处理中，跳过此次加载')
            return
        }

        this.isProcessing = true
        console.log('🔄 从Chrome API加载书签数据...')

        try {
            const bookmarkTree = await new Promise((resolve, reject) => {
                chrome.bookmarks.getTree((tree) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message))
                    } else {
                        resolve(tree)
                    }
                })
            })

            // 验证Chrome书签数据
            console.log('📋 Chrome书签原始数据:', bookmarkTree)
            if (!bookmarkTree || !Array.isArray(bookmarkTree) || bookmarkTree.length === 0) {
                throw new Error(`Invalid bookmark tree structure: ${JSON.stringify(bookmarkTree)}`)
            }

            // 转换数据格式
            const transformResult = await BookmarkTransformer.transformChromeBookmarks(bookmarkTree)

            // 验证转换结果
            console.log('🔄 数据转换结果:', {
                bookmarks: transformResult?.bookmarks?.length || 0,
                stats: transformResult?.stats
            })

            if (!transformResult || !transformResult.bookmarks) {
                throw new Error('Transform result is invalid - no bookmarks data')
            }

            // 保存到IndexedDB
            await ServiceWorkerIndexedDB.clearAllBookmarks()
            await ServiceWorkerIndexedDB.insertBookmarks(transformResult.bookmarks)
            await ServiceWorkerIndexedDB.updateGlobalStats(transformResult.stats)

            // 保存数据指纹
            const fingerprint = BookmarkTransformer.generateDataFingerprint(bookmarkTree)
            await ServiceWorkerIndexedDB.saveSetting('data_fingerprint', fingerprint)
            await ServiceWorkerIndexedDB.saveSetting('last_sync_time', Date.now())

            console.log('✅ Chrome书签数据加载完成')

            // 通知前端页面数据已更新
            this.notifyPagesDataReady(transformResult.stats)

        } catch (error) {
            console.error('❌ Chrome书签数据加载失败:', error)
        } finally {
            this.isProcessing = false
        }
    }

    /**
     * 同步Chrome数据（增量更新）
     */
    static async syncWithChrome() {
        if (this.isProcessing) {
            console.log('⚠️ 数据处理中，跳过此次同步')
            return false
        }

        console.log('🔄 检查Chrome书签变化...')

        try {
            const bookmarkTree = await new Promise((resolve, reject) => {
                chrome.bookmarks.getTree((tree) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message))
                    } else {
                        resolve(tree)
                    }
                })
            })

            // 检查数据是否有变化
            const currentFingerprint = BookmarkTransformer.generateDataFingerprint(bookmarkTree)
            const lastFingerprint = await ServiceWorkerIndexedDB.getSetting('data_fingerprint')

            if (currentFingerprint === lastFingerprint) {
                console.log('✅ 书签数据无变化')
                return false
            }

            console.log('📊 检测到书签变化，开始同步...')

            this.isProcessing = true

            // 重新处理所有数据
            const transformResult = await BookmarkTransformer.transformChromeBookmarks(bookmarkTree)

            // 更新IndexedDB
            await ServiceWorkerIndexedDB.clearAllBookmarks()
            await ServiceWorkerIndexedDB.insertBookmarks(transformResult.bookmarks)
            await ServiceWorkerIndexedDB.updateGlobalStats(transformResult.stats)

            // 更新指纹和同步时间
            await ServiceWorkerIndexedDB.saveSetting('data_fingerprint', currentFingerprint)
            await ServiceWorkerIndexedDB.saveSetting('last_sync_time', Date.now())

            console.log('✅ Chrome书签同步完成')

            // 通知前端页面
            this.notifyPagesDataReady(transformResult.stats)

            return true

        } catch (error) {
            console.error('❌ Chrome书签同步失败:', error)
            return false
        } finally {
            this.isProcessing = false
        }
    }

    /**
     * 启动定期同步
     */
    static startPeriodicSync() {
        if (this.syncInterval) return

        console.log(`🔄 启动定期同步，间隔: ${SYNC_INTERVAL}ms`)

        this.syncInterval = setInterval(async () => {
            try {
                await this.syncWithChrome()
            } catch (error) {
                console.warn('⚠️ 定期同步失败:', error)
            }
        }, SYNC_INTERVAL)
    }

    /**
     * 停止定期同步
     */
    static stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval)
            this.syncInterval = null
            console.log('⏹️ 定期同步已停止')
        }
    }

    /**
     * 通知所有页面数据已准备就绪
     */
    static notifyPagesDataReady(stats) {
        const message = {
            type: 'BOOKMARK_DATA_READY',
            data: stats,
            timestamp: Date.now(),
            source: 'indexeddb-service-worker'
        }

        // 通知所有页面
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {
                    // 忽略无法发送消息的页面
                })
            })
        })
    }
}

// ==================== Service Worker事件监听 ====================

/**
 * Service Worker安装
 */
self.addEventListener('install', (event) => {
    console.log('🔧 AcuityBookmarks Service Worker 安装中...')
    event.waitUntil(
        IndexedDBBookmarkManager.initialize()
            .then(() => {
                console.log('✅ AcuityBookmarks Service Worker 安装完成')
                self.skipWaiting()
            })
            .catch(error => {
                console.error('❌ Service Worker 安装失败:', error)
            })
    )
})

/**
 * Service Worker激活
 */
self.addEventListener('activate', (event) => {
    console.log('🚀 AcuityBookmarks Service Worker 激活中...')
    event.waitUntil(
        self.clients.claim().then(() => {
            console.log('✅ AcuityBookmarks Service Worker 激活完成')
        })
    )
})

/**
 * Chrome扩展消息处理
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Service Worker收到消息:', request.type)

    // 异步处理消息
    handleMessage(request, sender, sendResponse)

    // 返回true表示异步响应
    return true
})

/**
 * 异步消息处理函数
 */
async function handleMessage(request, sender, sendResponse) {
    try {
        const { type, data } = request

        switch (type) {
            case 'SYNC_BOOKMARKS':
                console.log('📨 处理同步书签请求')
                const syncResult = await IndexedDBBookmarkManager.syncWithChrome()
                sendResponse({ success: true, changed: syncResult })
                break

            case 'LOAD_BOOKMARKS':
                console.log('📨 处理加载书签请求')
                await IndexedDBBookmarkManager.loadFromChrome()
                sendResponse({ success: true })
                break

            case 'GET_STATS':
                console.log('📨 处理获取统计请求')
                const stats = await ServiceWorkerIndexedDB.getSetting('global_stats')
                sendResponse({ success: true, data: stats })
                break

            case 'GET_BOOKMARK_TREE':
                console.log('📨 处理获取书签树请求')
                const bookmarks = await ServiceWorkerIndexedDB.getAllBookmarks()
                sendResponse({ success: true, data: bookmarks })
                break

            case 'SEARCH_BOOKMARKS':
                console.log('📨 处理搜索书签请求:', data?.query)
                const searchResults = await ServiceWorkerIndexedDB.searchBookmarks(data.query, data.limit || 50)
                sendResponse({ success: true, data: searchResults })
                break

            case 'OPEN_MANAGEMENT_PAGE':
                console.log('📨 处理打开管理页面请求')
                chrome.tabs.create({ url: chrome.runtime.getURL('management.html') })
                sendResponse({ success: true })
                break

            case 'OPEN_SIDE_PANEL':
                console.log('📨 处理打开侧边栏请求')
                chrome.sidePanel.open({ tabId: sender.tab?.id })
                sendResponse({ success: true })
                break

            default:
                console.warn('⚠️ 未知消息类型:', type)
                sendResponse({ success: false, error: '未知消息类型' })
        }
    } catch (error) {
        console.error('❌ 消息处理失败:', error)
        sendResponse({ success: false, error: error.message })
    }
}

/**
 * 书签变更监听
 */
chrome.bookmarks.onCreated?.addListener(() => {
    console.log('📊 检测到书签创建，触发同步')
    IndexedDBBookmarkManager.syncWithChrome()
})

chrome.bookmarks.onRemoved?.addListener(() => {
    console.log('📊 检测到书签删除，触发同步')
    IndexedDBBookmarkManager.syncWithChrome()
})

chrome.bookmarks.onChanged?.addListener(() => {
    console.log('📊 检测到书签修改，触发同步')
    IndexedDBBookmarkManager.syncWithChrome()
})

chrome.bookmarks.onMoved?.addListener(() => {
    console.log('📊 检测到书签移动，触发同步')
    IndexedDBBookmarkManager.syncWithChrome()
})

/**
 * 扩展启动时初始化
 */
chrome.runtime.onStartup?.addListener(() => {
    console.log('🔄 扩展启动，初始化IndexedDB书签管理器')
    IndexedDBBookmarkManager.initialize()
})

// 立即初始化
IndexedDBBookmarkManager.initialize().catch(error => {
    console.error('❌ Service Worker 立即初始化失败:', error)
})

console.log('✅ AcuityBookmarks Service Worker - IndexedDB版本已加载')
