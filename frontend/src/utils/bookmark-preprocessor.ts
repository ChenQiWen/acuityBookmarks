/**
 * 书签数据预处理器
 * 核心功能：一次性彻底的数据递归加工
 * 
 * 负责将Chrome原始书签数据转换为增强的BookmarkRecord格式
 * 包含所有后续可能用到的计算结果，避免页面重复递归计算
 * 
 * 预处理内容：
 * - 层级关系计算（路径、深度、祖先等）
 * - 搜索关键词提取
 * - 统计信息计算
 * - 域名分析
 * - 虚拟化支持数据
 */

import {
    type BookmarkRecord,
    type GlobalStats,
    type TransformResult,
    type DomainStat,
    CURRENT_DATA_VERSION
} from './indexeddb-schema'
import { logger } from './logger'

/**
 * Chrome原始书签节点接口
 */
interface ChromeBookmarkNode {
    id: string
    parentId?: string
    title: string
    url?: string
    dateAdded?: number
    dateGroupModified?: number
    index?: number
    children?: ChromeBookmarkNode[]
}

/**
 * 预处理选项
 */
interface PreprocessOptions {
    enableVirtualization?: boolean  // 启用虚拟化支持
    enableAnalytics?: boolean      // 启用分析功能
    enableSearchIndex?: boolean    // 启用搜索索引
    maxKeywordsPerBookmark?: number // 每个书签最大关键词数
    includeEmptyFolders?: boolean  // 包含空文件夹
}

/**
 * 书签数据预处理器类
 */
export class BookmarkPreprocessor {
    private static instance: BookmarkPreprocessor | null = null
    private readonly domainRegex = /^https?:\/\/([^/]+)/

    private constructor() { }

    /**
     * 单例模式获取实例
     */
    static getInstance(): BookmarkPreprocessor {
        if (!BookmarkPreprocessor.instance) {
            BookmarkPreprocessor.instance = new BookmarkPreprocessor()
        }
        return BookmarkPreprocessor.instance
    }

