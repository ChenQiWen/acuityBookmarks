/**
 * 通用书签搜索 Composable
 * 
 * 功能特性：
 * - 统一搜索逻辑封装
 * - 防抖搜索优化
 * - 多种搜索模式支持
 * - 错误处理和状态管理
 * - 灵活的配置选项
 * - ✅ Phase 2: 混合搜索引擎集成
 * - ✅ Phase 2: 性能监控和优化
 */

import { ref, watch, onUnmounted } from 'vue'
import { sidePanelAPI } from '../utils/unified-bookmark-api'
import type { BookmarkNode } from '../types'
// ✅ Phase 2: 引入混合搜索引擎和性能监控
import { getHybridSearchEngine, type HybridSearchOptions } from '../services/hybrid-search-engine'
import { getPerformanceMonitor } from '../services/search-performance-monitor'
import { logger } from '../utils/logger'

/**
 * 搜索配置选项 - ✅ Phase 2增强
 */
export interface BookmarkSearchOptions {
    /** 搜索防抖延迟(ms)，默认200 */
    debounceDelay?: number
    /** 结果数量限制，默认50 */
    limit?: number
    /** 是否启用自动搜索，默认true */
    autoSearch?: boolean
    /** 书签树数据源（用于内存搜索） */
    bookmarkTree?: BookmarkNode[]
    /** 搜索结果过滤函数 */
    resultFilter?: (results: EnhancedBookmarkResult[]) => EnhancedBookmarkResult[]
    /** 错误处理函数 */
    onError?: (error: Error) => void

    // ✅ Phase 2: 混合搜索引擎选项
    /** 搜索模式：smart(智能)、fast(快速)、deep(深度)，默认smart */
    searchMode?: 'smart' | 'fast' | 'deep'
    /** 是否启用混合搜索，默认true */
    enableHybridSearch?: boolean
    /** 是否包含元数据，默认false */
    includeMetadata?: boolean
    /** 是否启用模糊匹配，默认false */
    fuzzyMatch?: boolean
    /** 是否启用性能监控，默认true */
    enablePerformanceMonitoring?: boolean
    /** 缓存超时时间(ms)，默认5分钟 */
    cacheTimeout?: number
}

/**
 * 增强的搜索结果类型 - ✅ Phase 2增强
 */
export interface EnhancedBookmarkResult extends BookmarkNode {
    path: string[]
    isFaviconLoading?: boolean

    // ✅ Phase 2: 混合搜索增强字段
    relevanceScore?: number
    finalScore?: number
    source?: 'native' | 'custom'
    sources?: ('native' | 'custom')[]
    highlights?: {
        title?: string
        url?: string
        content?: string
    }
    confidence?: number
    matchType?: 'exact' | 'fuzzy' | 'semantic'
    searchMethod?: string
}

/**
 * 搜索状态 - ✅ Phase 2增强
 */
export interface SearchState {
    /** 搜索查询字符串 */
    searchQuery: string
    /** 搜索结果列表 */
    searchResults: EnhancedBookmarkResult[]
    /** 是否正在搜索 */
    isSearching: boolean
    /** 错误信息 */
    error: string | null
    /** 搜索统计 */
    stats: {
        totalResults: number
        searchTime: number
        lastSearchQuery: string

        // ✅ Phase 2: 新增统计字段
        searchMode?: string
        cacheHit?: boolean
        sourceDistribution?: { [source: string]: number }
        averageConfidence?: number
        performanceStatus?: 'excellent' | 'good' | 'fair' | 'poor'
    }
}

/**
 * 通用书签搜索 Composable - ✅ Phase 2增强
 */
