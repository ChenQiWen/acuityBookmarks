/**
 * 超级全局书签缓存管理器
 * 基于SuperBookmarkDataProcessor的高性能数据访问接口
 * 提供统一的数据访问层，支持O(1)查询性能
 */

import {
    type SuperEnhancedBookmarkNode,
    type SuperBookmarkCache,
    type FlatTreeNode,
    type ProcessorOptions,
    DEFAULT_PROCESSOR_OPTIONS,
    CacheStatus
} from '../types/enhanced-bookmark'
import { SuperBookmarkDataProcessor } from './super-bookmark-processor'

export class SuperGlobalBookmarkCache {
    private static instance: SuperGlobalBookmarkCache | null = null
    private cache: SuperBookmarkCache | null = null
    private isInitialized = false
    private initPromise: Promise<void> | null = null
    private updateListeners: Array<(cache: SuperBookmarkCache) => void> = []

    // 配置选项
    private options: ProcessorOptions = DEFAULT_PROCESSOR_OPTIONS

    /**
     * 获取单例实例
     */
    static getInstance(): SuperGlobalBookmarkCache {
        if (!this.instance) {
            this.instance = new SuperGlobalBookmarkCache()
        }
        return this.instance
    }

    /**
     * 初始化缓存（从Chrome API加载数据）
     */
    async initialize(options: Partial<ProcessorOptions> = {}): Promise<void> {
        if (this.isInitialized && this.cache) {
            return
        }

        if (this.initPromise) {
            return this.initPromise
        }

        this.options = { ...DEFAULT_PROCESSOR_OPTIONS, ...options }

        this.initPromise = this._doInitialize()
        return this.initPromise
    }

    private async _doInitialize(): Promise<void> {
        try {
            console.log('🚀 SuperGlobalBookmarkCache 初始化开始...')

            // 1. 从Chrome API获取原始数据
            const chromeData = await this.getChromeBookmarkData()

            // 2. 通过SuperBookmarkDataProcessor处理数据
            this.cache = await SuperBookmarkDataProcessor.processSuperEnhanced(
                chromeData,
                this.options
            )

            // 3. 标记初始化完成
            this.isInitialized = true
            this.initPromise = null

            // 4. 通知监听器
            this.notifyUpdateListeners()

            console.log('✅ SuperGlobalBookmarkCache 初始化完成')

        } catch (error) {
            console.error('❌ SuperGlobalBookmarkCache 初始化失败:', error)
            this.initPromise = null
            throw error
        }
    }

    /**
     * 刷新缓存（重新从Chrome API加载）
     */
    async refresh(force: boolean = false): Promise<void> {
        const status = this.getCacheStatus()

        if (!force && status === CacheStatus.FRESH) {
            console.log('💡 缓存仍新鲜，跳过刷新')
            return
        }

        console.log('🔄 开始刷新缓存...')

        try {
            const chromeData = await this.getChromeBookmarkData()
            this.cache = await SuperBookmarkDataProcessor.processSuperEnhanced(
                chromeData,
                this.options
            )

            this.notifyUpdateListeners()
            console.log('✅ 缓存刷新完成')

        } catch (error) {
            console.error('❌ 缓存刷新失败:', error)
            throw error
        }
    }

    // === 核心数据获取接口 ===

    /**
     * 获取完整书签树
     */
    getBookmarkTree(): SuperEnhancedBookmarkNode[] {
        this.ensureInitialized()
        return this.cache!.data
    }

    /**
     * 根据ID获取节点（O(1)查询）
     */
    getNodeById(id: string): SuperEnhancedBookmarkNode | undefined {
        this.ensureInitialized()
        return this.cache!.nodeById.get(id)
    }

    /**
     * 根据URL获取所有节点（O(1)查询）
     */
    getNodesByUrl(url: string): SuperEnhancedBookmarkNode[] {
        this.ensureInitialized()
        return this.cache!.nodesByUrl.get(url) || []
    }

