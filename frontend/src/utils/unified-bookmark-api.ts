/**
 * 统一书签API接口
 * 为所有前端页面提供一致的数据访问接口
 * 通过Service Worker消息通信获取预处理数据
 * 
 * 核心功能：
 * - 统一的Service Worker通信
 * - 错误处理和重试逻辑
 * - 健康检查和连接管理
 * - 类型安全的API接口
 */

import {
    type BookmarkRecord,
    type GlobalStats,
    type SearchOptions,
    type SearchResult,
    type DatabaseHealth,
    type DatabaseStats,
    type SearchHistoryRecord
} from './indexeddb-schema'
// Note: Search services temporarily disabled during refactoring
// import {
//     bookmarkSearchService,
//     type LocalSearchOptions,
//     type StandardSearchResult,
//     type SearchField
// } from '../services/hybrid-search-engine' // Updated to use hybrid search engine

// Temporary types until search is re-implemented
type StandardSearchResult = any

/**
 * API响应类型
 */
interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
    timestamp?: number
}

/**
 * 健康检查响应
 */
interface HealthCheckResponse {
    success: boolean
    ready: boolean
    initialized: boolean
    dataVersion?: string
    lastUpdate?: number
    error?: string
}

/**
 * 消息类型定义
 */
type MessageType =
    | 'HEALTH_CHECK'
    | 'GET_ALL_BOOKMARKS'
    | 'GET_BOOKMARK_BY_ID'
    | 'GET_CHILDREN_BY_PARENT_ID'
    | 'SEARCH_BOOKMARKS'
    | 'GET_GLOBAL_STATS'
    | 'SYNC_BOOKMARKS'
    | 'GET_DATABASE_HEALTH'
    | 'GET_DATABASE_STATS'
    | 'GET_SEARCH_HISTORY'
    | 'ADD_SEARCH_HISTORY'
    | 'CLEAR_SEARCH_HISTORY'
    | 'GET_SETTING'
    | 'SAVE_SETTING'
    | 'DELETE_SETTING'
    | 'FORCE_RELOAD_DATA'

/**
 * 消息数据接口
 */
interface MessageData {
    type: MessageType
    data?: any
    timeout?: number
}

/**
 * 统一书签API类
 */
export class UnifiedBookmarkAPI {
    private static instance: UnifiedBookmarkAPI | null = null
    private isReady = false
    private readyPromise: Promise<void> | null = null
    private connectionRetries = 0
    private maxRetries = 10
    private retryDelay = 1000

    private constructor() { }

    /**
     * 单例模式获取实例
     */
    static getInstance(): UnifiedBookmarkAPI {
        if (!UnifiedBookmarkAPI.instance) {
            UnifiedBookmarkAPI.instance = new UnifiedBookmarkAPI()
        }
        return UnifiedBookmarkAPI.instance
    }

    /**
     * 初始化API
     */
    async initialize(): Promise<void> {
        if (this.isReady) {
            return
        }

        if (this.readyPromise) {
            return this.readyPromise
        }

        this.readyPromise = this._doInitialize()
        return this.readyPromise
    }

    private async _doInitialize(): Promise<void> {
        console.log('🚀 [统一API] 初始化开始...')

        try {
            // 等待Service Worker准备就绪
            await this._waitForServiceWorkerReady()

            this.isReady = true
            this.readyPromise = null

            console.log('✅ [统一API] 初始化完成')
        } catch (error) {
            this.readyPromise = null
            console.error('❌ [统一API] 初始化失败:', error)
            throw error
        }
    }

    /**
     * 等待Service Worker准备就绪
     */
    private async _waitForServiceWorkerReady(): Promise<void> {
        console.log('🔍 [统一API] 等待Service Worker准备就绪...')

        for (let i = 0; i < this.maxRetries; i++) {
            try {
                console.log(`🔍 [统一API] 健康检查 ${i + 1}/${this.maxRetries}...`)

                const response = await this._sendMessage<HealthCheckResponse>({
                    type: 'HEALTH_CHECK',
                    timeout: 5000
                })

                if (response.success && response.ready) {
                    console.log('✅ [统一API] Service Worker已准备就绪')
                    return
                }

                console.log(`⏳ [统一API] Service Worker未就绪，状态:`, response)

            } catch (error) {
                console.log(`⏳ [统一API] 连接失败 (${i + 1}/${this.maxRetries}):`, error)
            }

            // 最后一次不需要等待
            if (i < this.maxRetries - 1) {
                console.log(`⏳ [统一API] ${this.retryDelay}ms 后重试...`)
                await this._sleep(this.retryDelay)

                // 递增延迟
                this.retryDelay = Math.min(this.retryDelay * 1.2, 5000)
            }
        }

        throw new Error('Service Worker连接超时，请刷新页面重试')
    }

