/**
 * IndexedDB书签管理器
 * 替代SuperGlobalBookmarkCache，提供相同的API接口
 * 直接基于IndexedDB，无缓存层，保证数据一致性
 */

import { IndexedDBCore, type BookmarkRecord, type GlobalStats } from './indexeddb-core'
import { BookmarkDataTransformer, type TransformResult } from './bookmark-data-transformer'

export interface BookmarkManagerOptions {
    autoSync?: boolean      // 自动同步Chrome数据
    syncInterval?: number   // 同步间隔(ms)
}

export interface SearchOptions {
    limit?: number
    includeUrl?: boolean
    includeDomain?: boolean
    includeKeywords?: boolean
    sortBy?: 'relevance' | 'title' | 'dateAdded'
}

export interface BookmarkQuery {
    parentId?: string
    isFolder?: boolean
    domain?: string
    pathIds?: string[]
    dateRange?: {
        start?: number
        end?: number
    }
    limit?: number
    offset?: number
}

/**
 * IndexedDB书签管理器
 * 提供与原SuperGlobalBookmarkCache兼容的API
 */
export class IndexedDBBookmarkManager {
    private static instance: IndexedDBBookmarkManager | null = null
    private db: IndexedDBCore
    private transformer: BookmarkDataTransformer
    private isInitialized = false
    private initPromise: Promise<void> | null = null
    private syncInterval: number | null = null
    private updateListeners: Array<(stats: GlobalStats) => void> = []

    constructor(private options: BookmarkManagerOptions = {}) {
        this.db = IndexedDBCore.getInstance()
        this.transformer = new BookmarkDataTransformer()

        // 设置默认选项
        this.options = {
            autoSync: true,
            syncInterval: 60000, // 1分钟
            ...options
        }
    }

    /**
     * 单例模式
     */
    static getInstance(options?: BookmarkManagerOptions): IndexedDBBookmarkManager {
        if (!this.instance) {
            this.instance = new IndexedDBBookmarkManager(options)
        }
        return this.instance
    }

    /**
     * 初始化管理器
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
        try {
            console.log('🚀 IndexedDBBookmarkManager 初始化开始...')

            // 1. 初始化IndexedDB
            await this.db.initialize()

            // 2. 检查是否需要首次数据加载
            const stats = await this.db.getGlobalStats()
            if (!stats) {
                console.log('📊 首次使用，从Chrome API加载书签数据...')
                await this.loadFromChrome()
            }

            // 3. 启动自动同步
            if (this.options.autoSync) {
                this.startAutoSync()
            }

            this.isInitialized = true
            this.initPromise = null

            console.log('✅ IndexedDBBookmarkManager 初始化完成')

        } catch (error) {
            console.error('❌ IndexedDBBookmarkManager 初始化失败:', error)
            this.initPromise = null
            throw error
        }
    }

    /**
     * 从Chrome API加载书签数据
     */
    async loadFromChrome(): Promise<TransformResult> {
        console.log('🔄 从Chrome API重新加载书签数据...')

        const result = await this.transformer.loadFromChromeAndProcess()

        // 通知所有监听器
        this.notifyUpdateListeners(result.stats)

        return result
    }

    /**
     * 同步Chrome数据（增量更新）
     */
    async syncWithChrome(): Promise<boolean> {
        try {
            const syncResult = await this.transformer.syncWithChrome()

            if (syncResult.changed && syncResult.result) {
                console.log('✅ Chrome书签同步完成')
                this.notifyUpdateListeners(syncResult.result.stats)
                return true
            }

            return false

        } catch (error) {
            console.error('❌ Chrome书签同步失败:', error)
            throw error
        }
    }

    /**
     * 启动自动同步
     */
    private startAutoSync(): void {
        if (this.syncInterval || !this.options.syncInterval) {
            return
        }

        console.log(`🔄 启动自动同步，间隔: ${this.options.syncInterval}ms`)

        this.syncInterval = window.setInterval(async () => {
            try {
                await this.syncWithChrome()
            } catch (error) {
                console.warn('⚠️ 自动同步失败:', error)
            }
        }, this.options.syncInterval)
    }

