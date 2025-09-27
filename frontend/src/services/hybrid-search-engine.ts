/**
 * 🚀 Phase 2: 混合搜索引擎
 * 结合Chrome原生API和自定义搜索逻辑，实现最佳搜索体验
 * 
 * 基于Chrome官方文档建议："结合原生API和自定义逻辑获得最佳效果"
 */

import { bookmarkSearchService } from './bookmark-search-service'
import { getPerformanceOptimizer } from './realtime-performance-optimizer'

// ==================== 类型定义 ====================

export interface HybridSearchOptions {
    mode?: 'smart' | 'fast' | 'deep'
    maxResults?: number
    includeMetadata?: boolean
    fuzzyMatch?: boolean
    cacheTimeout?: number
}

export interface SearchSource {
    type: 'native' | 'custom'
    method: string
    duration: number
}

export interface HybridSearchResult {
    // 基础书签信息
    id: string
    title: string
    url: string
    dateAdded?: number
    dateLastUsed?: number
    parentId?: string

    // 搜索增强信息
    source: 'native' | 'custom'
    sources: ('native' | 'custom')[]
    relevanceScore: number
    finalScore: number
    searchMethod: string
    highlights?: {
        title?: string
        url?: string
        content?: string
    }

    // Phase 2 增强信息
    confidence: number
    matchType: 'exact' | 'fuzzy' | 'semantic'
    searchSource: SearchSource[]
}

export interface SearchPerformanceMetric {
    query: string
    duration: number
    resultCount: number
    cacheHit: boolean
    searchMode: string
    timestamp: number
    sources: string[]
}

export interface SearchCacheEntry {
    results: HybridSearchResult[]
    timestamp: number
    expires: number
    query: string
    options: HybridSearchOptions
    performance: SearchPerformanceMetric
}

// ==================== 混合搜索引擎主类 ====================

export class HybridSearchEngine {
    private searchCache = new Map<string, SearchCacheEntry>()
    private performanceMetrics: SearchPerformanceMetric[] = []
    private performanceOptimizer = getPerformanceOptimizer() // ✅ Phase 2 Step 3

    // 搜索策略配置
    private searchConfig = {
        useNativeFirst: true,          // 优先使用Chrome原生搜索
        customSearchThreshold: 0.6,    // 自定义搜索相关度阈值
        maxResults: 50,                // 最大结果数
        cacheTimeout: 5 * 60 * 1000,   // 缓存5分钟
        nativeSearchTimeout: 100,      // 原生搜索超时(ms)
        customSearchTimeout: 500,      // 自定义搜索超时(ms)
        fuzzyMatchThreshold: 0.7       // 模糊匹配阈值
    }

    constructor() {
        this.initializeSearchEngine()
    }

