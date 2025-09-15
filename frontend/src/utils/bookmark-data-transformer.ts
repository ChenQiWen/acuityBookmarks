/**
 * 书签数据转换器
 * 将Chrome书签API数据转换为IndexedDB优化格式
 * 替代SuperBookmarkDataProcessor，移除缓存层
 */

import { IndexedDBCore, type BookmarkRecord, type GlobalStats } from './indexeddb-core'

export interface TransformOptions {
    includeKeywords?: boolean
    generatePath?: boolean
    extractDomain?: boolean
    calculateStats?: boolean
}

export interface TransformResult {
    bookmarks: BookmarkRecord[]
    stats: GlobalStats
    transformTime: number
    bookmarkCount: number
    folderCount: number
}

/**
 * 书签数据转换器
 * 直接将Chrome数据转为IndexedDB格式，无缓存
 */
export class BookmarkDataTransformer {
    private static readonly VERSION = '3.0.0'
    private db: IndexedDBCore

    constructor() {
        this.db = IndexedDBCore.getInstance()
    }

    /**
     * 主要转换方法：Chrome数据 → IndexedDB格式
     */
    async transformChromeBookmarks(
        chromeData: chrome.bookmarks.BookmarkTreeNode[],
        options: TransformOptions = {}
    ): Promise<TransformResult> {
        const startTime = performance.now()
        console.log('🔄 开始书签数据转换...')

        const opts: Required<TransformOptions> = {
            includeKeywords: true,
            generatePath: true,
            extractDomain: true,
            calculateStats: true,
            ...options
        }

        // 转换数据结构
        const transformedBookmarks: BookmarkRecord[] = []
        let bookmarkCount = 0
        let folderCount = 0
        let maxDepth = 0
        const domains = new Set<string>()

        // 递归转换所有节点
        const processNode = (
            node: chrome.bookmarks.BookmarkTreeNode,
            parentPath: string[] = [],
            parentPathIds: string[] = [],
            depth: number = 0
        ) => {
            maxDepth = Math.max(maxDepth, depth)

            // 构建当前路径
            const currentPath = [...parentPath, node.title]
            const currentPathIds = [...parentPathIds, node.id]

            // 提取域名
            let domain: string | undefined
            if (node.url) {
                try {
                    domain = new URL(node.url).hostname.toLowerCase()
                    domains.add(domain)
                } catch {
                    // 忽略无效URL
                }
            }

            // 生成关键词
            const keywords: string[] = []
            if (opts.includeKeywords) {
                // 从标题提取关键词
                const titleWords = node.title.toLowerCase().split(/\W+/).filter(w => w.length > 2)
                keywords.push(...titleWords)

                // 从URL提取关键词
                if (node.url) {
                    const urlWords = node.url.toLowerCase().split(/\W+/).filter(w => w.length > 2)
                    keywords.push(...urlWords.slice(0, 5)) // 限制URL关键词数量
                }

                // 从域名提取关键词
                if (domain) {
                    const domainParts = domain.split('.')
                    keywords.push(...domainParts.filter(p => p.length > 2))
                }
            }

            // 计算子节点数量
            const isFolder = !!node.children
            const childrenCount = isFolder ? node.children!.length : 0

            // 创建BookmarkRecord
            const bookmarkRecord: BookmarkRecord = {
                id: node.id,
                parentId: node.parentId,
                title: node.title,
                url: node.url,
                dateAdded: node.dateAdded,
                dateGroupModified: node.dateGroupModified,

                // 索引和路径
                index: node.index || 0,
                path: currentPath,
                pathString: currentPath.join(' / '),
                pathIds: currentPathIds,
                pathIdsString: currentPathIds.join(' / '),
                ancestorIds: parentPathIds.slice(), // 不包含自身
                siblingIds: [], // 后续填充
                depth,

                // 搜索优化
                titleLower: node.title.toLowerCase(),
                urlLower: node.url?.toLowerCase(),
                domain,
                keywords: [...new Set(keywords)], // 去重

                // 类型标识
                isFolder,
                childrenCount,
                bookmarksCount: 0, // 后续计算

                // 扩展属性
                tags: [],
                category: this.inferCategory(node.title, node.url, domain),
                notes: '',
                lastVisited: undefined,
                visitCount: 0
            }

            transformedBookmarks.push(bookmarkRecord)

            // 统计计数
            if (isFolder) {
                folderCount++
            } else {
                bookmarkCount++
            }

            // 递归处理子节点
            if (node.children) {
                node.children.forEach((child, index) => {
                    child.index = index // 确保有索引
                    processNode(child, currentPath, currentPathIds, depth + 1)
                })
            }
        }

        // 处理根节点
        chromeData.forEach((rootNode, index) => {
            rootNode.index = index
            processNode(rootNode)
        })

        // 后处理：填充兄弟节点信息和书签计数
        this.postProcessBookmarks(transformedBookmarks)

        const transformTime = performance.now() - startTime

        const stats: GlobalStats = {
            totalBookmarks: bookmarkCount,
            totalFolders: folderCount,
            totalDomains: domains.size,
            maxDepth,
            lastUpdated: Date.now(),
            version: BookmarkDataTransformer.VERSION
        }

        console.log(`✅ 数据转换完成，耗时: ${transformTime.toFixed(2)}ms`)
        console.log(`📊 转换结果: ${bookmarkCount}个书签, ${folderCount}个文件夹, ${domains.size}个域名`)

        return {
            bookmarks: transformedBookmarks,
            stats,
            transformTime,
            bookmarkCount,
            folderCount
        }
    }