export function useBookmarkSearch(options: BookmarkSearchOptions = {}) {
    const {
        debounceDelay = 200,
        limit = 50,
        autoSearch = true,
        bookmarkTree,
        resultFilter,
        onError,

        // ✅ Phase 2: 新增选项
        searchMode = 'smart',
        enableHybridSearch = true,
        includeMetadata = false,
        fuzzyMatch = false,
        enablePerformanceMonitoring = true,
        cacheTimeout = 5 * 60 * 1000 // 5分钟
    } = options

    // ✅ Phase 2: 初始化混合搜索引擎和性能监控
    const hybridSearchEngine = enableHybridSearch ? getHybridSearchEngine() : null
    const performanceMonitor = enablePerformanceMonitoring ? getPerformanceMonitor() : null

    // 响应式状态
    const searchQuery = ref('')
    const searchResults = ref<EnhancedBookmarkResult[]>([])
    const isSearching = ref(false)
    const error = ref<string | null>(null)
    const stats = ref({
        totalResults: 0,
        searchTime: 0,
        lastSearchQuery: '',

        // ✅ Phase 2: 新增统计字段 (可选)
        searchMode: undefined as string | undefined,
        cacheHit: undefined as boolean | undefined,
        sourceDistribution: undefined as { [source: string]: number } | undefined,
        averageConfidence: undefined as number | undefined,
        performanceStatus: undefined as ('excellent' | 'good' | 'fair' | 'poor') | undefined
    })

    // 防抖定时器
    let searchTimeout: number | null = null

    /**
     * 清除搜索状态
     */
    const clearSearch = () => {
        searchQuery.value = ''
        searchResults.value = []
        error.value = null
        isSearching.value = false

        if (searchTimeout) {
            clearTimeout(searchTimeout)
            searchTimeout = null
        }
    }

    /**
     * 执行搜索 - ✅ Phase 2增强版本
     */
    const performSearch = async (query: string = searchQuery.value): Promise<EnhancedBookmarkResult[]> => {
        if (!query.trim()) {
            clearSearch()
            return []
        }

        const startTime = performance.now()
        isSearching.value = true
        error.value = null

        let searchResultsData: EnhancedBookmarkResult[] = []
        let cacheHit = false

        try {
            logger.info('useBookmarkSearch', `🔍 开始搜索: "${query}" (模式: ${searchMode})`)

            if (hybridSearchEngine && enableHybridSearch) {
                // ✅ Phase 2: 使用混合搜索引擎
                const hybridOptions: HybridSearchOptions = {
                    mode: searchMode,
                    maxResults: limit,
                    includeMetadata,
                    fuzzyMatch,
                    cacheTimeout
                }

                const hybridResults = await hybridSearchEngine.search(query, hybridOptions)

                // 转换为EnhancedBookmarkResult格式
                searchResultsData = hybridResults.map(result => ({
                    // 基础字段
                    id: result.id,
                    title: result.title,
                    url: result.url,
                    dateAdded: result.dateAdded,
                    dateLastUsed: result.dateLastUsed,
                    parentId: result.parentId,
                    path: [], // TODO: 需要从书签树计算路径

                    // ✅ Phase 2: 增强字段
                    relevanceScore: result.relevanceScore,
                    finalScore: result.finalScore,
                    source: result.source,
                    sources: result.sources,
                    highlights: result.highlights,
                    confidence: result.confidence,
                    matchType: result.matchType,
                    searchMethod: result.searchMethod
                }))

                // 检查是否为缓存命中
                const performanceStats = hybridSearchEngine.getPerformanceStats()
                cacheHit = performanceStats.cacheHitRate > 0

            } else {
                // 降级到原有的搜索API
            logger.info('useBookmarkSearch', '🔄 使用传统搜索API (混合搜索已禁用)')
                const legacyResults = await sidePanelAPI.searchBookmarks(query, bookmarkTree)

                searchResultsData = legacyResults.map(result => ({
                    ...result,
                    relevanceScore: 0,
                    finalScore: 0,
                    source: 'custom' as const,
                    sources: ['custom' as const],
                    confidence: 0.7,
                    matchType: 'semantic' as const,
                    searchMethod: 'legacy-api'
                }))
            }

            // 应用过滤器（如果提供）
            const filteredResults = resultFilter ? resultFilter(searchResultsData) : searchResultsData

            // ✅ Phase 2: 计算增强统计信息
            const searchDuration = performance.now() - startTime
            const sourceDistribution: { [source: string]: number } = {}
            let totalConfidence = 0
            let confidenceCount = 0

            filteredResults.forEach(result => {
                // 统计搜索源分布
                if (result.sources) {
                    result.sources.forEach(source => {
                        sourceDistribution[source] = (sourceDistribution[source] || 0) + 1
                    })
                } else if (result.source) {
                    sourceDistribution[result.source] = (sourceDistribution[result.source] || 0) + 1
                }

                // 计算平均置信度
                if (result.confidence !== undefined) {
                    totalConfidence += result.confidence
                    confidenceCount++
                }
            })

            // 更新状态
            searchResults.value = filteredResults
            stats.value = {
                totalResults: filteredResults.length,
                searchTime: Math.round(searchDuration),
                lastSearchQuery: query,

                // ✅ Phase 2: 新增统计字段
                searchMode,
                cacheHit,
                sourceDistribution,
                averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
                performanceStatus: searchDuration < 100 ? 'excellent' :
                    searchDuration < 200 ? 'good' :
                        searchDuration < 500 ? 'fair' : 'poor'
            }

            // ✅ Phase 2: 记录性能数据
            if (performanceMonitor && enablePerformanceMonitoring) {
                performanceMonitor.recordSearch({
                    query,
                    duration: searchDuration,
                    resultCount: filteredResults.length,
                    cacheHit,
                    searchMode,
                    sources: Object.keys(sourceDistribution),
                    success: true
                })
            }

            logger.info('useBookmarkSearch', `✅ 搜索完成: ${filteredResults.length}个结果, 耗时${searchDuration.toFixed(2)}ms`)

            return filteredResults

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '搜索失败'
            error.value = errorMessage
            searchResults.value = []

            // ✅ Phase 2: 记录失败的性能数据
            if (performanceMonitor && enablePerformanceMonitoring) {
                performanceMonitor.recordSearch({
                    query,
                    duration: performance.now() - startTime,
                    resultCount: 0,
                    cacheHit: false,
                    searchMode,
                    sources: [],
                    success: false,
                    errorMessage
                })
            }

            // 调用错误处理函数
            if (onError && err instanceof Error) {
                onError(err)
            } else {
            logger.error('useBookmarkSearch', '❌ 搜索失败', err)
            }

            return []
        } finally {
            isSearching.value = false
        }
    }

    /**
     * 防抖搜索处理 + AI建议处理
     */
    const handleSearchInput = (query: string) => {
        searchQuery.value = query

        if (searchTimeout) {
            clearTimeout(searchTimeout)
        }

        if (!query.trim()) {
            clearSearch()
            return
        }

        searchTimeout = window.setTimeout(() => {
            performSearch(query)
        }, debounceDelay)
    }

    /**
     * 立即搜索（不防抖）
     */
    const searchImmediate = (query: string = searchQuery.value) => {
        if (searchTimeout) {
            clearTimeout(searchTimeout)
        }
        return performSearch(query)
    }

    // 自动监听搜索查询变化
    if (autoSearch) {
        watch(searchQuery, (newQuery) => {
            handleSearchInput(newQuery)
        }, { immediate: false })
    }

    // 清理定时器
    onUnmounted(() => {
        if (searchTimeout) {
            clearTimeout(searchTimeout)
        }
    })

    // 返回搜索状态和方法
    return {
        // 响应式状态
        searchQuery,
        searchResults,
        isSearching,
        error,
        stats,

        // 方法
        performSearch,
        handleSearchInput,
        searchImmediate,
        clearSearch,

        // 计算属性
        hasResults: () => searchResults.value.length > 0,
        isEmpty: () => searchQuery.value.trim() === '',
        hasError: () => error.value !== null,

        // 工具方法
        getResultById: (id: string) => searchResults.value.find(result => result.id === id),
        getResultsByUrl: (url: string) => searchResults.value.filter(result => result.url === url)
    }
}

