/**
 * Popup Store - IndexedDB版本
 * 完全基于IndexedDB，移除chrome.storage.local依赖
 * 支持十万条书签的高性能搜索
 */

import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { IndexedDBBookmarkManager } from '../utils/indexeddb-bookmark-manager'
import type { GlobalStats } from '../utils/indexeddb-core'
import { performanceMonitor } from '../utils/performance-monitor'

export interface BookmarkStats {
    bookmarks: number
    folders: number
}

export interface SearchUIState {
    isSearching: boolean
    searchProgress: number
    hasSearchResults: boolean
}

export interface SearchProgress {
    current: number
    total: number
    message: string
}

export interface SearchResult {
    id: string
    title: string
    url?: string
    domain?: string
    path: string[]
    pathString: string
    matchScore: number
    isFolder: boolean
}

/**
 * 弹窗状态管理存储 - IndexedDB版本
 */
export const usePopupStoreIndexedDB = defineStore('popup-indexeddb', () => {
    // ==================== 状态 ====================

    // IndexedDB管理器
    const bookmarkManager = IndexedDBBookmarkManager.getInstance()

    // 加载状态
    const isLoading = ref(false)
    const lastError = ref<string | null>(null)

    // 当前标签页信息
    const currentTabUrl = ref('')
    const currentTabTitle = ref('')
    const currentTabId = ref<number | null>(null)

    // 书签统计
    const stats = ref<BookmarkStats>({
        bookmarks: 0,
        folders: 0
    })

    // 搜索状态
    const searchQuery = ref('')
    const searchMode = ref<'fast' | 'smart'>('fast')
    const searchResults = ref<SearchResult[]>([])
    const searchUIState = ref<SearchUIState>({
        isSearching: false,
        searchProgress: 0,
        hasSearchResults: false
    })
    const searchProgress = ref<SearchProgress>({
        current: 0,
        total: 100,
        message: ''
    })

    // 搜索历史
    const searchHistory = ref<string[]>([])
    const showSearchHistory = ref(false)

    // 性能监控
    const performanceStats = ref({
        lastSearchTime: 0,
        averageSearchTime: 0,
        searchCount: 0
    })

    // ==================== 计算属性 ====================

    const hasCurrentTab = computed(() => {
        return currentTabId.value !== null && currentTabUrl.value.length > 0
    })

    const hasSearchQuery = computed(() => {
        return searchQuery.value.trim().length > 0
    })

    const hasSearchResults = computed(() => {
        return searchResults.value.length > 0
    })

    const totalItems = computed(() => {
        return stats.value.bookmarks + stats.value.folders
    })

    const searchProgressPercent = computed(() => {
        if (searchProgress.value.total === 0) return 0
        return Math.round((searchProgress.value.current / searchProgress.value.total) * 100)
    })

    const filteredSearchHistory = computed(() => {
        if (!hasSearchQuery.value) return searchHistory.value

        return searchHistory.value.filter(historyItem =>
            historyItem.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
    })

    // ==================== 方法 ====================

    /**
     * 初始化弹窗
     */
    async function initialize(): Promise<void> {
        const timer = performanceMonitor.measureStartupTime()
        isLoading.value = true
        lastError.value = null

        try {
            console.log('🚀 初始化Popup Store (IndexedDB版本)...')

            // 1. 初始化IndexedDB管理器
            await bookmarkManager.initialize()

            // 2. 获取当前标签页信息
            await getCurrentTab()

            // 3. 加载书签统计
            await loadBookmarkStats()

            // 4. 加载搜索历史
            await loadSearchHistory()

            // 5. 设置数据更新监听
            bookmarkManager.addUpdateListener(onBookmarkDataUpdated)

            console.log('✅ Popup Store (IndexedDB版本) 初始化完成')

        } catch (error) {
            lastError.value = `初始化失败: ${(error as Error).message}`
            console.error('❌ Popup Store 初始化失败:', error)
            throw error
        } finally {
            isLoading.value = false
            timer.end()
        }
    }

    /**
     * 获取当前标签页信息
     */
    async function getCurrentTab(): Promise<void> {
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
                if (tabs.length > 0) {
                    const tab = tabs[0]
                    currentTabId.value = tab.id || null
                    currentTabUrl.value = tab.url || ''
                    currentTabTitle.value = tab.title || ''
                }
            }
        } catch (error) {
            console.warn('获取当前标签页失败:', error)
        }
    }

    /**
     * 加载书签统计
     */
    async function loadBookmarkStats(): Promise<void> {
        try {
            const globalStats = await bookmarkManager.getGlobalStats()
            if (globalStats) {
                stats.value = {
                    bookmarks: globalStats.totalBookmarks,
                    folders: globalStats.totalFolders
                }
            }
        } catch (error) {
            console.warn('加载书签统计失败:', error)
        }
    }

    /**
     * 执行搜索
     */
    async function performSearch(query: string = searchQuery.value): Promise<void> {
        if (!query.trim()) {
            searchResults.value = []
            return
        }

        const searchTimer = performance.now()
        searchUIState.value.isSearching = true
        searchProgress.value = {
            current: 0,
            total: 100,
            message: '正在搜索书签...'
        }

        try {
            console.log(`🔍 执行搜索: "${query}" (模式: ${searchMode.value})`)

            // 使用IndexedDB管理器搜索
            const results = await bookmarkManager.searchBookmarks(query, {
                limit: 100,
                sortBy: 'relevance'
            })

            // 转换为搜索结果格式
            searchResults.value = results.map((bookmark, index) => ({
                id: bookmark.id,
                title: bookmark.title,
                url: bookmark.url,
                domain: bookmark.domain,
                path: bookmark.path,
                pathString: bookmark.pathString,
                matchScore: 100 - index, // 简化的匹配分数
                isFolder: bookmark.isFolder
            }))

            searchUIState.value.hasSearchResults = searchResults.value.length > 0

            // 添加到搜索历史
            await addToSearchHistory(query, searchResults.value.length)

            // 更新性能统计
            const searchTime = performance.now() - searchTimer
            updatePerformanceStats(searchTime)

            console.log(`✅ 搜索完成，找到 ${searchResults.value.length} 个结果，耗时 ${searchTime.toFixed(2)}ms`)

            // 性能监控
            performanceMonitor.trackUserAction('bookmark_search', {
                query: query.length,
                results: searchResults.value.length,
                time: searchTime,
                mode: searchMode.value
            })

        } catch (error) {
            console.error('❌ 搜索失败:', error)
            lastError.value = `搜索失败: ${(error as Error).message}`
        } finally {
            searchUIState.value.isSearching = false
            searchProgress.value.current = searchProgress.value.total
        }
    }

    /**
     * 快速搜索
     */
    async function performFastSearch(query: string = searchQuery.value): Promise<void> {
        searchMode.value = 'fast'
        await performSearch(query)
    }

    /**
     * 智能搜索
     */
    async function performSmartSearch(query: string = searchQuery.value): Promise<void> {
        searchMode.value = 'smart'
        await performSearch(query)
    }

    /**
     * 清除搜索结果
     */
    function clearSearchResults(): void {
        searchQuery.value = ''
        searchResults.value = []
        searchUIState.value.hasSearchResults = false
        showSearchHistory.value = false
    }

    /**
     * 加载搜索历史
     */
    async function loadSearchHistory(): Promise<void> {
        try {
            const history = await bookmarkManager.getSearchHistory(20)
            searchHistory.value = history.map(item => item.query)
        } catch (error) {
            console.warn('加载搜索历史失败:', error)
            searchHistory.value = []
        }
    }

    /**
     * 添加到搜索历史
     */
    async function addToSearchHistory(query: string, resultCount: number): Promise<void> {
        if (query.trim().length === 0) return

        try {
            await bookmarkManager.addSearchHistory(query.trim(), resultCount)

            // 更新本地历史记录
            const existingIndex = searchHistory.value.indexOf(query.trim())
            if (existingIndex > -1) {
                searchHistory.value.splice(existingIndex, 1)
            }

            searchHistory.value.unshift(query.trim())

            // 限制历史记录数量
            if (searchHistory.value.length > 20) {
                searchHistory.value = searchHistory.value.slice(0, 20)
            }

        } catch (error) {
            console.warn('添加搜索历史失败:', error)
        }
    }

    /**
     * 清空搜索历史
     */
    async function clearSearchHistory(): Promise<void> {
        try {
            await bookmarkManager.clearSearchHistory()
            searchHistory.value = []

            performanceMonitor.trackUserAction('search_history_cleared')

        } catch (error) {
            console.error('清空搜索历史失败:', error)
        }
    }

    /**
     * 更新性能统计
     */
    function updatePerformanceStats(searchTime: number): void {
        performanceStats.value.lastSearchTime = searchTime
        performanceStats.value.searchCount += 1

        // 计算平均搜索时间
        const totalTime = performanceStats.value.averageSearchTime * (performanceStats.value.searchCount - 1) + searchTime
        performanceStats.value.averageSearchTime = totalTime / performanceStats.value.searchCount
    }

    /**
     * 清理缓存（IndexedDB版本中主要是重新同步数据）
     */
    async function clearCache(): Promise<void> {
        isLoading.value = true

        try {
            console.log('🧹 开始清理缓存并重新同步数据...')

            // 从Chrome API重新加载数据
            await bookmarkManager.loadFromChrome()

            // 重新加载统计信息
            await loadBookmarkStats()

            // 清除搜索结果
            clearSearchResults()

            console.log('✅ 缓存清理完成')

            performanceMonitor.trackUserAction('cache_cleared')

        } catch (error) {
            lastError.value = `清理缓存失败: ${(error as Error).message}`
            console.error('❌ 清理缓存失败:', error)
        } finally {
            isLoading.value = false
        }
    }

    /**
     * 数据更新监听器
     */
    function onBookmarkDataUpdated(globalStats: GlobalStats): void {
        console.log('📊 检测到书签数据更新')

        stats.value = {
            bookmarks: globalStats.totalBookmarks,
            folders: globalStats.totalFolders
        }

        // 如果有搜索查询，重新执行搜索
        if (hasSearchQuery.value) {
            performSearch(searchQuery.value)
        }
    }

    /**
     * 打开书签
     */
    async function openBookmark(bookmark: SearchResult, inNewTab: boolean = false): Promise<void> {
        if (!bookmark.url) return

        try {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                if (inNewTab) {
                    await chrome.tabs.create({ url: bookmark.url })
                } else {
                    await chrome.tabs.update({ url: bookmark.url })
                }
            } else {
                // 开发环境或不支持Chrome API时
                window.open(bookmark.url, inNewTab ? '_blank' : '_self')
            }

            performanceMonitor.trackUserAction('bookmark_opened', {
                inNewTab,
                fromSearch: true,
                domain: bookmark.domain
            })

        } catch (error) {
            console.error('打开书签失败:', error)
        }
    }

    /**
     * 获取数据库信息（用于调试）
     */
    async function getDatabaseInfo(): Promise<{
        bookmarkCount: number
        searchHistoryCount: number
        settingsCount: number
        estimatedSize: number
    }> {
        return await bookmarkManager.getDatabaseInfo()
    }

    // ==================== 监听器设置 ====================

    // 监听搜索查询变化
    watch(searchQuery, (newQuery) => {
        if (newQuery.trim().length === 0) {
            searchResults.value = []
            searchUIState.value.hasSearchResults = false
            showSearchHistory.value = false
        } else {
            showSearchHistory.value = true
        }
    })

    // ==================== 返回公共接口 ====================

    return {
        // 状态
        isLoading,
        lastError,
        currentTabUrl,
        currentTabTitle,
        currentTabId,
        stats,
        searchQuery,
        searchMode,
        searchResults,
        searchUIState,
        searchProgress,
        searchHistory,
        showSearchHistory,
        performanceStats,

        // 计算属性
        hasCurrentTab,
        hasSearchQuery,
        hasSearchResults,
        totalItems,
        searchProgressPercent,
        filteredSearchHistory,

        // 方法
        initialize,
        getCurrentTab,
        loadBookmarkStats,
        performSearch,
        performFastSearch,
        performSmartSearch,
        clearSearchResults,
        loadSearchHistory,
        addToSearchHistory,
        clearSearchHistory,
        clearCache,
        openBookmark,
        getDatabaseInfo
    }
})