    /**
     * 后处理：填充兄弟节点信息和统计信息
     */
    private postProcessBookmarks(bookmarks: BookmarkRecord[]): void {
        // 创建父子关系映射
        const childrenByParent = new Map<string, BookmarkRecord[]>()

        bookmarks.forEach(bookmark => {
            if (bookmark.parentId) {
                if (!childrenByParent.has(bookmark.parentId)) {
                    childrenByParent.set(bookmark.parentId, [])
                }
                childrenByParent.get(bookmark.parentId)!.push(bookmark)
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

        // 计算每个文件夹的书签数量（递归）
        const calculateBookmarkCount = (parentId: string): number => {
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

        // 更新文件夹的书签计数
        bookmarks.forEach(bookmark => {
            if (bookmark.isFolder) {
                bookmark.bookmarksCount = calculateBookmarkCount(bookmark.id)
            }
        })
    }

    /**
     * 推断书签类别
     */
    private inferCategory(title: string, url?: string, domain?: string): string | undefined {
        if (!url) return undefined

        const titleLower = title.toLowerCase()

        // 开发工具
        if (/github|gitlab|stackoverflow|codepen|jsfiddle/i.test(domain || '')) {
            return 'development'
        }

        // 社交媒体
        if (/twitter|facebook|instagram|linkedin|reddit/i.test(domain || '')) {
            return 'social'
        }

        // 新闻
        if (/news|bbc|cnn|reddit|hackernews/i.test(domain || '')) {
            return 'news'
        }

        // 学习
        if (/learn|course|tutorial|doc|guide/i.test(titleLower)) {
            return 'education'
        }

        // 工具
        if (/tool|util|app/i.test(titleLower)) {
            return 'tools'
        }

        // 购物
        if (/amazon|shop|buy|store/i.test(domain || '')) {
            return 'shopping'
        }

        return undefined
    }

    /**
     * 将转换后的数据保存到IndexedDB
     */
    async saveToIndexedDB(transformResult: TransformResult): Promise<void> {
        console.log('💾 开始保存数据到IndexedDB...')
        const startTime = performance.now()

        try {
            // 1. 清空现有数据
            await this.db.clearAllBookmarks()

            // 2. 批量插入书签
            await this.db.insertBookmarks(transformResult.bookmarks)

            // 3. 更新全局统计
            await this.db.updateGlobalStats(transformResult.stats)

            const saveTime = performance.now() - startTime
            console.log(`✅ 数据保存完成，耗时: ${saveTime.toFixed(2)}ms`)

        } catch (error) {
            console.error('❌ 保存数据失败:', error)
            throw error
        }
    }

    /**
     * 完整的数据处理流程：Chrome API → 转换 → IndexedDB
     */
    async processAndSave(chromeData: chrome.bookmarks.BookmarkTreeNode[]): Promise<TransformResult> {
        const transformResult = await this.transformChromeBookmarks(chromeData)
        await this.saveToIndexedDB(transformResult)
        return transformResult
    }

    /**
     * 从Chrome API获取数据并处理
     */
    async loadFromChromeAndProcess(): Promise<TransformResult> {
        console.log('🚀 通过IndexedDB Service Worker加载书签数据...')

        try {
            // 触发Service Worker从Chrome加载和处理数据
            const response = await chrome.runtime.sendMessage({ type: 'LOAD_BOOKMARKS' })

            if (response?.success) {
                // 获取处理后的数据
                const bookmarksResponse = await chrome.runtime.sendMessage({ type: 'GET_ALL_BOOKMARKS' })
                const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_GLOBAL_STATS' })

                if (bookmarksResponse?.success && statsResponse?.success) {
                    return {
                        bookmarks: bookmarksResponse.data || [],
                        stats: statsResponse.data || {
                            totalBookmarks: 0,
                            totalFolders: 0,
                            maxDepth: 0,
                            lastUpdated: Date.now(),
                            version: BookmarkDataTransformer.VERSION
                        },
                        transformTime: 0,
                        bookmarkCount: bookmarksResponse.data?.length || 0,
                        folderCount: statsResponse.data?.totalFolders || 0
                    }
                }
            }

            throw new Error('Service Worker书签数据加载失败')
        } catch (error) {
            console.error('❌ IndexedDB书签数据加载失败:', error)
            throw error
        }
    }

    /**
     * 增量更新：检查Chrome数据变化并同步
     */
    async syncWithChrome(): Promise<{
        changed: boolean
        result?: TransformResult
    }> {
        console.log('🚀 通过IndexedDB Service Worker同步书签变化...')

        try {
            // 触发Service Worker进行同步检查
            const response = await chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' })

            if (response?.success) {
                if (response.changed) {
                    // 获取同步后的数据
                    const bookmarksResponse = await chrome.runtime.sendMessage({ type: 'GET_ALL_BOOKMARKS' })
                    const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_GLOBAL_STATS' })

                    if (bookmarksResponse?.success && statsResponse?.success) {
                        console.log('📊 IndexedDB同步完成，数据已更新')
                        return {
                            changed: true,
                            result: {
                                bookmarks: bookmarksResponse.data || [],
                                stats: statsResponse.data || {
                                    totalBookmarks: 0,
                                    totalFolders: 0,
                                    maxDepth: 0,
                                    lastUpdated: Date.now(),
                                    version: BookmarkDataTransformer.VERSION
                                },
                                transformTime: 0,
                                bookmarkCount: bookmarksResponse.data?.length || 0,
                                folderCount: statsResponse.data?.totalFolders || 0
                            }
                        }
                    }
                } else {
                    console.log('✅ IndexedDB书签数据无变化')
                    return { changed: false }
                }
            }

            throw new Error('Service Worker同步检查失败')
        } catch (error) {
            console.error('❌ IndexedDB书签同步失败:', error)
            throw error
        }
    }

    // generateDataFingerprint 函数已被IndexedDB Service Worker替代，已移除
}
