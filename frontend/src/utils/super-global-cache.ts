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
    // DEFAULT_PROCESSOR_OPTIONS, // 注意：已迁移到IndexedDB
    CacheStatus
} from '../types/enhanced-bookmark'
// 注意：SuperBookmarkDataProcessor已迁移到IndexedDB架构

export class SuperGlobalBookmarkCache {
    private static instance: SuperGlobalBookmarkCache | null = null
    private cache: SuperBookmarkCache | null = null
    private isInitialized = false
    private initPromise: Promise<void> | null = null
    private updateListeners: Array<(cache: SuperBookmarkCache) => void> = []

    // 配置选项
    // private options: ProcessorOptions = DEFAULT_PROCESSOR_OPTIONS // 注意：已迁移到IndexedDB

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
    async initialize(_options: Partial<ProcessorOptions> = {}): Promise<void> {
        if (this.isInitialized && this.cache) {
            return
        }

        if (this.initPromise) {
            return this.initPromise
        }

        // this.options = { ...DEFAULT_PROCESSOR_OPTIONS, ...options } // 注意：已迁移到IndexedDB

        this.initPromise = this._doInitialize()
        return this.initPromise
    }

    private async _doInitialize(): Promise<void> {
        try {
            console.log('🚀 SuperGlobalBookmarkCache 初始化开始...')

            // 1. 从Chrome API获取原始数据（暂时禁用）
            // const chromeData = await this.getChromeBookmarkData()

            // 2. 注意：数据处理已迁移到IndexedDB
            // this.cache = await SuperBookmarkDataProcessor.processSuperEnhanced(chromeData, this.options)
            this.cache = null // 暂时禁用，使用IndexedDB

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
            // const chromeData = await this.getChromeBookmarkData() // 暂时禁用
            // 注意：数据处理已迁移到IndexedDB
            // this.cache = await SuperBookmarkDataProcessor.processSuperEnhanced(chromeData, this.options)
            this.cache = null // 暂时禁用，使用IndexedDB

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

    /**
     * 获取节点ID路径（基于ID的快速查找）
     */
    getNodePathIds(nodeId: string): string[] {
        const node = this.getNodeById(nodeId)
        return node ? node.pathIds : []
    }

    /**
     * 获取节点ID路径字符串（基于ID的快速查找）
     */
    getNodePathIdsString(nodeId: string): string {
        const node = this.getNodeById(nodeId)
        return node ? node.pathIdsString : ''
    }

    /**
     * 根据ID路径查找节点（快速查找，避免名称重复问题）
     */
    getNodeByIdPath(pathIds: string[]): SuperEnhancedBookmarkNode | null {
        if (!this.cache || !pathIds || pathIds.length === 0) return null

        // 从最后一个ID开始查找（目标节点）
        const targetId = pathIds[pathIds.length - 1]
        const node = this.getNodeById(targetId)

        // 验证路径是否匹配
        if (node && node.pathIds &&
            node.pathIds.length === pathIds.length &&
            node.pathIds.every((id, index) => id === pathIds[index])) {
            return node
        }

        return null
    }

    /**
     * 根据ID路径字符串查找节点
     */
    getNodeByIdPathString(pathIdsString: string): SuperEnhancedBookmarkNode | null {
        if (!pathIdsString) return null
        const pathIds = pathIdsString.split(' / ').filter(id => id.trim())
        return this.getNodeByIdPath(pathIds)
    }

    /**
     * 🚀 新功能演示：基于ID路径的快速查找与名称路径对比
     * 展示ID路径在处理重名问题和查找效率上的优势
     */
    demonstrateIdPathAdvantages(): {
        nameBasedIssues: Array<{ problem: string; example: string }>,
        idBasedSolutions: Array<{ solution: string; example: string }>,
        performanceComparison: { nameSearch: number; idSearch: number; improvement: string }
    } {
        if (!this.cache) {
            return {
                nameBasedIssues: [],
                idBasedSolutions: [],
                performanceComparison: { nameSearch: 0, idSearch: 0, improvement: '0%' }
            }
        }

        const nameBasedIssues: Array<{ problem: string; example: string }> = []
        const idBasedSolutions: Array<{ solution: string; example: string }> = []

        // 1. 查找重名文件夹的问题
        const folderNames = new Map<string, string[]>()
        this.cache.data.forEach(node => {
            if (!node.url) { // 文件夹
                const existing = folderNames.get(node.title) || []
                existing.push(node.id)
                folderNames.set(node.title, existing)
            }
        })

        // 找到重名的文件夹
        for (const [name, ids] of folderNames.entries()) {
            if (ids.length > 1) {
                nameBasedIssues.push({
                    problem: `重名文件夹"${name}"导致路径歧义`,
                    example: `名称路径无法区分多个同名文件夹: ${ids.map(id => this.getNodePathString(id)).join(' vs ')}`
                })

                idBasedSolutions.push({
                    solution: `使用ID路径精确定位每个文件夹`,
                    example: `ID路径可精确区分: ${ids.map(id => `${this.getNodePathIdsString(id)} (${name})`).join(' vs ')}`
                })
            }
        }

        // 2. 性能对比测试
        const sampleNodes = Array.from(this.cache.nodeById.values()).slice(0, 100)

        // 基于名称的查找测试
        const nameSearchStart = performance.now()
        sampleNodes.forEach(node => {
            // 模拟通过名称路径查找（需要遍历和匹配）
            // 实际场景中需要进行复杂的字符串匹配和树遍历操作
            // 这里模拟路径解析操作的开销
            void node.pathString.split(' / ')
        })
        const nameSearchTime = performance.now() - nameSearchStart

        // 基于ID的查找测试
        const idSearchStart = performance.now()
        sampleNodes.forEach(node => {
            // 直接通过ID路径查找（O(1)复杂度）
            this.getNodeByIdPath(node.pathIds)
        })
        const idSearchTime = performance.now() - idSearchStart

        const improvement = nameSearchTime > 0
            ? `${((nameSearchTime - idSearchTime) / nameSearchTime * 100).toFixed(1)}%`
            : '0%'

        return {
            nameBasedIssues,
            idBasedSolutions,
            performanceComparison: {
                nameSearch: nameSearchTime,
                idSearch: idSearchTime,
                improvement
            }
        }
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
        // 注意：缓存状态已迁移到IndexedDB
        return CacheStatus.FRESH // return SuperBookmarkDataProcessor.getCacheStatus()
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
        // 注意：缓存清理已迁移到IndexedDB
        // await SuperBookmarkDataProcessor.clearCache()
        console.log('✅ SuperGlobalBookmarkCache 缓存已清理（IndexedDB模式）')
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

    // 注意：Chrome API数据获取已迁移到IndexedDB架构

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

    // 注意：模拟数据已迁移到IndexedDB测试数据
}

// 导出单例实例
export const superGlobalBookmarkCache = SuperGlobalBookmarkCache.getInstance()