    /**
     * 初始化搜索引擎
     */
    private async initializeSearchEngine(): Promise<void> {
        try {
            console.log('🔍 [HybridSearch] 初始化混合搜索引擎...')

            // ✅ Phase 2 Step 3: 初始化性能优化器
            await this.performanceOptimizer.initialize()

            // 初始化自定义搜索服务
            await bookmarkSearchService.initialize()

            // 清理过期缓存
            this.cleanupExpiredCache()

            console.log('✅ [HybridSearch] 混合搜索引擎初始化完成')
        } catch (error) {
            console.error('❌ [HybridSearch] 初始化失败:', error)
            throw new Error(`混合搜索引擎初始化失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 🚀 混合搜索主入口 - Phase 2核心功能
     */
    async search(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchResult[]> {
        if (!query || query.trim().length === 0) {
            return []
        }

        const normalizedQuery = query.trim().toLowerCase()
        const searchKey = this.generateSearchKey(normalizedQuery, options)

        // 1. ✅ Phase 2 Step 3: 智能缓存检查
        const cachedResults = await this.performanceOptimizer.getCachedSearch(normalizedQuery, options)
        if (cachedResults) {
            console.log('💾 [HybridSearch] 智能缓存命中:', normalizedQuery)
            return cachedResults
        }

        const startTime = performance.now()
        const searchSources: SearchSource[] = []

        try {
            console.log(`🔍 [HybridSearch] 开始混合搜索: "${normalizedQuery}"`, options)

            // 2. 根据模式决定搜索策略
            const searchMode = options.mode || 'smart'
            let nativeResults: HybridSearchResult[] = []
            let customResults: HybridSearchResult[] = []

            if (searchMode === 'fast') {
                // 仅使用原生搜索
                nativeResults = await this.performNativeSearch(normalizedQuery, options, searchSources)

            } else if (searchMode === 'deep') {
                // 仅使用自定义搜索
                customResults = await this.performCustomSearch(normalizedQuery, options, searchSources)

            } else {
                // 智能混合搜索 (默认)
                const searchPromises = []

                // 并行执行原生和自定义搜索
                if (this.searchConfig.useNativeFirst) {
                    searchPromises.push(
                        this.performNativeSearch(normalizedQuery, options, searchSources)
                            .then(results => ({ type: 'native', results }))
                    )
                }

                searchPromises.push(
                    this.performCustomSearch(normalizedQuery, options, searchSources)
                        .then(results => ({ type: 'custom', results }))
                )

                // 等待所有搜索完成
                const searchResults = await Promise.allSettled(searchPromises)

                // 处理搜索结果
                searchResults.forEach((result) => {
                    if (result.status === 'fulfilled') {
                        if (result.value.type === 'native') {
                            nativeResults = result.value.results
                        } else {
                            customResults = result.value.results
                        }
                    } else {
                        console.warn(`⚠️ [HybridSearch] ${result.reason}`)
                    }
                })
            }

            // 3. 智能合并和排序
            const mergedResults = this.mergeAndRankResults(nativeResults, customResults, normalizedQuery)

            // 4. 应用结果过滤和限制
            const finalResults = this.applyResultFilters(mergedResults, options)

            // 5. 缓存结果
            const duration = performance.now() - startTime
            const performanceMetric: SearchPerformanceMetric = {
                query: normalizedQuery,
                duration,
                resultCount: finalResults.length,
                cacheHit: false,
                searchMode,
                timestamp: Date.now(),
                sources: searchSources.map(s => s.type)
            }

            // ✅ Phase 2 Step 3: 智能缓存存储
            this.performanceOptimizer.setCachedSearch(normalizedQuery, options, finalResults, options.cacheTimeout)

            this.cacheResults(searchKey, finalResults, options, performanceMetric)
            this.recordSearchPerformance(performanceMetric)

            console.log(`✅ [HybridSearch] 搜索完成: ${finalResults.length}个结果, 耗时${duration.toFixed(2)}ms`)

            return finalResults

        } catch (error) {
            console.error('❌ [HybridSearch] 搜索失败:', error)

            // 降级到基础搜索
            return this.fallbackSearch(normalizedQuery, options)
        }
    }

    /**
     * Chrome原生搜索 - 基于官方API
     */
    private async performNativeSearch(
        query: string,
        options: HybridSearchOptions,
        searchSources: SearchSource[]
    ): Promise<HybridSearchResult[]> {
        const startTime = performance.now()

        try {
            console.log('🔍 [Native] 开始Chrome原生搜索...')

            if (!chrome?.bookmarks?.search) {
                throw new Error('Chrome Bookmarks API 不可用')
            }

            // 使用Chrome原生搜索API (Promise版本)
            const nativeResults = await chrome.bookmarks.search(query)

            const duration = performance.now() - startTime
            console.log(`⚡ [Native] 原生搜索完成: ${nativeResults.length}个结果, 耗时${duration.toFixed(2)}ms`)

            // 记录搜索源信息
            searchSources.push({
                type: 'native' as const,
                method: 'chrome.bookmarks.search',
                duration
            })

            // 转换为统一格式
            return nativeResults
                .filter(bookmark => bookmark.url) // 只包含有URL的书签
                .map(bookmark => ({
                    id: bookmark.id,
                    title: bookmark.title || '',
                    url: bookmark.url || '',
                    dateAdded: bookmark.dateAdded,
                    dateLastUsed: bookmark.dateLastUsed,
                    parentId: bookmark.parentId,

                    // 搜索增强信息
                    source: 'native' as const,
                    sources: ['native' as const],
                    relevanceScore: this.calculateNativeRelevance(bookmark, query),
                    finalScore: 0, // 将在合并阶段计算
                    searchMethod: 'chrome-api',

                    // Phase 2 增强信息
                    confidence: 0.8, // 原生搜索置信度较高
                    matchType: this.determineMatchType(bookmark, query),
                    searchSource: [{ type: 'native' as const, method: 'chrome.bookmarks.search', duration }]
                }))
                .slice(0, options.maxResults || this.searchConfig.maxResults)

        } catch (error) {
            console.warn('⚠️ [Native] Chrome原生搜索失败:', error)

            // 记录失败信息
            searchSources.push({
                type: 'native' as const,
                method: 'chrome.bookmarks.search',
                duration: performance.now() - startTime
            })

            return []
        }
    }

    /**
     * 自定义深度搜索 - 基于现有BookmarkSearchService
     */
    private async performCustomSearch(
        query: string,
        options: HybridSearchOptions,
        searchSources: SearchSource[]
    ): Promise<HybridSearchResult[]> {
        const startTime = performance.now()

        try {
            console.log('🎯 [Custom] 开始自定义深度搜索...')

            // 使用现有的BookmarkSearchService
            const customResults = await bookmarkSearchService.search(query, {
                searchMode: 'accurate' as any,
                includeContent: options.includeMetadata || false,
                fuzzyMatch: options.fuzzyMatch || false,
                maxResults: options.maxResults || this.searchConfig.maxResults
            } as any)

            const duration = performance.now() - startTime
            console.log(`🎯 [Custom] 自定义搜索完成: ${customResults.results?.length || 0}个结果, 耗时${duration.toFixed(2)}ms`)

            // 记录搜索源信息
            searchSources.push({
                type: 'custom' as const,
                method: 'bookmark-search-service',
                duration
            })

            return (customResults.results || []).map(result => ({
                id: result.id,
                title: result.title || '',
                url: result.url || '',
                dateAdded: result.dateAdded,
                dateLastUsed: undefined, // StandardSearchResult doesn't have dateLastUsed
                parentId: undefined, // StandardSearchResult doesn't have parentId

                // 搜索增强信息
                source: 'custom' as const,
                sources: ['custom' as const],
                relevanceScore: result.score,
                finalScore: 0, // 将在合并阶段计算
                searchMethod: 'custom-algorithm',
                highlights: result.highlights ? {
                    title: Array.isArray(result.highlights.title) ? result.highlights.title.join(' ') : result.highlights.title,
                    url: Array.isArray(result.highlights.url) ? result.highlights.url.join(' ') : result.highlights.url,
                    content: Array.isArray(result.highlights.content) ? result.highlights.content.join(' ') : result.highlights.content
                } : undefined,

                // Phase 2 增强信息
                confidence: Math.min(result.score, 1.0),
                matchType: result.score > 0.8 ? 'exact' : result.score > 0.6 ? 'fuzzy' : 'semantic',
                searchSource: [{ type: 'custom' as const, method: 'bookmark-search-service', duration }]
            }))

        } catch (error) {
            console.warn('⚠️ [Custom] 自定义搜索失败:', error)

            // 记录失败信息
            searchSources.push({
                type: 'custom' as const,
                method: 'bookmark-search-service',
                duration: performance.now() - startTime
            })

            return []
        }
    }

    /**
     * 智能合并和排序算法 - Phase 2核心逻辑
     */
    private mergeAndRankResults(
        nativeResults: HybridSearchResult[],
        customResults: HybridSearchResult[],
        query: string
    ): HybridSearchResult[] {
        console.log(`🔀 [Merge] 开始合并结果: Native=${nativeResults.length}, Custom=${customResults.length}`)

        const mergedMap = new Map<string, HybridSearchResult>()

        // 1. 处理原生搜索结果
        nativeResults.forEach(result => {
            const finalScore = this.calculateFinalScore(result, query, 'native')
            mergedMap.set(result.id, {
                ...result,
                finalScore,
                confidence: Math.min(result.confidence, finalScore / 100)
            })
        })

        // 2. 处理自定义搜索结果
        customResults.forEach(result => {
            if (mergedMap.has(result.id)) {
                // 如果已存在，合并来源和分数
                const existing = mergedMap.get(result.id)!
                existing.sources.push('custom')
                existing.finalScore = this.calculateCombinedScore(existing, result, query)
                existing.confidence = Math.max(existing.confidence, result.confidence)
                existing.highlights = result.highlights || existing.highlights
                existing.searchSource.push(...result.searchSource)

                // 选择最佳匹配类型
                if (result.matchType === 'exact' || existing.matchType !== 'exact') {
                    existing.matchType = result.matchType
                }
            } else {
                // 新结果
                const finalScore = this.calculateFinalScore(result, query, 'custom')
                mergedMap.set(result.id, {
                    ...result,
                    finalScore,
                    confidence: Math.min(result.confidence, finalScore / 100)
                })
            }
        })

        // 3. 排序和过滤
        const sortedResults = Array.from(mergedMap.values())
            .filter(result => result.finalScore > 0) // 过滤无效结果
            .sort((a, b) => {
                // 多因素排序：最终分数 > 置信度 > 来源数量
                if (Math.abs(a.finalScore - b.finalScore) < 5) {
                    if (Math.abs(a.confidence - b.confidence) < 0.1) {
                        return b.sources.length - a.sources.length
                    }
                    return b.confidence - a.confidence
                }
                return b.finalScore - a.finalScore
            })
            .slice(0, this.searchConfig.maxResults)

        console.log(`✅ [Merge] 合并完成: ${sortedResults.length}个最终结果`)

        return sortedResults
    }

    /**
     * 计算原生搜索相关度分数
     */
    private calculateNativeRelevance(bookmark: chrome.bookmarks.BookmarkTreeNode, query: string): number {
        const title = (bookmark.title || '').toLowerCase()
        const url = (bookmark.url || '').toLowerCase()
        const queryLower = query.toLowerCase()

        let score = 0

        // 标题匹配 (权重最高)
        if (title.includes(queryLower)) {
            score += title.startsWith(queryLower) ? 50 : 30
        }

        // URL匹配
        if (url.includes(queryLower)) {
            score += 20
        }

        // 域名匹配
        const domain = this.extractDomain(url)
        if (domain.includes(queryLower)) {
            score += 15
        }

        // 最近使用加权
        if (bookmark.dateLastUsed) {
            const daysSinceUsed = (Date.now() - bookmark.dateLastUsed) / (1000 * 60 * 60 * 24)
            if (daysSinceUsed < 7) {
                score += 10 - daysSinceUsed
            }
        }

        return Math.min(score, 100)
    }

    /**
     * 计算最终相关度分数
     */
    private calculateFinalScore(result: HybridSearchResult, query: string, _source: 'native' | 'custom'): number {
        const baseScore = result.relevanceScore || 0

        // 源权重 (自定义搜索权重更高，因为更准确)
        const sourceWeight = _source === 'native' ? 0.7 : 1.0

        // 标题匹配度加权
        const titleMatch = this.calculateTitleMatch(result.title, query)

        // URL匹配度加权  
        const urlMatch = this.calculateUrlMatch(result.url, query)

        // 使用频率加权
        let usageBoost = 0
        if (result.dateLastUsed) {
            const daysSinceUsed = (Date.now() - result.dateLastUsed) / (1000 * 60 * 60 * 24)
            usageBoost = Math.max(0, 10 - daysSinceUsed * 0.5) // 最近使用的书签获得加分
        }

        // 综合分数
        const finalScore = (baseScore * sourceWeight) + (titleMatch * 0.3) + (urlMatch * 0.1) + usageBoost

        return Math.min(Math.max(finalScore, 0), 100)
    }

    /**
     * 计算组合分数 (当同一个书签在多个搜索源中找到时)
     */
    private calculateCombinedScore(existing: HybridSearchResult, newResult: HybridSearchResult, _query: string): number {
        // 使用加权平均，自定义搜索权重更高
        const nativeWeight = 0.4
        const customWeight = 0.6

        const existingScore = existing.source === 'native' ?
            existing.finalScore * nativeWeight :
            existing.finalScore * customWeight

        const newScore = newResult.source === 'native' ?
            newResult.relevanceScore * nativeWeight :
            newResult.relevanceScore * customWeight

        // 组合分数有额外加成 (多源验证)
        const combinedScore = existingScore + newScore + 10 // 多源加成

        return Math.min(combinedScore, 100)
    }

    /**
     * 应用结果过滤
     */
    private applyResultFilters(results: HybridSearchResult[], options: HybridSearchOptions): HybridSearchResult[] {
        let filteredResults = results

        // 去重 (基于URL)
        const seenUrls = new Set<string>()
        filteredResults = filteredResults.filter(result => {
            if (seenUrls.has(result.url)) {
                return false
            }
            seenUrls.add(result.url)
            return true
        })

        // 应用最大结果限制
        if (options.maxResults) {
            filteredResults = filteredResults.slice(0, options.maxResults)
        }

        return filteredResults
    }

    /**
     * 降级搜索 (当主要搜索失败时)
     */
    private async fallbackSearch(query: string, _options: HybridSearchOptions): Promise<HybridSearchResult[]> {
        console.log('🆘 [Fallback] 执行降级搜索...')

        try {
            // 尝试仅使用原生搜索
            if (chrome?.bookmarks?.search) {
                const fallbackResults = await chrome.bookmarks.search(query)
                return fallbackResults
                    .filter(bookmark => bookmark.url)
                    .slice(0, 10)
                    .map(bookmark => ({
                        id: bookmark.id,
                        title: bookmark.title || '',
                        url: bookmark.url || '',
                        dateAdded: bookmark.dateAdded,
                        parentId: bookmark.parentId,

                        source: 'native' as const,
                        sources: ['native' as const],
                        relevanceScore: 50,
                        finalScore: 50,
                        searchMethod: 'fallback-native',
                        confidence: 0.5,
                        matchType: 'fuzzy' as const,
                        searchSource: [{ type: 'native' as const, method: 'fallback', duration: 0 }]
                    }))
            }

            return []
        } catch (error) {
            console.error('❌ [Fallback] 降级搜索也失败了:', error)
            return []
        }
    }

    // ==================== 辅助方法 ====================

    private generateSearchKey(query: string, options: HybridSearchOptions): string {
        return `${query}|${JSON.stringify(options)}`
    }

    // ✅ Phase 2 Step 3: 旧缓存方法已移除，使用性能优化器

    private cacheResults(
        key: string,
        results: HybridSearchResult[],
        options: HybridSearchOptions,
        performance: SearchPerformanceMetric
    ): void {
        const entry: SearchCacheEntry = {
            results,
            timestamp: Date.now(),
            expires: Date.now() + (options.cacheTimeout || this.searchConfig.cacheTimeout),
            query: key.split('|')[0],
            options,
            performance
        }

        this.searchCache.set(key, entry)

        // 限制缓存大小
        if (this.searchCache.size > 100) {
            const oldestKey = Array.from(this.searchCache.keys())[0]
            this.searchCache.delete(oldestKey)
        }
    }

    private cleanupExpiredCache(): void {
        const now = Date.now()
        for (const [key, entry] of this.searchCache.entries()) {
            if (entry.expires < now) {
                this.searchCache.delete(key)
            }
        }
    }

    private recordSearchPerformance(metric: SearchPerformanceMetric): void {
        this.performanceMetrics.push(metric)

        // 限制指标存储数量
        if (this.performanceMetrics.length > 1000) {
            this.performanceMetrics = this.performanceMetrics.slice(-1000)
        }
    }

    // ✅ Phase 2 Step 3: 缓存命中记录已移至性能优化器

    private calculateTitleMatch(title: string, query: string): number {
        const titleLower = title.toLowerCase()
        const queryLower = query.toLowerCase()

        if (titleLower === queryLower) return 100
        if (titleLower.startsWith(queryLower)) return 80
        if (titleLower.includes(queryLower)) return 60

        // 简单模糊匹配
        const words = queryLower.split(' ')
        const matchedWords = words.filter(word => titleLower.includes(word))
        return (matchedWords.length / words.length) * 40
    }

    private calculateUrlMatch(url: string, query: string): number {
        const urlLower = url.toLowerCase()
        const queryLower = query.toLowerCase()

        if (urlLower.includes(queryLower)) return 30

        const domain = this.extractDomain(urlLower)
        if (domain.includes(queryLower)) return 20

        return 0
    }

    private extractDomain(url: string): string {
        try {
            return new URL(url).hostname.replace('www.', '')
        } catch {
            return url.split('/')[2] || url
        }
    }

    private determineMatchType(bookmark: chrome.bookmarks.BookmarkTreeNode, query: string): 'exact' | 'fuzzy' | 'semantic' {
        const title = (bookmark.title || '').toLowerCase()
        const queryLower = query.toLowerCase()

        if (title === queryLower) return 'exact'
        if (title.includes(queryLower)) return 'fuzzy'
        return 'semantic'
    }

    // ==================== 公共API ====================

    /**
     * 获取搜索性能统计
     */
    getPerformanceStats() {
        const recent = this.performanceMetrics.slice(-100)

        if (recent.length === 0) {
            return {
                averageResponseTime: 0,
                cacheHitRate: 0,
                totalSearches: 0,
                recentSearches: 0
            }
        }

        const cacheHits = recent.filter(m => m.cacheHit).length
        const totalDuration = recent.reduce((sum, m) => sum + m.duration, 0)

        return {
            averageResponseTime: Math.round(totalDuration / recent.length),
            cacheHitRate: cacheHits / recent.length,
            totalSearches: this.performanceMetrics.length,
            recentSearches: recent.length,
            fastestSearch: Math.min(...recent.map(m => m.duration)),
            slowestSearch: Math.max(...recent.map(m => m.duration))
        }
    }

    /**
     * 清理搜索缓存
     */
    clearCache(): void {
        this.searchCache.clear()
        console.log('🧹 [HybridSearch] 搜索缓存已清理')
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            cacheSize: this.searchCache.size,
            cacheEntries: Array.from(this.searchCache.entries()).map(([key, entry]) => ({
                key,
                query: entry.query,
                resultCount: entry.results.length,
                timestamp: entry.timestamp,
                performance: entry.performance
            }))
        }
    }
}

// ==================== 导出 ====================

// 单例模式
let hybridSearchEngineInstance: HybridSearchEngine | null = null

export function getHybridSearchEngine(): HybridSearchEngine {
    if (!hybridSearchEngineInstance) {
        hybridSearchEngineInstance = new HybridSearchEngine()
    }
    return hybridSearchEngineInstance
}

// 默认导出
export default HybridSearchEngine
