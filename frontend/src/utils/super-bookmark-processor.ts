/**
 * 超级书签数据处理器
 * 一次遍历，全面预计算的核心处理引擎
 * 将Chrome书签数据转换为高性能的增强数据结构
 */

import type {
    SuperEnhancedBookmarkNode,
    SuperBookmarkCache,
    FlatTreeNode,
    ProcessorOptions
} from '../types/enhanced-bookmark'
import {
    DEFAULT_PROCESSOR_OPTIONS,
    PROCESSOR_ERROR_CODES,
    ProcessorError,
    DomainCategory,
    CacheStatus
} from '../types/enhanced-bookmark'

export class SuperBookmarkDataProcessor {
    private static readonly VERSION = '2.0.0'
    private static readonly STORAGE_KEY = 'acuity-super-bookmark-cache-v2'

    // 内存缓存
    private static memoryCache: SuperBookmarkCache | null = null

    /**
     * 主要处理方法：Chrome数据 → 超级增强数据
     * 一次性完成所有预计算和索引构建
     */
    static async processSuperEnhanced(
        chromeData: chrome.bookmarks.BookmarkTreeNode[],
        options: Partial<ProcessorOptions> = {}
    ): Promise<SuperBookmarkCache> {

        const opts = { ...DEFAULT_PROCESSOR_OPTIONS, ...options }
        const startTime = performance.now()

        console.log('🚀 开始超级增强书签数据处理...')
        console.log(`📊 输入数据: ${this.countNodes(chromeData)} 个节点`)

        try {
            // 1. 检查内存缓存
            const originalHash = this.generateDataHash(chromeData)
            if (this.memoryCache && this.memoryCache.metadata.originalDataHash === originalHash) {
                console.log('✅ 使用内存缓存数据')
                return this.memoryCache
            }

            // 2. 检查存储缓存
            const storageCache = await this.getCachedFromStorage()
            if (storageCache && storageCache.metadata.originalDataHash === originalHash) {
                console.log('✅ 使用存储缓存数据')
                this.memoryCache = storageCache
                return storageCache
            }

            // 3. 开始全面数据处理
            const phaseStartTime = performance.now()
            const performanceStats = {
                transformTime: 0,
                indexTime: 0,
                cleanupTime: 0,
                searchTime: 0,
                virtualTime: 0,
                analyticsTime: 0
            }

            // === 第一阶段：基础转换 + 核心预计算 ===
            console.log('🔄 Phase 1: 基础数据转换和预计算...')
            const phaseStart = performance.now()
            const enhancedData = this.transformAndPrecompute(chromeData, opts)
            performanceStats.transformTime = performance.now() - phaseStart
            console.log(`✅ Phase 1 完成，耗时: ${performanceStats.transformTime.toFixed(2)}ms`)

            // === 第二阶段：构建全局索引 ===
            console.log('🔄 Phase 2: 构建全局索引...')
            const indexStart = performance.now()
            const globalIndexes = this.buildAllIndexes(enhancedData)
            performanceStats.indexTime = performance.now() - indexStart
            console.log(`✅ Phase 2 完成，耗时: ${performanceStats.indexTime.toFixed(2)}ms`)

            // === 第三阶段：清理检测预处理 ===
            console.log('🔄 Phase 3: 清理检测预处理...')
            const cleanupStart = performance.now()
            const cleanupData = this.detectAllCleanupIssues(enhancedData, globalIndexes, opts)
            this.applyCleanupResults(enhancedData, cleanupData)
            performanceStats.cleanupTime = performance.now() - cleanupStart
            console.log(`✅ Phase 3 完成，耗时: ${performanceStats.cleanupTime.toFixed(2)}ms`)

            // === 第四阶段：构建搜索索引 ===
            console.log('🔄 Phase 4: 构建搜索索引...')
            const searchStart = performance.now()
            const searchIndexes = this.buildSearchIndexes(enhancedData, opts)
            performanceStats.searchTime = performance.now() - searchStart
            console.log(`✅ Phase 4 完成，耗时: ${performanceStats.searchTime.toFixed(2)}ms`)

            // === 第五阶段：虚拟化预计算 ===
            console.log('🔄 Phase 5: 虚拟化预处理...')
            const virtualStart = performance.now()
            const virtualizationData = this.prepareVirtualization(enhancedData, opts)
            performanceStats.virtualTime = performance.now() - virtualStart
            console.log(`✅ Phase 5 完成，耗时: ${performanceStats.virtualTime.toFixed(2)}ms`)

            // === 第六阶段：全局分析统计 ===
            console.log('🔄 Phase 6: 分析统计...')
            const analyticsStart = performance.now()
            const analyticsData = this.calculateGlobalAnalytics(enhancedData, globalIndexes)
            performanceStats.analyticsTime = performance.now() - analyticsStart
            console.log(`✅ Phase 6 完成，耗时: ${performanceStats.analyticsTime.toFixed(2)}ms`)

            const totalProcessingTime = performance.now() - phaseStartTime

            // 7. 构建最终缓存对象
            const cache: SuperBookmarkCache = {
                // 原始数据
                data: enhancedData,

                // 全局索引
                ...globalIndexes,

                // 清理检测结果
                ...cleanupData,

                // 搜索索引
                ...searchIndexes,

                // 虚拟化数据
                ...virtualizationData,

                // 全局统计
                globalStats: analyticsData,

                // 缓存元数据
                metadata: {
                    originalDataHash: originalHash,
                    processedAt: Date.now(),
                    version: SuperBookmarkDataProcessor.VERSION,
                    processingTime: totalProcessingTime,
                    cacheHitRate: this.memoryCache ? 0.95 : 0,
                    indexBuildTime: performanceStats.indexTime,
                    performance: performanceStats
                }
            }

            // 8. 保存到缓存
            this.memoryCache = cache
            await this.saveCacheToStorage(cache)

            const totalTime = performance.now() - startTime
            console.log('🎉 超级增强处理完成！')
            console.log(`⏱️  总耗时: ${totalTime.toFixed(2)}ms`)
            console.log(`📊 处理结果:`)
            console.log(`   • ${cache.globalStats.totalBookmarks} 个书签`)
            console.log(`   • ${cache.globalStats.totalFolders} 个文件夹`)
            console.log(`   • ${cache.globalStats.maxDepth} 层最大深度`)
            console.log(`   • ${cache.nodeById.size} 个索引节点`)
            console.log(`   • ${cache.searchIndex.size} 个搜索关键词`)
            console.log(`   • ${cache.duplicateUrls.size} 组重复URL`)
            console.log(`   • ${cache.globalStats.memoryUsage.estimatedBytes} 字节内存使用`)

            return cache

        } catch (error) {
            console.error('❌ 超级增强处理失败:', error)
            throw new ProcessorError(
                '数据处理失败',
                PROCESSOR_ERROR_CODES.PROCESSING_FAILED,
                error
            )
        }
    }