    /**
     * 发送消息到Service Worker
     */
    private async _sendMessage<T = any>(messageData: MessageData): Promise<T> {
        const { type, data, timeout = 10000 } = messageData

        return new Promise((resolve, reject) => {
            // 设置超时
            const timeoutId = setTimeout(() => {
                reject(new Error(`消息超时: ${type}`))
            }, timeout)

            try {
                chrome.runtime.sendMessage(
                    { type, data },
                    (response) => {
                        clearTimeout(timeoutId)

                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message))
                        } else if (!response) {
                            reject(new Error('Service Worker无响应'))
                        } else {
                            resolve(response)
                        }
                    }
                )
            } catch (error) {
                clearTimeout(timeoutId)
                reject(error)
            }
        })
    }

    /**
     * 睡眠函数
     */
    private _sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * 确保API已准备就绪
     */
    private async _ensureReady(): Promise<void> {
        if (!this.isReady) {
            await this.initialize()
        }
    }

    // ==================== 公共API方法 ====================

    /**
     * 健康检查
     */
    async healthCheck(): Promise<HealthCheckResponse> {
        try {
            return await this._sendMessage<HealthCheckResponse>({
                type: 'HEALTH_CHECK',
                timeout: 5000
            })
        } catch (error) {
            return {
                success: false,
                ready: false,
                initialized: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    /**
     * 获取所有书签
     */
    async getAllBookmarks(): Promise<BookmarkRecord[]> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<BookmarkRecord[]>>({
            type: 'GET_ALL_BOOKMARKS'
        })

        if (!response.success) {
            throw new Error(response.error || '获取书签失败')
        }

        return response.data || []
    }

    /**
     * 根据ID获取书签
     */
    async getBookmarkById(id: string): Promise<BookmarkRecord | null> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<BookmarkRecord>>({
            type: 'GET_BOOKMARK_BY_ID',
            data: { id }
        })

        if (!response.success) {
            throw new Error(response.error || '获取书签失败')
        }

        return response.data || null
    }

    /**
     * 根据父ID获取子书签
     */
    async getChildrenByParentId(parentId: string): Promise<BookmarkRecord[]> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<BookmarkRecord[]>>({
            type: 'GET_CHILDREN_BY_PARENT_ID',
            data: { parentId }
        })

        if (!response.success) {
            throw new Error(response.error || '获取子书签失败')
        }

        return response.data || []
    }

    /**
     * 搜索书签（使用统一搜索服务）
     */
    async searchBookmarks(query: string, _options: SearchOptions = {}): Promise<SearchResult[]> {
        const startTime = performance.now()

        try {
            // 使用统一搜索服务
            // Note: bookmarkSearchService temporarily disabled
            const results: StandardSearchResult[] = []

            // 转换为兼容格式
            const convertedResults = this._convertToLegacyFormat(results)

            const endTime = performance.now()
            const executionTime = endTime - startTime

            console.log(`🔍 [统一API] 搜索完成: ${convertedResults.length}条结果, 耗时: ${executionTime.toFixed(2)}ms`)

            // 自动添加搜索历史
            try {
                await this.addSearchHistory(query, convertedResults.length, executionTime, 'management')
            } catch (error) {
                console.warn('⚠️ [统一API] 添加搜索历史失败:', error)
            }

            return convertedResults

        } catch (error) {
            console.error('❌ [统一API] 搜索失败:', error)
            throw new Error(`搜索失败: ${error instanceof Error ? error.message : '未知错误'}`)
        }
    }


    /**
     * 转换为兼容的搜索结果格式
     */
    private _convertToLegacyFormat(results: StandardSearchResult[]): SearchResult[] {
        return results.map(result => ({
            bookmark: {
                id: result.id,
                title: result.title,
                url: result.url,
                domain: result.domain || '',
                path: result.path || [],
                pathString: result.path?.join(' / ') || '',
                pathIds: [], // 管理页面不需要详细路径ID
                pathIdsString: '',
                ancestorIds: [],
                siblingIds: [],
                titleLower: result.title.toLowerCase(),
                urlLower: result.url.toLowerCase(),
                isFolder: result.isFolder,
                dateAdded: result.dateAdded,
                tags: result.tags || [],
                keywords: result.keywords || [],
                // 添加其他必需的BookmarkRecord字段
                index: 0,
                depth: 0,
                childrenCount: 0,
                bookmarksCount: result.isFolder ? 0 : 1,
                folderCount: result.isFolder ? 1 : 0,
                category: '',
                notes: '',
                lastVisited: undefined,
                visitCount: undefined,
                createdYear: new Date(result.dateAdded || 0).getFullYear(),
                createdMonth: new Date(result.dateAdded || 0).getMonth() + 1,
                domainCategory: '',
                flatIndex: 0,
                isVisible: true,
                sortKey: result.title,
                dataVersion: '1.0',
                lastCalculated: Date.now()
            },
            score: result.score,
            matchedFields: result.matchedFields,
            highlights: result.highlights || {}
        }))
    }

    /**
     * 获取全局统计
     */
    async getGlobalStats(): Promise<GlobalStats | null> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<GlobalStats>>({
            type: 'GET_GLOBAL_STATS'
        })

        if (!response.success) {
            throw new Error(response.error || '获取统计信息失败')
        }

        return response.data || null
    }

    /**
     * 同步书签数据
     */
    async syncBookmarks(): Promise<boolean> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<{ changed: boolean }>>({
            type: 'SYNC_BOOKMARKS',
            timeout: 30000 // 同步可能需要更长时间
        })

        if (!response.success) {
            throw new Error(response.error || '同步失败')
        }

        return response.data?.changed || false
    }

    /**
     * 强制重新加载数据
     */
    async forceReloadData(): Promise<void> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<void>>({
            type: 'FORCE_RELOAD_DATA',
            timeout: 60000 // 重新加载可能需要很长时间
        })

        if (!response.success) {
            throw new Error(response.error || '重新加载数据失败')
        }
    }

    /**
     * 获取数据库健康状态
     */
    async getDatabaseHealth(): Promise<DatabaseHealth> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<DatabaseHealth>>({
            type: 'GET_DATABASE_HEALTH'
        })

        if (!response.success) {
            throw new Error(response.error || '获取数据库健康状态失败')
        }

        return response.data!
    }

    /**
     * 获取数据库统计
     */
    async getDatabaseStats(): Promise<DatabaseStats> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<DatabaseStats>>({
            type: 'GET_DATABASE_STATS'
        })

        if (!response.success) {
            throw new Error(response.error || '获取数据库统计失败')
        }

        return response.data!
    }

    // ==================== 搜索历史相关 ====================

    /**
     * 获取搜索历史
     */
    async getSearchHistory(limit: number = 20): Promise<SearchHistoryRecord[]> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<SearchHistoryRecord[]>>({
            type: 'GET_SEARCH_HISTORY',
            data: { limit }
        })

        if (!response.success) {
            throw new Error(response.error || '获取搜索历史失败')
        }

        return response.data || []
    }

    /**
     * 添加搜索历史
     */
    async addSearchHistory(
        _query: string,
        resultCount: number,
        executionTime: number = 0,
        source: SearchHistoryRecord['source'] = 'management'
    ): Promise<void> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<void>>({
            type: 'ADD_SEARCH_HISTORY',
            data: { _query, resultCount, executionTime, source }
        })

        if (!response.success) {
            throw new Error(response.error || '添加搜索历史失败')
        }
    }

    /**
     * 清空搜索历史
     */
    async clearSearchHistory(): Promise<void> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<void>>({
            type: 'CLEAR_SEARCH_HISTORY'
        })

        if (!response.success) {
            throw new Error(response.error || '清空搜索历史失败')
        }
    }

    // ==================== 设置相关 ====================

    /**
     * 获取设置
     */
    async getSetting<T>(key: string): Promise<T | null> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<T>>({
            type: 'GET_SETTING',
            data: { key }
        })

        if (!response.success) {
            throw new Error(response.error || '获取设置失败')
        }

        return response.data || null
    }

    /**
     * 保存设置
     */
    async saveSetting(key: string, value: any, description?: string): Promise<void> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<void>>({
            type: 'SAVE_SETTING',
            data: { key, value, description }
        })

        if (!response.success) {
            throw new Error(response.error || '保存设置失败')
        }
    }

    /**
     * 删除设置
     */
    async deleteSetting(key: string): Promise<void> {
        await this._ensureReady()

        const response = await this._sendMessage<ApiResponse<void>>({
            type: 'DELETE_SETTING',
            data: { key }
        })

        if (!response.success) {
            throw new Error(response.error || '删除设置失败')
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 检查连接状态
     */
    async isConnected(): Promise<boolean> {
        try {
            const health = await this.healthCheck()
            return health.success && health.ready
        } catch {
            return false
        }
    }

    /**
     * 重置连接
     */
    async resetConnection(): Promise<void> {
        this.isReady = false
        this.readyPromise = null
        this.connectionRetries = 0
        this.retryDelay = 1000

        await this.initialize()
    }

    /**
     * 获取连接状态
     */
    getConnectionStatus(): {
        isReady: boolean
        retries: number
        maxRetries: number
    } {
        return {
            isReady: this.isReady,
            retries: this.connectionRetries,
            maxRetries: this.maxRetries
        }
    }
}

// ==================== 便捷的页面级API ====================

/**
 * 为不同页面提供特定的API接口
 */
export class PageBookmarkAPI {
    protected api: UnifiedBookmarkAPI

    constructor() {
        this.api = UnifiedBookmarkAPI.getInstance()
    }

    /**
     * 初始化API
     */
    async initialize(): Promise<void> {
        return this.api.initialize()
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        return this.api.healthCheck()
    }

    /**
     * 检查连接状态
     */
    async isConnected(): Promise<boolean> {
        return this.api.isConnected()
    }
}

/**
 * Management页面专用API
 */
export class ManagementBookmarkAPI extends PageBookmarkAPI {
    /**
     * 获取书签树数据
     */
    async getBookmarkTreeData() {
        const bookmarks = await this.api.getAllBookmarks()
        return {
            bookmarks,
            folders: bookmarks.filter(b => b.isFolder),
            totalCount: bookmarks.length,
            lastUpdate: Date.now()
        }
    }

    /**
     * 获取书签统计
     */
    async getBookmarkStats() {
        const stats = await this.api.getGlobalStats()
        if (!stats) {
            throw new Error('无法获取统计数据')
        }

        return {
            bookmarks: stats.totalBookmarks,
            folders: stats.totalFolders,
            totalUrls: stats.totalBookmarks,
            duplicates: stats.duplicateUrls,
            emptyFolders: stats.emptyFolders
        }
    }

    /**
     * 搜索书签（弹窗优化版）
     */
    async searchBookmarks() {

        // Note: bookmarkSearchService temporarily disabled
        const results: StandardSearchResult[] = []
        return results.map(result => ({
            id: result.id,
            title: result.title,
            url: result.url,
            domain: result.domain,
            path: result.path,
            isFolder: result.isFolder,
            dateAdded: result.dateAdded
        }))
    }

    /**
     * 同步书签
     */
    async syncBookmarks(): Promise<boolean> {
        return this.api.syncBookmarks()
    }

    /**
     * 强制重新加载数据
     */
    async forceReloadData(): Promise<void> {
        return this.api.forceReloadData()
    }
}

/**
 * Popup页面专用API
 */
export class PopupBookmarkAPI extends PageBookmarkAPI {
    /**
     * 获取快速统计
     */
    async getQuickStats() {
        const stats = await this.api.getGlobalStats()
        if (!stats) {
            return {
                totalBookmarks: 0,
                totalFolders: 0,
                totalDomains: 0,
                lastUpdate: 0
            }
        }

        return {
            totalBookmarks: stats.totalBookmarks,
            totalFolders: stats.totalFolders,
            totalDomains: stats.totalDomains,
            lastUpdate: stats.lastUpdated
        }
    }

    /**
     * 获取热门域名
     */
    async getTopDomains(limit = 5) {
        const stats = await this.api.getGlobalStats()
        return stats?.topDomains.slice(0, limit) || []
    }

    /**
     * 搜索书签
     */
    async searchBookmarks(query: string, limit = 100) {
        return this.api.searchBookmarks(query, { limit })
    }
}

/**
 * SearchPopup页面专用API
 */
export class SearchPopupBookmarkAPI extends PageBookmarkAPI {
    /**
     * 搜索书签（搜索页面专用）
     */
    async searchBookmarks(query: string, _options: SearchOptions = {}) {
        // 搜索页面使用精确搜索模式，支持完整功能

        // Note: bookmarkSearchService temporarily disabled
        const results: StandardSearchResult[] = []

        // 返回兼容的搜索结果格式
        return results.map(result => ({
            bookmark: {
                id: result.id,
                title: result.title,
                url: result.url,
                domain: result.domain || '',
                path: result.path || [],
                pathString: result.path?.join(' / ') || '',
                pathIds: [], // 搜索页面不需要详细路径ID
                pathIdsString: '',
                ancestorIds: [],
                siblingIds: [],
                titleLower: result.title.toLowerCase(),
                urlLower: result.url.toLowerCase(),
                isFolder: result.isFolder,
                dateAdded: result.dateAdded,
                tags: result.tags || [],
                keywords: result.keywords || [],
                // 添加其他必需的BookmarkRecord字段
                index: 0,
                depth: 0,
                childrenCount: 0,
                bookmarksCount: result.isFolder ? 0 : 1,
                folderCount: result.isFolder ? 1 : 0,
                category: '',
                notes: '',
                lastVisited: undefined,
                visitCount: undefined,
                createdYear: new Date(result.dateAdded || 0).getFullYear(),
                createdMonth: new Date(result.dateAdded || 0).getMonth() + 1,
                domainCategory: '',
                flatIndex: 0,
                isVisible: true,
                sortKey: result.title,
                dataVersion: '1.0',
                lastCalculated: Date.now()
            },
            score: result.score,
            matchedFields: result.matchedFields,
            highlights: result.highlights || {}
        }))
    }

    /**
     * 获取搜索历史
     */
    async getSearchHistory(limit = 10) {
        return this.api.getSearchHistory(limit)
    }

    /**
     * 添加搜索历史
     */
    async addSearchHistory(query: string, resultCount: number, executionTime: number) {
        return this.api.addSearchHistory(query, resultCount, executionTime, 'search-popup')
    }
}

/**
 * SidePanel页面专用API
 */
export class SidePanelBookmarkAPI extends PageBookmarkAPI {
    /**
     * 获取书签层级结构
     */
    async getBookmarkHierarchy(maxDepth = 3) {
        const allBookmarks = await this.api.getAllBookmarks()

        // 构建层级结构，限制深度
        return allBookmarks.filter(b => b.depth <= maxDepth)
    }

    /**
     * 获取文件夹子节点
     */
    async getFolderChildren(parentId: string) {
        return this.api.getChildrenByParentId(parentId)
    }

    /**
     * 内存搜索书签（侧边栏专用）
     */
    async searchBookmarks(query: string, bookmarkTree?: any[]) {
        // 如果有书签树数据，使用内存搜索
        if (bookmarkTree && bookmarkTree.length > 0) {
            return this._memorySearch(query, bookmarkTree)
        }

        // 否则使用快速搜索

        // Note: bookmarkSearchService temporarily disabled
        const results: StandardSearchResult[] = []
        return results.map(result => ({
            id: result.id,
            title: result.title,
            url: result.url,
            domain: result.domain,
            path: result.path,
            isFolder: result.isFolder,
            isFaviconLoading: false
        }))
    }

    /**
     * 内存中搜索（类似原SidePanel实现）
     */
    private _memorySearch(query: string, bookmarkTree: any[]): any[] {
        const searchQuery = query.toLowerCase()
        const results: any[] = []

        const searchInNodes = (nodes: any[], currentPath: string[] = []) => {
            nodes.forEach(node => {
                if (node.url) {
                    // 这是一个书签
                    const titleMatch = node.title?.toLowerCase().includes(searchQuery)
                    let domainMatch = false

                    try {
                        const urlObj = new URL(node.url)
                        domainMatch = urlObj.hostname.toLowerCase().includes(searchQuery)
                    } catch {
                        domainMatch = node.url.toLowerCase().includes(searchQuery)
                    }

                    if (titleMatch || domainMatch) {
                        results.push({
                            ...node,
                            path: [...currentPath],
                            isFaviconLoading: false
                        })
                    }
                } else if (node.children) {
                    // 这是一个文件夹，递归搜索
                    const newPath = [...currentPath, node.title]
                    searchInNodes(node.children, newPath)
                }
            })
        }

        searchInNodes(bookmarkTree)
        return results.slice(0, 50) // 限制结果数量
    }
}

// 导出单例实例
export const unifiedBookmarkAPI = UnifiedBookmarkAPI.getInstance()
export const managementAPI = new ManagementBookmarkAPI()
export const popupAPI = new PopupBookmarkAPI()
export const searchPopupAPI = new SearchPopupBookmarkAPI()
export const sidePanelAPI = new SidePanelBookmarkAPI()