    /**
     * 停止自动同步
     */
    private stopAutoSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval)
            this.syncInterval = null
            console.log('⏹️ 自动同步已停止')
        }
    }

    // ==================== 查询接口（兼容原API） ====================

    /**
     * 根据ID获取书签节点
     */
    async getNodeById(id: string): Promise<BookmarkRecord | null> {
        await this.initialize()
        return await this.db.getBookmarkById(id)
    }

    /**
     * 获取所有书签数据
     */
    async getAllBookmarks(query?: BookmarkQuery): Promise<BookmarkRecord[]> {
        await this.initialize()

        if (!query) {
            return await this.db.getAllBookmarks()
        }

        // TODO: 实现复杂查询逻辑
        return await this.db.getAllBookmarks(query.limit, query.offset)
    }

    /**
     * 根据父ID获取子节点
     */
    async getChildrenByParentId(parentId: string): Promise<BookmarkRecord[]> {
        await this.initialize()
        return await this.db.getChildrenByParentId(parentId)
    }

    /**
     * 搜索书签
     */
    async searchBookmarks(query: string, options: SearchOptions = {}): Promise<BookmarkRecord[]> {
        await this.initialize()

        const opts = {
            limit: 100,
            includeUrl: true,
            includeDomain: true,
            includeKeywords: true,
            sortBy: 'relevance' as const,
            ...options
        }

        const results = await this.db.searchBookmarks(query, opts.limit)

        // TODO: 根据sortBy进行排序
        return results
    }

    /**
     * 根据路径ID获取节点
     */
    async getNodeByIdPath(pathIds: string[]): Promise<BookmarkRecord | null> {
        await this.initialize()

        if (pathIds.length === 0) {
            return null
        }

        const targetId = pathIds[pathIds.length - 1]
        const node = await this.db.getBookmarkById(targetId)

        // 验证路径是否匹配
        if (node && this.arrayEquals(node.pathIds, pathIds)) {
            return node
        }

        return null
    }

    /**
     * 根据路径ID字符串获取节点
     */
    async getNodeByIdPathString(pathIdsString: string): Promise<BookmarkRecord | null> {
        if (!pathIdsString) {
            return null
        }

        const pathIds = pathIdsString.split(' / ').filter(id => id.trim())
        return await this.getNodeByIdPath(pathIds)
    }

    /**
     * 获取节点的路径ID数组
     */
    async getNodePathIds(nodeId: string): Promise<string[]> {
        const node = await this.getNodeById(nodeId)
        return node ? node.pathIds : []
    }

    /**
     * 获取节点的路径ID字符串
     */
    async getNodePathIdsString(nodeId: string): Promise<string> {
        const node = await this.getNodeById(nodeId)
        return node ? node.pathIdsString : ''
    }

    // ==================== 统计和分析接口 ====================

    /**
     * 获取全局统计信息
     */
    async getGlobalStats(): Promise<GlobalStats | null> {
        await this.initialize()
        return await this.db.getGlobalStats()
    }

    /**
     * 获取域名统计
     */
    async getDomainStats(): Promise<Map<string, number>> {
        await this.initialize()

        const bookmarks = await this.db.getAllBookmarks()
        const domainCount = new Map<string, number>()

        bookmarks.forEach(bookmark => {
            if (bookmark.domain && !bookmark.isFolder) {
                domainCount.set(bookmark.domain, (domainCount.get(bookmark.domain) || 0) + 1)
            }
        })

        return domainCount
    }

    /**
     * 获取重复URL
     */
    async getDuplicateUrls(): Promise<Map<string, string[]>> {
        await this.initialize()

        const bookmarks = await this.db.getAllBookmarks()
        const urlToIds = new Map<string, string[]>()
        const duplicates = new Map<string, string[]>()

        // 统计URL出现次数
        bookmarks.forEach(bookmark => {
            if (bookmark.url && !bookmark.isFolder) {
                if (!urlToIds.has(bookmark.url)) {
                    urlToIds.set(bookmark.url, [])
                }
                urlToIds.get(bookmark.url)!.push(bookmark.id)
            }
        })

        // 找出重复的URL
        urlToIds.forEach((ids, url) => {
            if (ids.length > 1) {
                duplicates.set(url, ids)
            }
        })

        return duplicates
    }

    /**
     * 获取空文件夹
     */
    async getEmptyFolders(): Promise<string[]> {
        await this.initialize()

        const bookmarks = await this.db.getAllBookmarks()
        const emptyFolders: string[] = []

        for (const bookmark of bookmarks) {
            if (bookmark.isFolder && bookmark.childrenCount === 0) {
                emptyFolders.push(bookmark.id)
            }
        }

        return emptyFolders
    }

    // ==================== 更新操作接口 ====================

    /**
     * 更新书签
     */
    async updateBookmark(bookmark: BookmarkRecord): Promise<void> {
        await this.initialize()
        await this.db.updateBookmark(bookmark)
    }

    /**
     * 删除书签
     */
    async deleteBookmark(id: string): Promise<void> {
        await this.initialize()
        await this.db.deleteBookmark(id)
    }

    // ==================== 监听器管理 ====================

    /**
     * 添加更新监听器
     */
    addUpdateListener(listener: (stats: GlobalStats) => void): void {
        this.updateListeners.push(listener)
    }

    /**
     * 移除更新监听器
     */
    removeUpdateListener(listener: (stats: GlobalStats) => void): void {
        const index = this.updateListeners.indexOf(listener)
        if (index > -1) {
            this.updateListeners.splice(index, 1)
        }
    }

    /**
     * 通知所有监听器
     */
    private notifyUpdateListeners(stats: GlobalStats): void {
        this.updateListeners.forEach(listener => {
            try {
                listener(stats)
            } catch (error) {
                console.warn('监听器执行失败:', error)
            }
        })
    }

    // ==================== 性能分析接口 ====================

    /**
     * 展示ID路径查找的优势
     * （兼容原SuperGlobalBookmarkCache的演示方法）
     */
    async demonstrateIdPathAdvantages(): Promise<{
        nameBasedTime: number
        idBasedTime: number
        speedup: number
        testCount: number
    }> {
        await this.initialize()

        const bookmarks = await this.db.getAllBookmarks()
        const testBookmarks = bookmarks.slice(0, Math.min(100, bookmarks.length))

        console.log('🧪 开始ID路径查找性能测试...')

        // 测试基于名称的查找（模拟原来的慢方法）
        const nameBasedStart = performance.now()
        for (const bookmark of testBookmarks) {
            // 模拟基于名称路径的查找（遍历查找）
            this.simulateNameBasedSearch(bookmarks, bookmark.path)
        }
        const nameBasedTime = performance.now() - nameBasedStart

        // 测试基于ID的查找（IndexedDB优化）
        const idBasedStart = performance.now()
        for (const bookmark of testBookmarks) {
            await this.getNodeByIdPath(bookmark.pathIds)
        }
        const idBasedTime = performance.now() - idBasedStart

        const speedup = nameBasedTime / idBasedTime

        console.log(`📊 性能测试结果:`)
        console.log(`   名称查找: ${nameBasedTime.toFixed(2)}ms`)
        console.log(`   ID查找: ${idBasedTime.toFixed(2)}ms`)
        console.log(`   性能提升: ${speedup.toFixed(1)}x`)

        return {
            nameBasedTime,
            idBasedTime,
            speedup,
            testCount: testBookmarks.length
        }
    }

    /**
     * 模拟基于名称的搜索（用于性能对比）
     */
    private simulateNameBasedSearch(bookmarks: BookmarkRecord[], targetPath: string[]): BookmarkRecord | null {
        // 简单的线性搜索模拟
        for (const bookmark of bookmarks) {
            if (this.arrayEquals(bookmark.path, targetPath)) {
                return bookmark
            }
        }
        return null
    }

    // ==================== 设置和配置 ====================

    /**
     * 保存设置
     */
    async saveSetting(key: string, value: any): Promise<void> {
        await this.initialize()
        await this.db.saveSetting(key, value)
    }

    /**
     * 获取设置
     */
    async getSetting<T>(key: string): Promise<T | null> {
        await this.initialize()
        return await this.db.getSetting<T>(key)
    }

    /**
     * 删除设置
     */
    async deleteSetting(key: string): Promise<void> {
        await this.initialize()
        await this.db.deleteSetting(key)
    }

    // ==================== 搜索历史管理 ====================

    /**
     * 添加搜索历史
     */
    async addSearchHistory(query: string, resultCount: number): Promise<void> {
        await this.initialize()
        await this.db.addSearchHistory(query, resultCount)
    }

    /**
     * 获取搜索历史
     */
    async getSearchHistory(limit: number = 20): Promise<any[]> {
        await this.initialize()
        return await this.db.getSearchHistory(limit)
    }

    /**
     * 清空搜索历史
     */
    async clearSearchHistory(): Promise<void> {
        await this.initialize()
        await this.db.clearSearchHistory()
    }

    // ==================== 工具方法 ====================

    /**
     * 数组相等比较
     */
    private arrayEquals(a: any[], b: any[]): boolean {
        return a.length === b.length && a.every((val, index) => val === b[index])
    }

    /**
     * 获取数据库信息
     */
    async getDatabaseInfo(): Promise<{
        bookmarkCount: number
        searchHistoryCount: number
        settingsCount: number
        estimatedSize: number
    }> {
        await this.initialize()
        return await this.db.getDatabaseInfo()
    }

    /**
     * 清理并关闭管理器
     */
    async destroy(): Promise<void> {
        this.stopAutoSync()
        this.updateListeners = []
        this.db.close()
        this.isInitialized = false

        if (IndexedDBBookmarkManager.instance === this) {
            IndexedDBBookmarkManager.instance = null
        }

        console.log('✅ IndexedDBBookmarkManager 已销毁')
    }
}
