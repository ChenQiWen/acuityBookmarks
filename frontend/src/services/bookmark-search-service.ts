/**
 * 统一书签本地搜索服务
 * 
 * 功能特性：
 * - 多种搜索策略（快速索引搜索、精确评分搜索、内存搜索）
 * - 智能匹配算法（标题、URL、域名、标签、关键词）
 * - 相关性评分系统
 * - 搜索结果高亮
 * - 性能优化
 */

import { IndexedDBManager } from '../utils/indexeddb-manager'
import {
    type SearchOptions,
    type SearchResult
} from '../utils/indexeddb-schema'
import { IndexedDBStorageAdapter } from '../utils/indexeddb-storage-adapter'
import { type SuperEnhancedBookmarkNode } from '../types/enhanced-bookmark'

/**
 * 搜索模式
 */
export type SearchMode = 'fast' | 'accurate' | 'memory'

/**
 * 搜索字段
 */
export type SearchField = 'title' | 'url' | 'domain' | 'keywords' | 'tags' | 'path'

/**
 * 本地搜索选项
 */
export interface LocalSearchOptions {
    /** 搜索模式 */
    mode?: SearchMode
    /** 搜索字段 */
    fields?: SearchField[]
    /** 结果数量限制 */
    limit?: number
    /** 最低匹配分数 */
    minScore?: number
    /** 排序方式 */
    sortBy?: 'relevance' | 'title' | 'date' | 'url'
    /** 是否启用高亮 */
    enableHighlight?: boolean
    /** 是否去重 */
    deduplicate?: boolean
}

/**
 * 标准化搜索结果
 */
export interface StandardSearchResult {
    /** 书签ID */
    id: string
    /** 书签标题 */
    title: string
    /** 书签URL */
    url: string
    /** 网站域名 */
    domain?: string
    /** 文件夹路径 */
    path?: string[]
    /** 匹配分数 */
    score: number
    /** 匹配字段 */
    matchedFields: string[]
    /** 高亮信息 */
    highlights?: Record<string, string[]>
    /** 是否为文件夹 */
    isFolder: boolean
    /** 添加时间 */
    dateAdded?: number
    /** 标签 */
    tags?: string[]
    /** 关键词 */
    keywords?: string[]
}

/**
 * 搜索统计信息
 */
export interface SearchStats {
    /** 查询关键词 */
    query: string
    /** 搜索模式 */
    mode: SearchMode
    /** 搜索耗时 (ms) */
    duration: number
    /** 结果总数 */
    totalResults: number
    /** 返回结果数 */
    returnedResults: number
    /** 最高分数 */
    maxScore: number
    /** 平均分数 */
    avgScore: number
}

/**
 * 统一书签搜索服务
 */
export class BookmarkSearchService {
    private static instance: BookmarkSearchService | null = null
    private indexedDBManager: IndexedDBManager | null = null
    private storageAdapter: IndexedDBStorageAdapter | null = null
    private isInitialized = false

    // 搜索缓存
    private searchCache = new Map<string, StandardSearchResult[]>()
    private maxCacheSize = 100

    private constructor() { }

    /**
     * 获取单例实例
     */
    static getInstance(): BookmarkSearchService {
        if (!BookmarkSearchService.instance) {
            BookmarkSearchService.instance = new BookmarkSearchService()
        }
        return BookmarkSearchService.instance
    }

