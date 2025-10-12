/**
 * 弹窗状态管理 Store（精简版）
 *
 * 职责：
 * - 仅管理弹窗UI状态
 * - 协调Application层服务
 * - 统一错误处理
 *
 * 移除的职责：
 * - 业务逻辑（迁移到Application层）
 * - 数据缓存（由Application层处理）
 * - 复杂的数据处理（由Application层处理）
 */

import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { logger } from '@/infrastructure/logging/logger'
import {
  useErrorHandling,
  withErrorHandling
} from '@/infrastructure/error-handling'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { searchAppService } from '@/application/search/search-app-service'
import { healthAppService } from '@/application/health/health-app-service'
import type {
  BookmarkStats,
  SearchUIState,
  SearchProgress,
  SearchResultItem as SearchResult
} from '@/types/ui/store'
import type { HealthOverview } from '@/types/application/health'

// === 类型定义 (已从 @/types 导入) ===

/**
 * @deprecated 此接口已迁移至 @/types/application/health
 * 请使用 import type { HealthOverview } from '@/types'
 */
export interface HealthOverview_DEPRECATED {
  totalScanned: number
  http404: number
  http500: number
  other4xx: number
  other5xx: number
  duplicateCount: number
}

// === Store 定义 ===

export const usePopupStore = defineStore('popup', () => {
  // === 错误处理 ===
  const { handleError, clearErrors, hasError, userErrorMessage } =
    useErrorHandling()

  // === 状态 ===

  // 加载状态
  const isLoading = ref(false)

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

  // === 计算属性 ===

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
    return Math.round(
      (searchProgress.value.current / searchProgress.value.total) * 100
    )
  })

  // === 核心方法 ===

  /**
   * 初始化弹窗
   */
  const initialize = withErrorHandling(
    async () => {
      const startTime = performance.now()
      isLoading.value = true

      try {
        logger.info('PopupStore', '🚀 初始化弹窗...')

        // 初始化应用服务
        await Promise.all([
          bookmarkAppService.initialize(),
          searchAppService.initialize(),
          healthAppService.initialize()
        ])

        // 获取当前标签页信息
        await getCurrentTab()

        // 加载书签统计
        await loadBookmarkStats()

        logger.info('PopupStore', '✅ 初始化完成')
      } finally {
        isLoading.value = false
        const endTime = performance.now()
        logger.info(
          'PopupStore',
          `⏱️ 初始化耗时: ${(endTime - startTime).toFixed(2)}ms`
        )
      }
    },
    { operation: 'initialize' }
  )

  /**
   * 获取当前标签页信息
   */
  const getCurrentTab = withErrorHandling(
    async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
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
    },
    { operation: 'getCurrentTab' }
  )

  /**
   * 加载书签统计
   */
  const loadBookmarkStats = withErrorHandling(
    async () => {
      const result = await bookmarkAppService.getGlobalStats()

      if (result.ok && result.value) {
        const statsValue = result.value as {
          totalBookmarks: number
          totalFolders: number
        }
        stats.value = {
          bookmarks: statsValue.totalBookmarks || 0,
          folders: statsValue.totalFolders || 0
        }
      }
    },
    { operation: 'loadBookmarkStats' }
  )

  /**
   * 加载健康度概览
   */
  const loadBookmarkHealthOverview = withErrorHandling(
    async () => {
      const result = await healthAppService.getHealthOverview()

      if (result.ok && result.value) {
        healthOverview.value = { ...result.value }
      }
    },
    { operation: 'loadBookmarkHealthOverview' }
  )

  /**
   * 执行搜索
   */
  const performSearch = withErrorHandling(
    async (query: string = searchQuery.value) => {
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
        logger.info(
          'PopupStore',
          `🔍 执行搜索: "${query}" (模式: ${searchMode.value})`
        )

        const result = await searchAppService.search(query, { limit: 100 })

        // 转换为搜索结果格式
        searchResults.value = result.map((searchResult, index: number) => ({
          id: searchResult.bookmark.id,
          title: searchResult.bookmark.title,
          url: searchResult.bookmark.url,
          domain: searchResult.bookmark.domain,
          path: searchResult.bookmark.path || [],
          pathString: searchResult.bookmark.pathString || '',
          matchScore: searchResult.score || 100 - index,
          isFolder: searchResult.bookmark.isFolder || false
        }))

        searchUIState.value.hasSearchResults = searchResults.value.length > 0

        // 更新性能统计
        const searchTime = performance.now() - searchTimer
        updatePerformanceStats(searchTime)

        logger.info(
          'PopupStore',
          `✅ 搜索完成，${searchResults.value.length} 个结果，耗时 ${searchTime.toFixed(2)}ms`
        )
      } finally {
        searchUIState.value.isSearching = false
        searchProgress.value.current = searchProgress.value.total
      }
    },
    { operation: 'performSearch' }
  )

  /**
   * 防抖搜索
   */
  let searchDebounceTimer: number | null = null
  const performSearchDebounced = (
    query: string = searchQuery.value,
    delay = 200
  ) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    searchDebounceTimer = window.setTimeout(
      () => {
        void performSearch(query)
      },
      Math.max(0, delay)
    )
  }

  /**
   * 快速搜索
   */
  const performFastSearch = async (query: string = searchQuery.value) => {
    searchMode.value = 'fast'
    await performSearch(query)
  }

  /**
   * 智能搜索
   */
  const performSmartSearch = async (query: string = searchQuery.value) => {
    searchMode.value = 'smart'
    await performSearch(query)
  }

  /**
   * 清除搜索结果
   */
  const clearSearchResults = () => {
    searchQuery.value = ''
    searchResults.value = []
    searchUIState.value.hasSearchResults = false
  }

  /**
   * 更新性能统计
   */
  const updatePerformanceStats = (searchTime: number) => {
    performanceStats.value.lastSearchTime = searchTime
    performanceStats.value.searchCount += 1

    // 计算平均搜索时间
    const totalTime =
      performanceStats.value.averageSearchTime *
        (performanceStats.value.searchCount - 1) +
      searchTime
    performanceStats.value.averageSearchTime =
      totalTime / performanceStats.value.searchCount
  }

  /**
   * 清理缓存
   */
  const clearCache = withErrorHandling(
    async () => {
      isLoading.value = true

      try {
        logger.info('PopupStore', '🧹 开始清理缓存...')

        // 重新加载统计信息
        await loadBookmarkStats()

        // 清除搜索结果
        clearSearchResults()

        logger.info('PopupStore', '✅ 缓存清理完成')
      } finally {
        isLoading.value = false
      }
    },
    { operation: 'clearCache' }
  )

  /**
   * 打开书签
   */
  const openBookmark = withErrorHandling(
    async (bookmark: SearchResult, inNewTab: boolean = false) => {
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

        logger.info('PopupStore', '📊 书签已打开', {
          inNewTab,
          fromSearch: true,
          domain: bookmark.domain
        })
      } catch (error) {
        logger.error('PopupStore', '打开书签失败:', error)
      }
    },
    { operation: 'openBookmark' }
  )

  /**
   * 获取数据库信息
   */
  const getDatabaseInfo = withErrorHandling(
    async () => {
      const result = await bookmarkAppService.getAllBookmarks()
      return {
        bookmarkCount: result.ok
          ? result.value?.filter(b => !!b.url).length || 0
          : 0,
        searchHistoryCount: 0,
        settingsCount: 0,
        estimatedSize: 0
      }
    },
    { operation: 'getDatabaseInfo' }
  )

  // === 监听器设置 ===

  // 监听搜索查询变化
  watch(searchQuery, (newQuery: string) => {
    if (newQuery.trim().length === 0) {
      searchResults.value = []
      searchUIState.value.hasSearchResults = false
    }
  })

  // === 错误处理 ===

  const handleStoreError = async (error: Error) => {
    await handleError(error, { store: 'popup' })
  }

  const clearStoreErrors = () => {
    clearErrors()
  }

  // === 返回公共接口 ===

  return {
    // 错误状态
    hasError,
    userErrorMessage,

    // 状态
    isLoading,
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
    performSearchDebounced,
    clearSearchResults,
    clearCache,
    openBookmark,
    getDatabaseInfo,

    // 错误处理
    handleStoreError,
    clearStoreErrors
  }
})