/**
 * 创建全局书签搜索实例（单例模式）
 */
let globalSearchInstance: ReturnType<typeof useBookmarkSearch> | null = null

export function useGlobalBookmarkSearch(options?: BookmarkSearchOptions) {
    if (!globalSearchInstance) {
        globalSearchInstance = useBookmarkSearch({
            debounceDelay: 300,
            limit: 100,
            ...options
        })
    }
    return globalSearchInstance
}

/**
 * 预设配置的搜索实例 - ✅ Phase 2增强
 */
export const createBookmarkSearchPresets = () => ({
    // 快速搜索预设（用于下拉框等）
    quickSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 150,
        limit: 10,
        bookmarkTree,
        autoSearch: true,

        // ✅ Phase 2: 快速搜索优化配置
        searchMode: 'fast',           // 优先速度
        enableHybridSearch: true,
        includeMetadata: false,       // 不包含元数据以提升速度
        fuzzyMatch: false,            // 精确匹配
        enablePerformanceMonitoring: true,
        cacheTimeout: 2 * 60 * 1000   // 2分钟缓存
    }),

    // 详细搜索预设（用于搜索页面）
    detailSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 300,
        limit: 100,
        bookmarkTree,
        autoSearch: true,

        // ✅ Phase 2: 详细搜索配置
        searchMode: 'deep',           // 深度搜索
        enableHybridSearch: true,
        includeMetadata: true,        // 包含元数据
        fuzzyMatch: true,             // 启用模糊匹配
        enablePerformanceMonitoring: true,
        cacheTimeout: 10 * 60 * 1000  // 10分钟缓存
    }),

    // 管理页面搜索预设
    managementSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 200,
        limit: 50,
        bookmarkTree,
        autoSearch: true,

        // ✅ Phase 2: 管理页面搜索配置
        searchMode: 'smart',          // 智能搜索平衡性能和准确性
        enableHybridSearch: true,
        includeMetadata: true,
        fuzzyMatch: false,
        enablePerformanceMonitoring: true,
        cacheTimeout: 5 * 60 * 1000,  // 5分钟缓存

        resultFilter: (results) => {
            // ✅ Phase 2: 管理页面特定的过滤逻辑
            return results.sort((a, b) => {
                // 优先显示高置信度的结果
                const confidenceA = a.confidence || 0
                const confidenceB = b.confidence || 0
                if (Math.abs(confidenceA - confidenceB) > 0.1) {
                    return confidenceB - confidenceA
                }

                // 其次按最终得分排序
                const scoreA = a.finalScore || 0
                const scoreB = b.finalScore || 0
                return scoreB - scoreA
            })
        }
    }),

    // 侧边栏搜索预设
    sidebarSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 200,
        limit: 20,
        bookmarkTree,
        autoSearch: true,

        // ✅ Phase 2: 侧边栏搜索配置
        searchMode: 'smart',          // 智能搜索
        enableHybridSearch: true,
        includeMetadata: false,       // 侧边栏不需要太多元数据
        fuzzyMatch: true,             // 启用模糊匹配以提升用户体验
        enablePerformanceMonitoring: true,
        cacheTimeout: 3 * 60 * 1000   // 3分钟缓存
    }),

    // ✅ Phase 2: 新增性能优化预设
    performanceOptimized: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 100,           // 更短的防抖延迟
        limit: 15,                    // 适中的结果数量
        bookmarkTree,
        autoSearch: true,

        searchMode: 'fast',           // 优先速度
        enableHybridSearch: true,
        includeMetadata: false,
        fuzzyMatch: false,
        enablePerformanceMonitoring: true,
        cacheTimeout: 1 * 60 * 1000,  // 1分钟短缓存

        resultFilter: (results) => {
            // 只返回高相关度的结果
            return results.filter(result => (result.confidence || 0) > 0.6)
        }
    })
})