    /**
     * 第一阶段：基础转换 + 核心预计算
     * 递归遍历Chrome数据，转换为增强格式，同时预计算统计信息
     */
    private static transformAndPrecompute(
        chromeNodes: chrome.bookmarks.BookmarkTreeNode[],
        options: ProcessorOptions,
        depth = 0,
        parentPath: string[] = [],
        ancestorIds: string[] = []
    ): SuperEnhancedBookmarkNode[] {

        return chromeNodes.map((chromeNode, index) => {
            const currentPath = [...parentPath, chromeNode.title]
            const currentAncestors = [...ancestorIds]

            const enhanced: SuperEnhancedBookmarkNode = {
                // === Chrome原始字段 ===
                id: chromeNode.id,
                title: chromeNode.title,
                url: chromeNode.url,
                parentId: chromeNode.parentId,
                index: chromeNode.index ?? index,
                dateAdded: chromeNode.dateAdded || Date.now(),

                // === 路径预计算 ===
                path: currentPath,
                pathString: currentPath.join(' / '),
                ancestorIds: currentAncestors.slice(), // 不包含自身
                siblingIds: [], // 稍后填充
                depth: depth,
                maxSubDepth: depth,

                // === 搜索预计算 ===
                domain: chromeNode.url ? this.extractDomain(chromeNode.url) : undefined,
                normalizedTitle: this.normalizeTitle(chromeNode.title),
                searchKeywords: this.extractKeywords(chromeNode.title, options.searchIndex),
                titleWords: this.tokenizeTitle(chromeNode.title),

                // === 清理检测预计算（稍后填充） ===
                duplicateUrlIds: [],
                duplicateTitleIds: [],
                hasInvalidUrl: chromeNode.url ? !this.isValidUrl(chromeNode.url) : false,
                isEmpty: false, // 稍后计算

                // === 分析数据预计算 ===
                createdYear: chromeNode.dateAdded ? new Date(chromeNode.dateAdded).getFullYear() : new Date().getFullYear(),
                createdMonth: chromeNode.dateAdded ? new Date(chromeNode.dateAdded).getMonth() + 1 : new Date().getMonth() + 1,
                domainCategory: chromeNode.url ? this.categorizeDomain(chromeNode.url) : undefined,

                // === 虚拟化预计算（稍后填充） ===
                flatIndex: 0,
                isVisible: true,
                sortKey: this.generateSortKey(chromeNode.title, !!chromeNode.url),

                // === 统计预计算（递归计算） ===
                bookmarkCount: 0,
                folderCount: 0,
                totalCount: 0,

                // === 元数据 ===
                dataVersion: SuperBookmarkDataProcessor.VERSION,
                lastCalculated: Date.now()
            }

            // 递归处理子节点
            if (chromeNode.children && chromeNode.children.length > 0) {
                enhanced.children = this.transformAndPrecompute(
                    chromeNode.children,
                    options,
                    depth + 1,
                    currentPath,
                    [...currentAncestors, chromeNode.id]
                )

                // 计算子树统计
                const stats = this.calculateTreeStats(enhanced.children)
                enhanced.bookmarkCount = stats.bookmarkCount
                enhanced.folderCount = stats.folderCount + 1 // +1 自身是文件夹
                enhanced.totalCount = stats.totalCount + 1
                enhanced.maxSubDepth = Math.max(stats.maxSubDepth, depth)
                enhanced.isEmpty = enhanced.children.length === 0

                // 填充兄弟节点ID
                const siblingIds = enhanced.children.map(child => child.id)
                enhanced.children.forEach(child => {
                    child.siblingIds = siblingIds.filter(id => id !== child.id)
                })
            } else {
                // 叶子节点处理
                enhanced.bookmarkCount = enhanced.url ? 1 : 0
                enhanced.folderCount = enhanced.url ? 0 : 1
                enhanced.totalCount = 1
                enhanced.isEmpty = !enhanced.url // 没有URL的叶子节点算空文件夹
            }

            return enhanced
        })
    }