    /**
     * 初始化搜索服务
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return

        try {
            console.log('🚀 [搜索服务] 初始化开始...')

            // 初始化底层存储
            this.indexedDBManager = IndexedDBManager.getInstance()
            this.storageAdapter = new IndexedDBStorageAdapter()

            await this.indexedDBManager.initialize()
            await this.storageAdapter.initialize()

            this.isInitialized = true
            console.log('✅ [搜索服务] 初始化完成')
        } catch (error) {
            console.error('❌ [搜索服务] 初始化失败:', error)
            throw error
        }
    }

    /**
     * 统一搜索接口
     */
    async search(
        query: string,
        options: LocalSearchOptions = {}
    ): Promise<{
        results: StandardSearchResult[]
        stats: SearchStats
    }> {
        const startTime = performance.now()

        // 确保初始化
        await this.initialize()

        // 标准化查询
        const normalizedQuery = this._normalizeQuery(query)
        if (!normalizedQuery) {
            return {
                results: [],
                stats: this._createSearchStats(query, options.mode || 'fast', 0, 0, 0, 0, 0)
            }
        }

        // 检查缓存
        const cacheKey = this._getCacheKey(normalizedQuery, options)
        if (this.searchCache.has(cacheKey)) {
            const cachedResults = this.searchCache.get(cacheKey)!
            const endTime = performance.now()
            console.log(`🚀 [搜索服务] 缓存命中: ${cachedResults.length}条结果`)

            return {
                results: cachedResults.slice(0, options.limit || 50),
                stats: this._createSearchStats(
                    query,
                    options.mode || 'fast',
                    endTime - startTime,
                    cachedResults.length,
                    Math.min(cachedResults.length, options.limit || 50),
                    cachedResults.length > 0 ? Math.max(...cachedResults.map(r => r.score)) : 0,
                    cachedResults.length > 0 ? cachedResults.reduce((sum, r) => sum + r.score, 0) / cachedResults.length : 0
                )
            }
        }

        // 根据搜索模式选择搜索策略
        let results: StandardSearchResult[]
        const mode = options.mode || 'fast'

        switch (mode) {
            case 'fast':
                results = await this._fastSearch(normalizedQuery, options)
                break
            case 'accurate':
                results = await this._accurateSearch(normalizedQuery, options)
                break
            case 'memory':
                results = await this._memorySearch(normalizedQuery, options)
                break
            default:
                results = await this._fastSearch(normalizedQuery, options)
        }

        // 后处理
        results = this._postProcessResults(results, options)

        // 更新缓存
        this._updateCache(cacheKey, results)

        const endTime = performance.now()
        const duration = endTime - startTime

        const stats = this._createSearchStats(
            query,
            mode,
            duration,
            results.length,
            Math.min(results.length, options.limit || 50),
            results.length > 0 ? Math.max(...results.map(r => r.score)) : 0,
            results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0
        )

        console.log(`🔍 [搜索服务] 搜索完成:`, stats)

        return {
            results: results.slice(0, options.limit || 50),
            stats
        }
    }

    /**
     * 快速搜索（基于索引）
     */
    private async _fastSearch(
        query: string,
        options: LocalSearchOptions
    ): Promise<StandardSearchResult[]> {
        if (!this.storageAdapter) throw new Error('搜索服务未初始化')

        const result = await this.storageAdapter.searchBookmarks(query, options.limit || 50)
        return this._convertStorageResults(result.data, query, options)
    }

    /**
     * 精确搜索（基于评分）
     */
    private async _accurateSearch(
        query: string,
        options: LocalSearchOptions
    ): Promise<StandardSearchResult[]> {
        if (!this.indexedDBManager) throw new Error('搜索服务未初始化')

        const searchOptions: SearchOptions = {
            limit: options.limit || 50,
            sortBy: 'relevance',
            minScore: options.minScore || 0,
            includeUrl: options.fields?.includes('url') !== false,
            includeDomain: options.fields?.includes('domain') !== false,
            includeKeywords: options.fields?.includes('keywords') !== false,
            includeTags: options.fields?.includes('tags') !== false
        }

        const results = await this.indexedDBManager.searchBookmarks(query, searchOptions)
        return this._convertManagerResults(results, options)
    }

    /**
     * 内存搜索（实时搜索）
     */
    private async _memorySearch(
        query: string,
        options: LocalSearchOptions
    ): Promise<StandardSearchResult[]> {
        // 这里可以实现基于内存的搜索，类似 SidePanel 的实现
        // 暂时使用快速搜索替代
        return this._fastSearch(query, options)
    }

    /**
     * 转换存储适配器结果
     */
    private _convertStorageResults(
        results: SuperEnhancedBookmarkNode[],
        query: string,
        options: LocalSearchOptions
    ): StandardSearchResult[] {
        const searchTerms = query.toLowerCase().split(/\s+/)

        return results.map((bookmark, index) => {
            // 计算简单评分
            let score = 100 - index // 基础位置得分
            const title = bookmark.title?.toLowerCase() || ''

            searchTerms.forEach(term => {
                if (title.includes(term)) {
                    score += title.startsWith(term) ? 50 : 25
                }
            })

            return {
                id: bookmark.id,
                title: bookmark.title || '',
                url: bookmark.url || '',
                domain: this._extractDomain(bookmark.url || ''),
                path: bookmark.path || [],
                score: Math.max(score, 1),
                matchedFields: ['title'], // 简化匹配字段
                isFolder: !bookmark.url, // 没有URL的是文件夹
                dateAdded: bookmark.dateAdded,
                tags: [], // SuperEnhancedBookmarkNode没有tags字段
                keywords: bookmark.searchKeywords || [], // 使用searchKeywords字段
                highlights: options.enableHighlight ? this._generateHighlights(bookmark, searchTerms) : undefined
            }
        })
    }

