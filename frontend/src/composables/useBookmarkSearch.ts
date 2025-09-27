/**
 * 通用书签搜索 Composable
 * 
 * 功能特性：
 * - 统一搜索逻辑封装
 * - 防抖搜索优化
 * - 多种搜索模式支持
 * - 错误处理和状态管理
 * - 灵活的配置选项
 */

import { ref, watch, onUnmounted } from 'vue'
import { sidePanelAPI } from '../utils/unified-bookmark-api'
import type { BookmarkNode } from '../types'

/**
 * 搜索配置选项
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
}

/**
 * 增强的搜索结果类型
 */
export interface EnhancedBookmarkResult extends BookmarkNode {
    path: string[]
    isFaviconLoading?: boolean
}

/**
 * 搜索状态
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
    }
}

/**
 * 通用书签搜索 Composable
 */
export function useBookmarkSearch(options: BookmarkSearchOptions = {}) {
    const {
        debounceDelay = 200,
        limit = 50,
        autoSearch = true,
        bookmarkTree,
        resultFilter,
        onError
    } = options

    // 响应式状态
    const searchQuery = ref('')
    const searchResults = ref<EnhancedBookmarkResult[]>([])
    const isSearching = ref(false)
    const error = ref<string | null>(null)
    const stats = ref({
        totalResults: 0,
        searchTime: 0,
        lastSearchQuery: ''
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
     * 执行搜索
     */
    const performSearch = async (query: string = searchQuery.value): Promise<EnhancedBookmarkResult[]> => {
        if (!query.trim()) {
            clearSearch()
            return []
        }

        const startTime = Date.now()
        isSearching.value = true
        error.value = null

        try {
            // 使用统一搜索API
            const results = await sidePanelAPI.searchBookmarks(query, bookmarkTree)

            // 限制结果数量
            const limitedResults = results.slice(0, limit)

            // 应用过滤器（如果提供）
            const filteredResults = resultFilter ? resultFilter(limitedResults) : limitedResults

            // 更新状态
            searchResults.value = filteredResults
            stats.value = {
                totalResults: filteredResults.length,
                searchTime: Date.now() - startTime,
                lastSearchQuery: query
            }

            return filteredResults
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '搜索失败'
            error.value = errorMessage
            searchResults.value = []

            // 调用错误处理函数
            if (onError && err instanceof Error) {
                onError(err)
            } else {
                console.error('书签搜索失败:', err)
            }

            return []
        } finally {
            isSearching.value = false
        }
    }

    /**
     * 防抖搜索处理
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
 * 预设配置的搜索实例
 */
export const createBookmarkSearchPresets = () => ({
    // 快速搜索预设（用于下拉框等）
    quickSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 150,
        limit: 10,
        bookmarkTree,
        autoSearch: true
    }),

    // 详细搜索预设（用于搜索页面）
    detailSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 300,
        limit: 100,
        bookmarkTree,
        autoSearch: true
    }),

    // 管理页面搜索预设
    managementSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 200,
        limit: 50,
        bookmarkTree,
        autoSearch: true,
        resultFilter: (results) => {
            // 可以添加管理页面特定的过滤逻辑
            return results
        }
    }),

    // 侧边栏搜索预设
    sidebarSearch: (bookmarkTree?: BookmarkNode[]) => useBookmarkSearch({
        debounceDelay: 200,
        limit: 20,
        bookmarkTree,
        autoSearch: true
    })
})