    /**
     * 第二阶段：构建全局索引
     * 建立各种快速查找映射表
     */
    private static buildAllIndexes(data: SuperEnhancedBookmarkNode[]) {
        const nodeById = new Map<string, SuperEnhancedBookmarkNode>()
        const nodesByUrl = new Map<string, SuperEnhancedBookmarkNode[]>()
        const nodesByDomain = new Map<string, SuperEnhancedBookmarkNode[]>()
        const nodesByTitle = new Map<string, SuperEnhancedBookmarkNode[]>()
        const childrenById = new Map<string, string[]>()
        const parentById = new Map<string, string>()
        const siblingsById = new Map<string, string[]>()

        const traverse = (nodes: SuperEnhancedBookmarkNode[]) => {
            // 计算同级节点关系
            const siblingIds = nodes.map(node => node.id)

            nodes.forEach(node => {
                // ID索引
                nodeById.set(node.id, node)

                // 同级关系索引
                siblingsById.set(node.id, siblingIds.filter(id => id !== node.id))

                // URL索引
                if (node.url) {
                    // 相同URL分组
                    if (!nodesByUrl.has(node.url)) {
                        nodesByUrl.set(node.url, [])
                    }
                    nodesByUrl.get(node.url)!.push(node)

                    // 域名分组
                    if (node.domain) {
                        if (!nodesByDomain.has(node.domain)) {
                            nodesByDomain.set(node.domain, [])
                        }
                        nodesByDomain.get(node.domain)!.push(node)
                    }
                }

                // 标题索引（标准化后分组）
                if (!nodesByTitle.has(node.normalizedTitle)) {
                    nodesByTitle.set(node.normalizedTitle, [])
                }
                nodesByTitle.get(node.normalizedTitle)!.push(node)

                // 父子关系索引
                if (node.children && node.children.length > 0) {
                    const childIds = node.children.map(c => c.id)
                    childrenById.set(node.id, childIds)

                    // 建立子节点的父指针
                    node.children.forEach(child => {
                        parentById.set(child.id, node.id)
                    })

                    // 递归处理子节点
                    traverse(node.children)
                }
            })
        }

        traverse(data)

        return {
            nodeById,
            nodesByUrl,
            nodesByDomain,
            nodesByTitle,
            childrenById,
            parentById,
            siblingsById
        }
    }