    /**
     * 根据域名获取所有节点（O(1)查询）
     */
    getNodesByDomain(domain: string): SuperEnhancedBookmarkNode[] {
        this.ensureInitialized()
        return this.cache!.nodesByDomain.get(domain) || []
    }

    /**
     * 获取节点的子节点ID列表（O(1)查询）
     */
    getChildrenIds(parentId: string): string[] {
        this.ensureInitialized()
        return this.cache!.childrenById.get(parentId) || []
    }

    /**
     * 获取节点的父节点ID（O(1)查询）
     */
    getParentId(childId: string): string | undefined {
        this.ensureInitialized()
        return this.cache!.parentById.get(childId)
    }

    /**
     * 获取节点的兄弟节点ID列表（O(1)查询）
     */
    getSiblingIds(nodeId: string): string[] {
        this.ensureInitialized()
        return this.cache!.siblingsById.get(nodeId) || []
    }

    // === 搜索接口 ===

    /**
     * 关键词搜索（O(1)索引查询）
     */
    searchByKeyword(keyword: string): SuperEnhancedBookmarkNode[] {
        this.ensureInitialized()

        const normalizedKeyword = keyword.toLowerCase().trim()
        const nodeIds = this.cache!.searchIndex.get(normalizedKeyword) || []

        return nodeIds
            .map(id => this.cache!.nodeById.get(id)!)
            .filter(node => node) // 过滤undefined
    }

    /**
     * 模糊搜索（支持多关键词）
     */
    fuzzySearch(query: string): SuperEnhancedBookmarkNode[] {
        this.ensureInitialized()

        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0)
        if (keywords.length === 0) return []

        const resultSets = keywords.map(keyword => {
            // 查找包含该关键词的所有词汇
            const matchingKeys = Array.from(this.cache!.searchIndex.keys())
                .filter(key => key.includes(keyword))

            // 合并所有匹配结果
            const nodeIds = new Set<string>()
            matchingKeys.forEach(key => {
                this.cache!.searchIndex.get(key)!.forEach(id => nodeIds.add(id))
            })

            return nodeIds
        })

        // 取交集（所有关键词都匹配的节点）
        let intersection = resultSets[0] || new Set()
        resultSets.slice(1).forEach(set => {
            intersection = new Set([...intersection].filter(id => set.has(id)))
        })