    /**
     * 转换管理器结果
     */
    private _convertManagerResults(
        results: SearchResult[],
        options: LocalSearchOptions
    ): StandardSearchResult[] {
        return results.map(result => ({
            id: result.bookmark.id,
            title: result.bookmark.title || '',
            url: result.bookmark.url || '',
            domain: result.bookmark.domain,
            path: result.bookmark.path || [],
            score: result.score,
            matchedFields: result.matchedFields,
            highlights: options.enableHighlight ? result.highlights : undefined,
            isFolder: result.bookmark.isFolder || false,
            dateAdded: result.bookmark.dateAdded,
            tags: result.bookmark.tags || [],
            keywords: result.bookmark.keywords || []
        }))
    }

    /**
     * 结果后处理
     */
    private _postProcessResults(
        results: StandardSearchResult[],
        options: LocalSearchOptions
    ): StandardSearchResult[] {
        let processedResults = [...results]

        // 去重
        if (options.deduplicate !== false) {
            const seen = new Set<string>()
            processedResults = processedResults.filter(result => {
                const key = result.url || result.id
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
        }

        // 最低分数过滤
        if (options.minScore && options.minScore > 0) {
            processedResults = processedResults.filter(result => result.score >= options.minScore!)
        }

        // 排序
        const sortBy = options.sortBy || 'relevance'
        processedResults.sort((a, b) => {
            switch (sortBy) {
                case 'relevance':
                    return b.score - a.score
                case 'title':
                    return a.title.localeCompare(b.title)
                case 'date':
                    return (b.dateAdded || 0) - (a.dateAdded || 0)
                case 'url':
                    return a.url.localeCompare(b.url)
                default:
                    return b.score - a.score
            }
        })

        return processedResults
    }

    /**
     * 生成高亮信息
     */
    private _generateHighlights(
        bookmark: SuperEnhancedBookmarkNode,
        searchTerms: string[]
    ): Record<string, string[]> {
        const highlights: Record<string, string[]> = {}

        searchTerms.forEach(term => {
            if (bookmark.title && bookmark.title.toLowerCase().includes(term)) {
                if (!highlights.title) highlights.title = []
                highlights.title.push(term)
            }

            if (bookmark.url && bookmark.url.toLowerCase().includes(term)) {
                if (!highlights.url) highlights.url = []
                highlights.url.push(term)
            }
        })

        return highlights
    }

    /**
     * 提取域名
     */
    private _extractDomain(url: string): string {
        try {
            return new URL(url).hostname
        } catch {
            return ''
        }
    }

    /**
     * 标准化查询
     */
    private _normalizeQuery(query: string): string {
        return query.trim().toLowerCase()
    }

    /**
     * 生成缓存键
     */
    private _getCacheKey(query: string, options: LocalSearchOptions): string {
        return `${query}_${JSON.stringify(options)}`
    }

    /**
     * 更新缓存
     */
    private _updateCache(key: string, results: StandardSearchResult[]): void {
        // 限制缓存大小
        if (this.searchCache.size >= this.maxCacheSize) {
            const firstKey = this.searchCache.keys().next().value
            if (firstKey) {
                this.searchCache.delete(firstKey)
            }
        }

        this.searchCache.set(key, results)
    }

    /**
     * 创建搜索统计
     */
    private _createSearchStats(
        query: string,
        mode: SearchMode,
        duration: number,
        totalResults: number,
        returnedResults: number,
        maxScore: number,
        avgScore: number
    ): SearchStats {
        return {
            query,
            mode,
            duration: Math.round(duration * 100) / 100,
            totalResults,
            returnedResults,
            maxScore: Math.round(maxScore * 100) / 100,
            avgScore: Math.round(avgScore * 100) / 100
        }
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.searchCache.clear()
        console.log('🧹 [搜索服务] 缓存已清除')
    }

    /**
     * 获取缓存统计
     */
    getCacheStats(): {
        size: number
        maxSize: number
        hitRate: number
    } {
        return {
            size: this.searchCache.size,
            maxSize: this.maxCacheSize,
            hitRate: 0 // TODO: 实现命中率统计
        }
    }
}

/**
 * 导出单例实例
 */
export const bookmarkSearchService = BookmarkSearchService.getInstance()

/**
 * 便捷搜索函数
 */
export const searchBookmarks = async (
    query: string,
    options?: LocalSearchOptions
) => {
    return bookmarkSearchService.search(query, options)
}