    /**
     * 第三阶段：清理检测预处理
     * 检测重复、无效和空节点
     */
    private static detectAllCleanupIssues(
        data: SuperEnhancedBookmarkNode[],
        indexes: ReturnType<typeof SuperBookmarkDataProcessor.buildAllIndexes>,
        options: ProcessorOptions
    ) {
        const duplicateUrls = new Map<string, string[]>()
        const duplicateTitles = new Map<string, string[]>()
        const invalidUrlIds: string[] = []
        const emptyFolderIds: string[] = []

        // 检测重复URL
        if (options.enableDuplicateDetection) {
            indexes.nodesByUrl.forEach((nodes, url) => {
                if (nodes.length > 1) {
                    const nodeIds = nodes.map(n => n.id)
                    duplicateUrls.set(url, nodeIds)
                }
            })

            // 检测相似标题
            indexes.nodesByTitle.forEach((nodes, title) => {
                if (nodes.length > 1) {
                    const nodeIds = nodes.map(n => n.id)
                    duplicateTitles.set(title, nodeIds)
                }
            })
        }

        // 检测无效URL和空文件夹
        const traverse = (nodes: SuperEnhancedBookmarkNode[]) => {
            nodes.forEach(node => {
                if (node.hasInvalidUrl) {
                    invalidUrlIds.push(node.id)
                }

                if (node.isEmpty && !node.url) {
                    emptyFolderIds.push(node.id)
                }

                if (node.children) {
                    traverse(node.children)
                }
            })
        }

        traverse(data)

        return {
            duplicateUrls,
            duplicateTitles,
            invalidUrlIds,
            emptyFolderIds
        }
    }

    /**
     * 将清理检测结果应用到节点上
     */
    private static applyCleanupResults(
        data: SuperEnhancedBookmarkNode[],
        cleanupData: ReturnType<typeof SuperBookmarkDataProcessor.detectAllCleanupIssues>
    ) {
        const traverse = (nodes: SuperEnhancedBookmarkNode[]) => {
            nodes.forEach(node => {
                // 应用重复URL信息
                if (node.url && cleanupData.duplicateUrls.has(node.url)) {
                    node.duplicateUrlIds = cleanupData.duplicateUrls.get(node.url)!
                        .filter(id => id !== node.id) // 排除自身
                }

                // 应用重复标题信息
                if (cleanupData.duplicateTitles.has(node.normalizedTitle)) {
                    node.duplicateTitleIds = cleanupData.duplicateTitles.get(node.normalizedTitle)!
                        .filter(id => id !== node.id) // 排除自身
                }

                if (node.children) {
                    traverse(node.children)
                }
            })
        }

        traverse(data)
    }