        return Array.from(intersection)
            .map(id => this.cache!.nodeById.get(id)!)
            .filter(node => node)
    }

    /**
     * 获取扁平化书签列表（用于简单遍历）
     */
    getFlatBookmarkList(): SuperEnhancedBookmarkNode[] {
        this.ensureInitialized()
        return this.cache!.flatBookmarkList
    }

    // === 清理检测接口 ===

    /**
     * 获取重复URL的书签组
     */
    getDuplicateUrlGroups(): Map<string, string[]> {
        this.ensureInitialized()
        return this.cache!.duplicateUrls
    }

    /**
     * 获取重复标题的书签组
     */
    getDuplicateTitleGroups(): Map<string, string[]> {
        this.ensureInitialized()
        return this.cache!.duplicateTitles
    }

    /**
     * 获取无效URL的书签ID列表
     */
    getInvalidUrlIds(): string[] {
        this.ensureInitialized()
        return this.cache!.invalidUrlIds
    }

    /**
     * 获取空文件夹的ID列表
     */
    getEmptyFolderIds(): string[] {
        this.ensureInitialized()
        return this.cache!.emptyFolderIds
    }

    /**
     * 检查特定节点的清理问题
     */
    getNodeCleanupIssues(nodeId: string): {
        hasDuplicateUrl: boolean
        hasDuplicateTitle: boolean
        hasInvalidUrl: boolean
        isEmpty: boolean
        duplicateCount: number
    } {
        const node = this.getNodeById(nodeId)
        if (!node) {
            return {
                hasDuplicateUrl: false,
                hasDuplicateTitle: false,
                hasInvalidUrl: false,
                isEmpty: false,
                duplicateCount: 0
            }
        }

        return {
            hasDuplicateUrl: node.duplicateUrlIds.length > 0,
            hasDuplicateTitle: node.duplicateTitleIds.length > 0,
            hasInvalidUrl: node.hasInvalidUrl,
            isEmpty: node.isEmpty,
            duplicateCount: node.duplicateUrlIds.length + node.duplicateTitleIds.length
        }
    }

    // === 虚拟化支持接口 ===

    /**
     * 获取虚拟化的扁平树（用于虚拟滚动）
     */
    getFlattenedTree(): FlatTreeNode[] {
        this.ensureInitialized()
        return this.cache!.flattenedTree
    }

    /**
     * 获取节点可见性状态
     */
    getNodeVisibility(nodeId: string): boolean {
        this.ensureInitialized()
        return this.cache!.visibilityMap.get(nodeId) ?? true
    }

    /**
     * 更新节点可见性（用于展开/折叠状态管理）
     */
    updateNodeVisibility(nodeId: string, visible: boolean): void {
        this.ensureInitialized()
        this.cache!.visibilityMap.set(nodeId, visible)
    }

    // === 统计和分析接口 ===

    /**
     * 获取全局统计数据
     */
    getGlobalStats(): SuperBookmarkCache['globalStats'] {
        this.ensureInitialized()
        return this.cache!.globalStats
    }

    /**
     * 获取域名分布统计
     */
    getDomainStats(): Map<string, number> {
        this.ensureInitialized()
        return this.cache!.domainStats
    }

    /**
     * 获取创建时间分布
     */
    getCreationTimeline(): Map<string, number> {
        this.ensureInitialized()
        return this.cache!.globalStats.creationTimeline
    }

    /**
     * 获取分类分布
     */
    getCategoryDistribution(): Map<string, number> {
        this.ensureInitialized()
        return this.cache!.globalStats.categoryDistribution
    }

    /**
     * 获取节点路径（面包屑导航用）
     */
    getNodePath(nodeId: string): string[] {
        const node = this.getNodeById(nodeId)
        return node ? node.path : []
    }

    /**
     * 获取节点路径字符串
     */
    getNodePathString(nodeId: string): string {
        const node = this.getNodeById(nodeId)
        return node ? node.pathString : ''
    }

    // === Favicon支持（集成现有逻辑） ===

    /**
     * 获取域名的Favicon URL
     * 复用现有的favicon缓存逻辑
     */
    async getFaviconForUrl(url: string, size: number = 32): Promise<string> {
        // 这里可以集成现有的GlobalBookmarkCache的favicon逻辑
        // 或者将favicon管理迁移到这里

        try {
            // 先尝试Google Favicon服务
            const googleFaviconUrl = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=${size}`

            // 可以在这里实现缓存逻辑
            return googleFaviconUrl

        } catch (error) {
            console.warn('获取favicon失败:', error)
            return '' // 返回空字符串，调用方使用默认图标
        }
    }

    // === 缓存管理接口 ===

    /**
     * 获取缓存状态
     */
    getCacheStatus(): CacheStatus {
        if (!this.cache) return CacheStatus.MISSING
        return SuperBookmarkDataProcessor.getCacheStatus()
    }

    /**
     * 获取缓存元数据
     */
    getCacheMetadata(): SuperBookmarkCache['metadata'] | null {
        return this.cache?.metadata || null
    }

    /**
     * 清理缓存
     */
    async clearCache(): Promise<void> {
        this.cache = null
        this.isInitialized = false
        this.initPromise = null
        await SuperBookmarkDataProcessor.clearCache()
        console.log('✅ SuperGlobalBookmarkCache 缓存已清理')
    }

    /**
     * 获取内存使用统计
     */
    getMemoryUsage(): {
        nodeCount: number
        indexCount: number
        estimatedBytes: number
    } {
        this.ensureInitialized()
        return this.cache!.globalStats.memoryUsage
    }

    // === 事件监听器管理 ===

    /**
     * 添加数据更新监听器
     */
    onDataUpdate(listener: (cache: SuperBookmarkCache) => void): () => void {
        this.updateListeners.push(listener)

        // 返回取消监听的函数
        return () => {
            const index = this.updateListeners.indexOf(listener)
            if (index > -1) {
                this.updateListeners.splice(index, 1)
            }
        }
    }

    /**
     * 通知所有监听器
     */
    private notifyUpdateListeners(): void {
        if (this.cache) {
            this.updateListeners.forEach(listener => {
                try {
                    listener(this.cache!)
                } catch (error) {
                    console.error('数据更新监听器执行失败:', error)
                }
            })
        }
    }

    // === Chrome API集成 ===

    /**
     * 从Chrome API获取书签数据
     */
    private async getChromeBookmarkData(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
        return new Promise((resolve, reject) => {
            if (typeof chrome !== 'undefined' && chrome.bookmarks) {
                chrome.bookmarks.getTree((tree) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message))
                        return
                    }
                    resolve(tree)
                })
            } else {
                // 开发环境或非Chrome环境的模拟数据
                console.warn('Chrome API不可用，使用模拟数据')
                resolve(this.getMockData())
            }
        })
    }

    /**
     * 监听Chrome书签变化事件
     */
    setupChromeBookmarkListeners(): void {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {

            // 书签创建
            chrome.bookmarks.onCreated.addListener(() => {
                console.log('📚 检测到书签创建，将在下次访问时刷新缓存')
                this.invalidateCache()
            })

            // 书签删除
            chrome.bookmarks.onRemoved.addListener(() => {
                console.log('📚 检测到书签删除，将在下次访问时刷新缓存')
                this.invalidateCache()
            })

            // 书签更改
            chrome.bookmarks.onChanged.addListener(() => {
                console.log('📚 检测到书签更改，将在下次访问时刷新缓存')
                this.invalidateCache()
            })

            // 书签移动
            chrome.bookmarks.onMoved.addListener(() => {
                console.log('📚 检测到书签移动，将在下次访问时刷新缓存')
                this.invalidateCache()
            })
        }
    }

    /**
     * 使缓存失效（标记为需要刷新）
     */
    private invalidateCache(): void {
        // 将缓存标记为需要刷新，但不立即刷新
        // 下次访问时会自动刷新
        if (this.cache) {
            this.cache.metadata.processedAt = 0 // 使时间戳失效
        }
    }

    /**
     * 确保缓存已初始化
     */
    private ensureInitialized(): void {
        if (!this.isInitialized || !this.cache) {
            throw new Error('SuperGlobalBookmarkCache 尚未初始化，请先调用 initialize()')
        }
    }

    /**
     * 生成模拟数据（开发环境用）
     */
    private getMockData(): chrome.bookmarks.BookmarkTreeNode[] {
        return [{
            id: '0',
            title: '',
            dateAdded: Date.now(),
            syncing: false,
            children: [
                {
                    id: '1',
                    title: '书签栏',
                    dateAdded: Date.now(),
                    syncing: false,
                    children: [
                        {
                            id: '2',
                            title: 'Vue.js',
                            url: 'https://vuejs.org/',
                            dateAdded: Date.now() - 86400000,
                            syncing: false
                        },
                        {
                            id: '3',
                            title: 'TypeScript',
                            url: 'https://www.typescriptlang.org/',
                            dateAdded: Date.now() - 172800000,
                            syncing: false
                        }
                    ]
                },
                {
                    id: '4',
                    title: '其他书签',
                    dateAdded: Date.now(),
                    syncing: false,
                    children: []
                }
            ]
        }]
    }
}

// 导出单例实例
export const superGlobalBookmarkCache = SuperGlobalBookmarkCache.getInstance()
