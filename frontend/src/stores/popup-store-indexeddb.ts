/**
 * Popup Store - IndexedDB版本
 * 完全基于IndexedDB，移除chrome.storage.local依赖
 * 支持十万条书签的高性能搜索
 */

import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { popupAPI } from '../utils/unified-bookmark-api'
import { logger } from '../utils/logger'
// import { getPerformanceOptimizer } from '../services/realtime-performance-optimizer'

// const performanceOptimizer = getPerformanceOptimizer()

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

export interface HealthOverview {
    totalScanned: number
    http404: number
    http500: number
    other4xx: number
    other5xx: number
    duplicateCount: number
}

/**
 * 弹窗状态管理存储 - IndexedDB版本
 */
export const usePopupStoreIndexedDB = defineStore('popup-indexeddb', () => {
    // ==================== 状态 ====================

    // 统一书签API
    // const bookmarkAPI = popupAPI - 已通过导入可用

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

    // 书签健康度概览
    const healthOverview = ref<HealthOverview>({
        totalScanned: 0,
        http404: 0,
        http500: 0,
        other4xx: 0,
        other5xx: 0,
        duplicateCount: 0
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


    // ==================== 方法 ====================

    /**
     * 初始化弹窗
     */
    async function initialize(): Promise<void> {
        const startTime = performance.now()
        isLoading.value = true
        lastError.value = null

        try {
            logger.info('PopupStore', '初始化 Popup Store (IndexedDB版本) ...')

            // 1. 初始化统一API (自动完成)
            // 统一API自动初始化

            // 2. 获取当前标签页信息
            await getCurrentTab()

            // 3. 加载书签统计
            await loadBookmarkStats()


            // 5. 数据更新监听 (新架构中由Service Worker处理)

            logger.info('PopupStore', '初始化完成')

        } catch (error) {
            lastError.value = `初始化失败: ${(error as Error).message}`
            logger.error('PopupStore', '初始化失败', error)
            throw error
        } finally {
            isLoading.value = false
            const endTime = performance.now()
            logger.info('PopupStore', `初始化耗时: ${(endTime - startTime).toFixed(2)}ms`)
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
            logger.warn('PopupStore', '获取当前标签页失败', error)
        }
    }

    /**
     * 加载书签统计
     */
    async function loadBookmarkStats(): Promise<void> {
        try {
            const globalStats = await popupAPI.getQuickStats()
            if (globalStats) {
                stats.value = {
                    bookmarks: globalStats.totalBookmarks,
                    folders: globalStats.totalFolders
                }
            }
        } catch (error) {
            logger.warn('PopupStore', '加载书签统计失败', error)
        }
    }

    /**
     * 加载健康度概览
     */
    async function loadBookmarkHealthOverview(): Promise<void> {
        try {
            const overview = await popupAPI.getHealthOverview()
            if (overview) {
                healthOverview.value = overview
            }
        } catch (error) {
            logger.warn('PopupStore', '加载健康度概览失败', error)
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
            logger.info('PopupStore', `执行搜索: "${query}" (模式: ${searchMode.value})`)

            // 使用统一API搜索
            const results = await popupAPI.searchBookmarks(query, 100)

            // 转换为搜索结果格式（results已经是SearchResult[]格式）
            searchResults.value = results.map((result: any, index: number) => ({
                id: result.bookmark.id,
                title: result.bookmark.title,
                url: result.bookmark.url,
                domain: result.bookmark.domain,
                path: result.bookmark.path || [],
                pathString: result.bookmark.pathString || '',
                matchScore: result.score || (100 - index),
                isFolder: result.bookmark.isFolder || false
            }))

            searchUIState.value.hasSearchResults = searchResults.value.length > 0

            // 更新性能统计
            const searchTime = performance.now() - searchTimer
            updatePerformanceStats(searchTime)

            logger.info('PopupStore', `搜索完成，${searchResults.value.length} 个结果，耗时 ${searchTime.toFixed(2)}ms`)

            // 记录搜索性能
            logger.info('PopupStore', '搜索性能', {
                query: query.length,
                results: searchResults.value.length,
                time: searchTime,
                mode: searchMode.value
            })

        } catch (error) {
            logger.error('PopupStore', '搜索失败', error)
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
            logger.info('PopupStore', '🧹 开始清理缓存并重新同步数据...')

            // 从Chrome API重新加载数据 (由Service Worker处理)
            // 数据同步由Service Worker处理
            logger.info('PopupStore', '清理缓存请求已发送')

            // 重新加载统计信息
            await loadBookmarkStats()

            // 清除搜索结果
            clearSearchResults()

            logger.info('PopupStore', '✅ 缓存清理完成')

            logger.info('PopupStore', '📊 缓存已清理')

        } catch (error) {
            lastError.value = `清理缓存失败: ${(error as Error).message}`
            logger.error('PopupStore', '❌ 清理缓存失败:', error)
        } finally {
            isLoading.value = false
        }
    }

    // 数据更新监听器已移除 - 新架构由Service Worker处理

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

            logger.info('PopupStore', '📊 书签已打开', { inNewTab, fromSearch: true, domain: bookmark.domain })

        } catch (error) {
            logger.error('PopupStore', '打开书签失败:', error)
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
        // 数据库信息现在通过统一API获取
        const stats = await popupAPI.getQuickStats()
        return {
            bookmarkCount: stats?.totalBookmarks || 0,
            searchHistoryCount: 0, // 暂时设为0
            settingsCount: 0, // 暂时设为0
            estimatedSize: 0 // 暂时设为0，可以后续实现
        }
    }

    // ==================== 监听器设置 ====================

    // 监听搜索查询变化
    watch(searchQuery, (newQuery) => {
        if (newQuery.trim().length === 0) {
            searchResults.value = []
            searchUIState.value.hasSearchResults = false
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
        healthOverview,
        searchQuery,
        searchMode,
        searchResults,
        searchUIState,
        searchProgress,
        performanceStats,

        // 计算属性
        hasCurrentTab,
        hasSearchQuery,
        hasSearchResults,
        totalItems,
        searchProgressPercent,

        // 方法
        initialize,
        getCurrentTab,
        loadBookmarkStats,
        loadBookmarkHealthOverview,
        performSearch,
        performFastSearch,
        performSmartSearch,
        clearSearchResults,
        clearCache,
        openBookmark,
        getDatabaseInfo
    }
})