    /**
     * 第四阶段：构建搜索索引
     * 建立关键词到节点的映射，支持快速搜索
     */
    private static buildSearchIndexes(
        data: SuperEnhancedBookmarkNode[],
        options: ProcessorOptions
    ) {
        const flatBookmarkList: SuperEnhancedBookmarkNode[] = []
        const searchIndex = new Map<string, string[]>()
        const domainStats = new Map<string, number>()

        let flatIndex = 0

        const traverse = (nodes: SuperEnhancedBookmarkNode[]) => {
            nodes.forEach(node => {
                // 更新扁平化索引
                node.flatIndex = flatIndex++

                if (node.url) {
                    flatBookmarkList.push(node)

                    // 构建搜索关键词索引
                    if (options.enableSearchIndex) {
                        node.searchKeywords.forEach(keyword => {
                            if (!searchIndex.has(keyword)) {
                                searchIndex.set(keyword, [])
                            }
                            searchIndex.get(keyword)!.push(node.id)
                        })

                        // 标题分词也加入索引
                        node.titleWords.forEach(word => {
                            if (word.length >= options.searchIndex.minKeywordLength) {
                                if (!searchIndex.has(word)) {
                                    searchIndex.set(word, [])
                                }
                                searchIndex.get(word)!.push(node.id)
                            }
                        })
                    }

                    // 域名统计
                    if (node.domain) {
                        domainStats.set(node.domain, (domainStats.get(node.domain) || 0) + 1)
                    }
                }

                if (node.children) {
                    traverse(node.children)
                }
            })
        }

        traverse(data)

        return {
            flatBookmarkList,
            searchIndex,
            domainStats
        }
    }

    /**
     * 第五阶段：虚拟化预处理
     * 为虚拟滚动准备扁平化的树结构
     */
    private static prepareVirtualization(
        data: SuperEnhancedBookmarkNode[],
        options: ProcessorOptions
    ) {
        const flattenedTree: FlatTreeNode[] = []
        const visibilityMap = new Map<string, boolean>()

        if (!options.enableVirtualization) {
            return { flattenedTree, visibilityMap }
        }

        let index = 0

        const traverse = (nodes: SuperEnhancedBookmarkNode[], depth: number = 0) => {
            nodes.forEach(node => {
                const flatNode: FlatTreeNode = {
                    id: node.id,
                    title: node.title,
                    url: node.url,
                    depth: depth,
                    index: index++,
                    isFolder: !!node.children,
                    isExpanded: false, // 默认收起
                    parentId: node.parentId,
                    originalNode: node
                }

                flattenedTree.push(flatNode)
                visibilityMap.set(node.id, true) // 默认可见

                if (node.children) {
                    traverse(node.children, depth + 1)
                }
            })
        }

        traverse(data)

        return {
            flattenedTree,
            visibilityMap
        }
    }