    /**
     * 从Chrome API获取并预处理书签数据
     */
    async processBookmarks(options: PreprocessOptions = {}): Promise<TransformResult> {
        logger.info('🚀 [预处理器] 开始处理书签数据...')
        const startTime = performance.now()

        // 设置默认选项
        const opts: Required<PreprocessOptions> = {
            enableVirtualization: true,
            enableAnalytics: true,
            enableSearchIndex: true,
            maxKeywordsPerBookmark: 10,
            includeEmptyFolders: true,
            ...options
        }

        try {
            // 1. 从Chrome API获取原始数据
        logger.info('📥 [预处理器] 从Chrome API获取书签...')
            const chromeTree = await this._getChromeBookmarks()
            const originalDataHash = this._generateDataHash(chromeTree)

            // 2. 扁平化处理
        logger.info('🔄 [预处理器] 扁平化处理...')
            const flatBookmarks = this._flattenBookmarks(chromeTree)
        logger.info(`📊 [预处理器] 扁平化完成: ${flatBookmarks.length} 个节点`)

            // 3. 增强处理
        logger.info('⚡ [预处理器] 增强处理...')
            const enhancedBookmarks = await this._enhanceBookmarks(flatBookmarks, opts)

            // 4. 生成统计信息
        logger.info('📈 [预处理器] 生成统计信息...')
            const stats = this._generateStats(enhancedBookmarks)

            // 5. 虚拟化处理
            if (opts.enableVirtualization) {
        logger.info('🎯 [预处理器] 虚拟化处理...')
                this._addVirtualizationData(enhancedBookmarks)
            }

            const endTime = performance.now()
            const processingTime = endTime - startTime

        logger.info(`✅ [预处理器] 处理完成: ${enhancedBookmarks.length} 条记录, 耗时: ${processingTime.toFixed(2)}ms`)

            return {
                bookmarks: enhancedBookmarks,
                stats,
                metadata: {
                    originalDataHash,
                    processedAt: Date.now(),
                    version: CURRENT_DATA_VERSION,
                    processingTime,
                    cacheHitRate: 0,
                    indexBuildTime: 0,
                    performance: {
                        transformTime: processingTime * 0.4,
                        indexTime: processingTime * 0.2,
                        cleanupTime: processingTime * 0.1,
                        searchTime: processingTime * 0.1,
                        virtualTime: processingTime * 0.1,
                        analyticsTime: processingTime * 0.1
                    }
                }
            }

        } catch (error) {
        logger.error('❌ [预处理器] 处理失败:', error)
            throw new Error(`书签预处理失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 从Chrome API获取书签树
     */
    private async _getChromeBookmarks(): Promise<ChromeBookmarkNode[]> {
        try {
            if (!chrome?.bookmarks?.getTree) {
                throw new Error('Chrome Bookmarks API 不可用')
            }

            // ✅ 现代化：使用Promise API替代回调风格
            const tree = await chrome.bookmarks.getTree()
            return tree || []
        } catch (error) {
        logger.error('❌ 获取Chrome书签树失败:', error)
            throw new Error(`获取书签树失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 扁平化书签树
     */
    private _flattenBookmarks(tree: ChromeBookmarkNode[], parentPath: string[] = [], parentIds: string[] = []): ChromeBookmarkNode[] {
        const flattened: ChromeBookmarkNode[] = []

        // 使用显式栈避免深层递归导致的栈溢出，并加入循环防护
        const stack: Array<{ node: ChromeBookmarkNode; path: string[]; ids: string[] }> = []
        const visited = new Set<string>()

        // 初始化栈（保持与递归一致的先序遍历输出顺序）
        for (let i = tree.length - 1; i >= 0; i--) {
            stack.push({ node: tree[i], path: parentPath, ids: parentIds })
        }

        while (stack.length > 0) {
            const { node, path, ids } = stack.pop()!

            // 跳过根节点但处理其子节点
            if (node.id === '0') {
                const children = node.children || []
                for (let i = children.length - 1; i >= 0; i--) {
                    stack.push({ node: children[i], path: [], ids: [] })
                }
                continue
            }

            if (visited.has(node.id)) {
                continue
            }
            visited.add(node.id)

            // 添加当前节点
            flattened.push({
                ...node,
                ['_parentPath']: path,
                ['_parentIds']: ids
            } as any)

            // 处理子节点（逆序入栈以保持与递归相同的遍历顺序）
            if (node.children && node.children.length > 0) {
                const childPath = [...path, node.title]
                const childIds = [...ids, node.id]
                for (let i = node.children.length - 1; i >= 0; i--) {
                    stack.push({ node: node.children[i], path: childPath, ids: childIds })
                }
            }
        }

        return flattened
    }

    /**
     * 增强书签数据
     */
    private async _enhanceBookmarks(
        flatBookmarks: ChromeBookmarkNode[],
        options: Required<PreprocessOptions>
    ): Promise<BookmarkRecord[]> {
        const enhanced: BookmarkRecord[] = []
        const processed = new Map<string, BookmarkRecord>()

        // 建立父子关系映射
        const childrenMap = new Map<string, ChromeBookmarkNode[]>()
        for (const bookmark of flatBookmarks) {
            if (bookmark.parentId) {
                if (!childrenMap.has(bookmark.parentId)) {
                    childrenMap.set(bookmark.parentId, [])
                }
                childrenMap.get(bookmark.parentId)!.push(bookmark)
            }
        }

        for (let i = 0; i < flatBookmarks.length; i++) {
            const node = flatBookmarks[i]

            // 显示进度
            if (i % 100 === 0) {
        logger.info(`📊 [预处理器] 增强进度: ${i}/${flatBookmarks.length}`)
            }

            const enhanced_record = this._enhanceSingleBookmark(node, childrenMap, options)
            enhanced.push(enhanced_record)
            processed.set(node.id, enhanced_record)
        }

        // 计算兄弟节点关系
        this._calculateSiblingRelations(enhanced)

        return enhanced
    }

    /**
     * 增强单个书签
     */
    private _enhanceSingleBookmark(
        node: ChromeBookmarkNode & { _parentPath?: string[]; _parentIds?: string[] },
        childrenMap: Map<string, ChromeBookmarkNode[]>,
        options: Required<PreprocessOptions>
    ): BookmarkRecord {
        const isFolder = !node.url
        const children = childrenMap.get(node.id) || []

        // 计算层级路径
        const parentPath = node._parentPath || []
        const parentIds = node._parentIds || []
        const path = [...parentPath, node.title]
        const pathIds = [...parentIds, node.id]

        // 计算域名
        let domain: string | undefined
        let urlLower: string | undefined
        if (node.url) {
            urlLower = node.url.toLowerCase()
            const domainMatch = node.url.match(this.domainRegex)
            if (domainMatch) {
                domain = domainMatch[1].toLowerCase()
            }
        }

        // 生成搜索关键词
        const keywords = this._generateKeywords(node.title, node.url, domain, options.maxKeywordsPerBookmark)

        // 计算统计信息
        const { bookmarksCount, folderCount, childrenCount } = this._calculateCounts(children, childrenMap)

        // 分析分类
        const category = this._analyzeCategory(node.title, node.url, domain)

        // 创建增强记录
        const enhanced: BookmarkRecord = {
            // Chrome原生字段
            id: node.id,
            parentId: node.parentId,
            title: node.title,
            url: node.url,
            dateAdded: node.dateAdded,
            dateGroupModified: node.dateGroupModified,
            index: node.index || 0,

            // 层级关系预处理字段
            path,
            pathString: path.join(' / '),
            pathIds,
            pathIdsString: pathIds.join(' / '),
            ancestorIds: parentIds,
            siblingIds: [], // 后续计算
            depth: pathIds.length,

            // 搜索优化字段
            titleLower: node.title.toLowerCase(),
            urlLower,
            domain,
            keywords,

            // 类型和统计字段
            isFolder,
            childrenCount,
            bookmarksCount,
            folderCount,

            // 扩展属性
            tags: [],
            category,
            notes: undefined,
            lastVisited: undefined,
            visitCount: 0,

            // 元数据
            createdYear: node.dateAdded ? new Date(node.dateAdded).getFullYear() : new Date().getFullYear(),
            createdMonth: node.dateAdded ? new Date(node.dateAdded).getMonth() + 1 : new Date().getMonth() + 1,
            domainCategory: domain ? this._categorizeDomain(domain) : undefined,

            // 虚拟化支持（后续填充）
            flatIndex: 0,
            isVisible: true,
            sortKey: `${String(node.index || 0).padStart(10, '0')}_${node.title}`,

            // 数据版本
            dataVersion: CURRENT_DATA_VERSION,
            lastCalculated: Date.now()
        }

        return enhanced
    }

    /**
     * 计算兄弟节点关系
     */
    private _calculateSiblingRelations(bookmarks: BookmarkRecord[]): void {
        logger.info('👥 [预处理器] 计算兄弟节点关系...')

        // 按父节点分组
        const siblingGroups = new Map<string, BookmarkRecord[]>()

        for (const bookmark of bookmarks) {
            const parentId = bookmark.parentId || 'root'
            if (!siblingGroups.has(parentId)) {
                siblingGroups.set(parentId, [])
            }
            siblingGroups.get(parentId)!.push(bookmark)
        }

        // 为每个书签设置兄弟节点ID
        for (const siblings of siblingGroups.values()) {
            for (const bookmark of siblings) {
                bookmark.siblingIds = siblings
                    .filter(sibling => sibling.id !== bookmark.id)
                    .map(sibling => sibling.id)
            }
        }
    }

    /**
     * 递归计算节点统计
     */
    private _calculateCounts(
        children: ChromeBookmarkNode[],
        childrenMap: Map<string, ChromeBookmarkNode[]>
    ): { bookmarksCount: number; folderCount: number; childrenCount: number } {
        let bookmarksCount = 0
        let folderCount = 0
        const childrenCount = children.length

        for (const child of children) {
            if (child.url) {
                // 是书签
                bookmarksCount++
            } else {
                // 是文件夹
                folderCount++

                // 递归计算子文件夹的统计
                const grandChildren = childrenMap.get(child.id) || []
                const subCounts = this._calculateCounts(grandChildren, childrenMap)
                bookmarksCount += subCounts.bookmarksCount
                folderCount += subCounts.folderCount
            }
        }

        return { bookmarksCount, folderCount, childrenCount }
    }

    /**
     * 生成搜索关键词
     */
    private _generateKeywords(title: string, url?: string, domain?: string, maxKeywords = 10): string[] {
        const keywords = new Set<string>()

        // 从标题提取关键词
        const titleWords = title
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中文、英文、数字
            .split(/\s+/)
            .filter(word => word.length >= 2)

        titleWords.forEach(word => keywords.add(word))

        // 从URL提取关键词
        if (url) {
            const urlKeywords = url
                .toLowerCase()
                .replace(/https?:\/\//, '')
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length >= 2)

            urlKeywords.slice(0, 3).forEach(word => keywords.add(word))
        }

        // 添加域名作为关键词
        if (domain) {
            keywords.add(domain)

            // 提取域名主体部分
            const domainParts = domain.split('.')
            if (domainParts.length >= 2) {
                keywords.add(domainParts[domainParts.length - 2])
            }
        }

        return Array.from(keywords).slice(0, maxKeywords)
    }

    /**
     * 分析书签分类
     */
    private _analyzeCategory(title: string, url?: string, _domain?: string): string | undefined {
        const titleLower = title.toLowerCase()
        const urlLower = url?.toLowerCase() || ''

        // 技术类
        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'github', 'stackoverflow', 'developer', 'api', 'documentation', 'code', 'programming',
            'react', 'vue', 'angular', 'javascript', 'typescript', 'python', 'java', 'css', 'html'
        ])) {
            return 'technology'
        }

        // 新闻类
        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'news', 'article', 'blog', 'medium', 'zhihu', 'juejin', '新闻', '文章', '博客'
        ])) {
            return 'news'
        }

        // 工具类
        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'tool', 'utility', 'service', 'app', 'software', '工具', '应用', '服务'
        ])) {
            return 'tools'
        }

        // 购物类
        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'shop', 'store', 'buy', 'amazon', 'taobao', 'jd', '购物', '商店', '淘宝', '京东'
        ])) {
            return 'shopping'
        }

        // 学习类
        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'learn', 'course', 'tutorial', 'education', 'university', '学习', '课程', '教程', '教育'
        ])) {
            return 'education'
        }

        return undefined
    }

    /**
     * 关键词匹配辅助函数
     */
    private _matchesKeywords(text: string, keywords: string[]): boolean {
        return keywords.some(keyword => text.includes(keyword))
    }

    /**
     * 域名分类
     */
    private _categorizeDomain(domain: string): string {
        // 社交媒体
        if (['twitter.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'weibo.com'].includes(domain)) {
            return 'social'
        }

        // 技术平台
        if (['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com'].includes(domain)) {
            return 'tech'
        }

        // 新闻媒体
        if (['bbc.com', 'cnn.com', 'nytimes.com', 'reuters.com', 'xinhuanet.com'].includes(domain)) {
            return 'news'
        }

        // 搜索引擎
        if (['google.com', 'bing.com', 'baidu.com', 'duckduckgo.com'].includes(domain)) {
            return 'search'
        }

        // 视频平台
        if (['youtube.com', 'bilibili.com', 'vimeo.com', 'youku.com'].includes(domain)) {
            return 'video'
        }

        return 'other'
    }

    /**
     * 添加虚拟化支持数据
     */
    private _addVirtualizationData(bookmarks: BookmarkRecord[]): void {
        logger.info('🎯 [预处理器] 添加虚拟化数据...')

        // 为虚拟列表添加扁平化索引
        bookmarks.forEach((bookmark, index) => {
            bookmark.flatIndex = index
            bookmark.sortKey = `${String(bookmark.index).padStart(10, '0')}_${bookmark.title}`
        })
    }

    /**
     * 生成全局统计信息
     */
    private _generateStats(bookmarks: BookmarkRecord[]): GlobalStats {
        logger.info('📈 [预处理器] 生成全局统计...')

        const folderBookmarks = bookmarks.filter(b => b.isFolder)
        const urlBookmarks = bookmarks.filter(b => !b.isFolder)

        // 域名统计
        const domainCounts = new Map<string, number>()
        urlBookmarks.forEach(bookmark => {
            if (bookmark.domain) {
                domainCounts.set(bookmark.domain, (domainCounts.get(bookmark.domain) || 0) + 1)
            }
        })

        const topDomains: DomainStat[] = Array.from(domainCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([domain, count]) => ({
                domain,
                count,
                percentage: Math.round((count / urlBookmarks.length) * 100 * 100) / 100
            }))

        // 时间分布统计
        const creationTimeline = new Map<string, number>()
        bookmarks.forEach(bookmark => {
            if (bookmark.dateAdded) {
                const date = new Date(bookmark.dateAdded)
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                creationTimeline.set(key, (creationTimeline.get(key) || 0) + 1)
            }
        })

        // 分类分布统计
        const categoryDistribution = new Map<string, number>()
        bookmarks.forEach(bookmark => {
            if (bookmark.category) {
                categoryDistribution.set(bookmark.category, (categoryDistribution.get(bookmark.category) || 0) + 1)
            }
        })

        // 重复URL统计
        const urlCounts = new Map<string, number>()
        urlBookmarks.forEach(bookmark => {
            if (bookmark.url) {
                urlCounts.set(bookmark.url, (urlCounts.get(bookmark.url) || 0) + 1)
            }
        })
        const duplicateUrls = Array.from(urlCounts.values()).filter(count => count > 1).length

        // 空文件夹统计
        const emptyFolders = folderBookmarks.filter(folder => folder.childrenCount === 0).length

        // 最大深度
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
            brokenLinks: 0, // TODO: 需要实际检测
            memoryUsage: {
                nodeCount: bookmarks.length,
                indexCount: 0, // TODO: 计算索引数量
                estimatedBytes: JSON.stringify(bookmarks).length
            },
            lastUpdated: Date.now(),
            version: CURRENT_DATA_VERSION
        }
    }

    /**
     * 生成数据指纹
     */
    private _generateDataHash(data: any): string {
        try {
            const simplified = this._simplifyDataForHash(data)
            const jsonString = JSON.stringify(simplified)

            if (!jsonString || jsonString === 'undefined' || jsonString === 'null' || jsonString === '[]') {
        logger.warn('⚠️ [预处理器] 数据为空或无效，使用默认哈希')
                return `empty_${Date.now()}`
            }

            return this._simpleHash(jsonString)
        } catch (error) {
        logger.error('❌ [预处理器] 生成数据哈希失败:', error)
            return `error_${Date.now()}`
        }
    }

    /**
     * 简化数据用于哈希计算
     */
    private _simplifyDataForHash(data: any): any {
        if (!data) return null

        if (Array.isArray(data)) {
            return data.map(item => this._simplifyDataForHash(item))
        }

        if (typeof data === 'object') {
            const simplified: any = {}
            for (const [key, value] of Object.entries(data)) {
                if (['id', 'title', 'url', 'parentId', 'dateAdded'].includes(key)) {
                    simplified[key] = value
                }
            }
            return simplified
        }

        return data
    }

    /**
     * 简单哈希函数
     */
    private _simpleHash(str: string): string {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // 转换为32位整数
        }
        return Math.abs(hash).toString(36)
    }
}

// 导出单例实例
export const bookmarkPreprocessor = BookmarkPreprocessor.getInstance()