    /**
     * 第六阶段：全局分析统计
     * 计算各种统计信息和分析数据
     */
    private static calculateGlobalAnalytics(
        data: SuperEnhancedBookmarkNode[],
        indexes: ReturnType<typeof SuperBookmarkDataProcessor.buildAllIndexes>
    ) {
        let totalBookmarks = 0
        let totalFolders = 0
        let maxDepth = 0
        let depthSum = 0
        let nodeCount = 0

        const creationTimeline = new Map<string, number>()
        const categoryDistribution = new Map<string, number>()

        const traverse = (nodes: SuperEnhancedBookmarkNode[]) => {
            nodes.forEach(node => {
                nodeCount++
                depthSum += node.depth
                maxDepth = Math.max(maxDepth, node.depth)

                if (node.url) {
                    totalBookmarks++

                    // 创建时间分布统计
                    const timeKey = `${node.createdYear}-${node.createdMonth.toString().padStart(2, '0')}`
                    creationTimeline.set(timeKey, (creationTimeline.get(timeKey) || 0) + 1)

                    // 分类分布统计
                    if (node.domainCategory) {
                        categoryDistribution.set(node.domainCategory,
                            (categoryDistribution.get(node.domainCategory) || 0) + 1)
                    }
                } else {
                    totalFolders++
                }

                if (node.children) {
                    traverse(node.children)
                }
            })
        }

        traverse(data)

        // 计算Top域名
        const topDomains = Array.from(indexes.nodesByDomain.entries())
            .map(([domain, nodes]) => ({ domain, count: nodes.length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20) // Top 20

        // 估算内存使用量
        const estimatedBytes = this.estimateMemoryUsage(data, indexes)

        return {
            totalBookmarks,
            totalFolders,
            maxDepth,
            avgDepth: nodeCount > 0 ? Math.round(depthSum / nodeCount) : 0,
            topDomains,
            creationTimeline,
            categoryDistribution,
            memoryUsage: {
                nodeCount,
                indexCount: indexes.nodeById.size,
                estimatedBytes
            }
        }
    }

    // === 辅助方法 ===

    /**
     * 计算子树统计信息
     */
    private static calculateTreeStats(nodes: SuperEnhancedBookmarkNode[]) {
        return nodes.reduce((acc, node) => ({
            bookmarkCount: acc.bookmarkCount + node.bookmarkCount,
            folderCount: acc.folderCount + node.folderCount,
            totalCount: acc.totalCount + node.totalCount,
            maxSubDepth: Math.max(acc.maxSubDepth, node.maxSubDepth)
        }), { bookmarkCount: 0, folderCount: 0, totalCount: 0, maxSubDepth: 0 })
    }

    /**
     * 提取域名
     */
    private static extractDomain(url: string): string {
        try {
            return new URL(url).hostname.toLowerCase()
        } catch {
            return 'invalid-url'
        }
    }

    /**
     * 标准化标题（去除特殊字符，转小写）
     */
    private static normalizeTitle(title: string): string {
        return title.toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 保留中文字符
            .replace(/\s+/g, ' ')
            .trim()
    }

    /**
     * 提取搜索关键词
     */
    private static extractKeywords(
        title: string,
        config: ProcessorOptions['searchIndex']
    ): string[] {
        const words = title.toLowerCase()
            .split(/[\s\-_.,;:!?]+/)
            .filter(word => word.length >= config.minKeywordLength)
            .slice(0, config.maxKeywords)

        return [...new Set(words)] // 去重
    }

    /**
     * 标题分词
     */
    private static tokenizeTitle(title: string): string[] {
        // 简单的分词逻辑，可以后续增强
        return title.toLowerCase()
            .split(/[\s\-_.,;:!?()\[\]{}]+/)
            .filter(word => word.length > 0)
    }

    /**
     * 域名分类
     */
    private static categorizeDomain(url: string): string {
        const domain = this.extractDomain(url)

        // 开发相关
        if (['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'npm.js.org'].includes(domain)) {
            return DomainCategory.Development
        }

        // 文档相关
        if (['docs.google.com', 'developer.mozilla.org', 'docs.microsoft.com', 'devdocs.io'].includes(domain)) {
            return DomainCategory.Documentation
        }

        // 社交媒体
        if (['twitter.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'weibo.com'].includes(domain)) {
            return DomainCategory.Social
        }

        // 娱乐媒体
        if (['youtube.com', 'netflix.com', 'bilibili.com', 'twitch.tv', 'spotify.com'].includes(domain)) {
            return DomainCategory.Entertainment
        }

        // 购物
        if (['amazon.com', 'taobao.com', 'tmall.com', 'jd.com', 'ebay.com'].includes(domain)) {
            return DomainCategory.Shopping
        }

        // 新闻
        if (['cnn.com', 'bbc.com', 'reuters.com', 'xinhuanet.com', 'people.com.cn'].includes(domain)) {
            return DomainCategory.News
        }

        // 教育
        if (['coursera.org', 'edx.org', 'udemy.com', 'khanacademy.org', 'mit.edu'].includes(domain)) {
            return DomainCategory.Education
        }

        // 工具
        if (['figma.com', 'notion.so', 'trello.com', 'slack.com', 'zoom.us'].includes(domain)) {
            return DomainCategory.Tool
        }

        // 搜索引擎
        if (['google.com', 'bing.com', 'baidu.com', 'duckduckgo.com', 'yahoo.com'].includes(domain)) {
            return DomainCategory.Search
        }

        return DomainCategory.Other
    }

    /**
     * 生成排序键
     */
    private static generateSortKey(title: string, isBookmark: boolean): string {
        // 文件夹排在前面，然后按标题排序
        const prefix = isBookmark ? '1' : '0'
        return prefix + title.toLowerCase()
    }

    /**
     * 验证URL格式
     */
    private static isValidUrl(url: string): boolean {
        try {
            new URL(url)
            return true
        } catch {
            return false
        }
    }

    /**
     * 生成数据哈希值
     */
    private static generateDataHash(data: chrome.bookmarks.BookmarkTreeNode[]): string {
        const str = JSON.stringify(data, ['id', 'title', 'url', 'dateAdded'])
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = (hash << 5) - hash + char
            hash = hash & hash // 转为32位整数
        }
        return Math.abs(hash).toString(36)
    }

    /**
     * 计算节点数量
     */
    private static countNodes(nodes: chrome.bookmarks.BookmarkTreeNode[]): number {
        return nodes.reduce((count, node) => {
            return count + 1 + (node.children ? this.countNodes(node.children) : 0)
        }, 0)
    }

    /**
     * 估算内存使用量
     */
    private static estimateMemoryUsage(
        data: SuperEnhancedBookmarkNode[],
        indexes?: any
    ): number {
        // 粗略估算：每个节点平均300字节，索引占用额外50%
        const nodeCount = this.countEnhancedNodes(data)
        const baseMemory = nodeCount * 300
        const indexMemory = indexes ? Math.round(baseMemory * 0.5) : 0
        return baseMemory + indexMemory
    }

    private static countEnhancedNodes(nodes: SuperEnhancedBookmarkNode[]): number {
        return nodes.reduce((count, node) => {
            return count + 1 + (node.children ? this.countEnhancedNodes(node.children) : 0)
        }, 0)
    }

    // === 缓存管理方法 ===

    /**
     * 从存储读取缓存
     */
    private static async getCachedFromStorage(): Promise<SuperBookmarkCache | null> {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY)
            return result[this.STORAGE_KEY] || null
        } catch (error) {
            console.warn('从存储读取缓存失败:', error)
            return null
        }
    }

    /**
     * 保存缓存到存储
     */
    private static async saveCacheToStorage(cache: SuperBookmarkCache): Promise<void> {
        try {
            // 由于Chrome存储限制，可能需要分块存储大型缓存
            await chrome.storage.local.set({ [this.STORAGE_KEY]: cache })
        } catch (error) {
            console.warn('保存缓存到存储失败:', error)
            // 可以实现降级策略，比如只保存核心数据
        }
    }

    /**
     * 清理缓存
     */
    static async clearCache(): Promise<void> {
        this.memoryCache = null
        try {
            await chrome.storage.local.remove(this.STORAGE_KEY)
            console.log('✅ 缓存已清理')
        } catch (error) {
            console.warn('清理缓存失败:', error)
        }
    }

    /**
     * 获取缓存状态
     */
    static getCacheStatus(): CacheStatus {
        if (!this.memoryCache) return CacheStatus.MISSING

        const age = Date.now() - this.memoryCache.metadata.processedAt
        const timeout = DEFAULT_PROCESSOR_OPTIONS.cacheTimeout

        if (age > timeout * 2) return CacheStatus.INVALID
        if (age > timeout) return CacheStatus.STALE
        return CacheStatus.FRESH
    }
}
