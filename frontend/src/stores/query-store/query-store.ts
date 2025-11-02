/**
 * 搜索功能 Store
 * 负责书签搜索、搜索历史、搜索统计等功能
 *
 * 🔴 Session Storage Migration:
 * - `searchHistory` 已迁移到 chrome.storage.session（会话级搜索历史）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { modernStorage } from '@/infrastructure/storage/modern-storage'

export interface SearchResult {
  id: string
  title: string
  url: string
  path: string
  score: number
  matchedFields: string[]
}

export interface SearchHistoryItem {
  query: string
  timestamp: number
  resultCount: number
}

export interface SearchStatistics {
  totalSearches: number
  averageResultCount: number
  mostSearchedTerms: string[]
  searchPerformance: {
    averageTime: number
    totalTime: number
  }
}

/**
 * Session Storage 键位常量
 */
const SESSION_KEYS = {
  SEARCH_HISTORY: 'search_history' // 🔴 迁移：搜索历史（会话级别）
} as const

/**
 * Local Storage 键位常量（持久化用户设置）
 */
const LOCAL_KEYS = {
  SEARCH_SETTINGS: 'search_settings' // 🟢 迁移：搜索设置（用户偏好）
} as const

export const useQueryStore = defineStore('query', () => {
  // === 搜索状态 ===
  const searchQuery = ref('')
  const searchResults = ref<SearchResult[]>([])
  const isSearching = ref(false)
  const searchProgress = ref(0)
  const hasSearchResults = ref(false)
  const searchError = ref<string | null>(null)

  // === 搜索历史（从 session storage 加载） ===
  const searchHistory = ref<SearchHistoryItem[]>([])
  const maxHistoryItems = 50

  // 🔴 初始化时从 session storage 读取
  const loadSearchHistory = async () => {
    try {
      const history = await modernStorage.getSession<SearchHistoryItem[]>(
        SESSION_KEYS.SEARCH_HISTORY,
        []
      )
      searchHistory.value = history ?? []
      logger.debug(
        'QueryStore',
        `搜索历史已加载: ${searchHistory.value.length} 条`
      )
    } catch (error) {
      logger.error('QueryStore', '加载搜索历史失败', error)
      searchHistory.value = []
    }
  }

  // 立即加载
  loadSearchHistory().catch(err => {
    logger.warn('QueryStore', '搜索历史初始化失败', err)
  })

  // === 搜索统计 ===
  const searchStatistics = ref<SearchStatistics>({
    totalSearches: 0,
    averageResultCount: 0,
    mostSearchedTerms: [],
    searchPerformance: {
      averageTime: 0,
      totalTime: 0
    }
  })

  // === 搜索设置（从 chrome.storage.local 加载） ===
  const defaultSearchSettings = {
    caseSensitive: false,
    includeUrl: true,
    includeTitle: true,
    includePath: true,
    maxResults: 100,
    fuzzySearch: true,
    highlightMatches: true
  }

  const searchSettings = ref({ ...defaultSearchSettings })

  // 🟢 初始化时从 local storage 读取
  const loadSearchSettings = async () => {
    try {
      const settings = await modernStorage.getLocal<
        typeof defaultSearchSettings
      >(LOCAL_KEYS.SEARCH_SETTINGS, defaultSearchSettings)
      searchSettings.value = { ...defaultSearchSettings, ...(settings ?? {}) }
      logger.debug('QueryStore', '✅ 搜索设置已从 local storage 恢复', settings)
    } catch (error) {
      logger.error('QueryStore', '加载搜索设置失败', error)
      searchSettings.value = { ...defaultSearchSettings }
    }
  }

  // 立即加载
  loadSearchSettings().catch(err => {
    logger.warn('QueryStore', '搜索设置初始化失败', err)
  })

  /**
   * 🟢 保存搜索设置到 chrome.storage.local（用户偏好）
   */
  const saveSearchSettings = async () => {
    try {
      await modernStorage.setLocal(
        LOCAL_KEYS.SEARCH_SETTINGS,
        searchSettings.value
      )
      logger.debug('QueryStore', '搜索设置已保存', searchSettings.value)
    } catch (error) {
      logger.warn('QueryStore', '保存搜索设置失败', error)
    }
  }

  // === 计算属性 ===
  const recentSearches = computed(() => {
    return searchHistory.value
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
  })

  const searchPerformance = computed(() => {
    return {
      isSearching: isSearching.value,
      progress: searchProgress.value,
      hasResults: hasSearchResults.value,
      resultCount: searchResults.value.length
    }
  })

  const topSearchTerms = computed(() => {
    const termCounts = new Map<string, number>()

    searchHistory.value.forEach(item => {
      const term = item.query.toLowerCase().trim()
      if (term) {
        termCounts.set(term, (termCounts.get(term) || 0) + 1)
      }
    })

    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, count]) => ({ term, count }))
  })

  // === Actions ===

  /**
   * 执行搜索
   */
  const search = async (query: string) => {
    try {
      if (!query.trim()) {
        searchResults.value = []
        hasSearchResults.value = false
        return
      }

      isSearching.value = true
      searchProgress.value = 0
      searchError.value = null
      searchQuery.value = query

      const startTime = performance.now()

      // 模拟搜索进度

      // 模拟搜索结果
      const results: SearchResult[] = [
        {
          id: '1',
          title: `搜索结果: ${query}`,
          url: 'https://example.com',
          path: '示例路径',
          score: 0.95,
          matchedFields: ['title']
        }
      ]

      const endTime = performance.now()

      searchResults.value = results
      hasSearchResults.value = results.length > 0
      isSearching.value = false
      searchProgress.value = 100

      // 添加到搜索历史
      addToSearchHistory(query, results.length)

      // 更新统计信息
      updateSearchStatistics(endTime - startTime, results.length)

      logger.info('Search', '搜索完成', {
        query,
        resultCount: results.length,
        searchTime: `${(endTime - startTime).toFixed(2)}ms`
      })
    } catch (error) {
      isSearching.value = false
      searchError.value = error instanceof Error ? error.message : '搜索失败'
      logger.error('Search', '搜索失败', error)
      throw error
    }
  }

  /**
   * 快速搜索（使用缓存）
   */
  const quickSearch = async (query: string) => {
    try {
      if (!query.trim()) {
        searchResults.value = []
        hasSearchResults.value = false
        return
      }

      // 模拟快速搜索结果
      const results: SearchResult[] = [
        {
          id: '1',
          title: `快速搜索: ${query}`,
          url: 'https://example.com',
          path: '示例路径',
          score: 0.9,
          matchedFields: ['title']
        }
      ]

      searchResults.value = results
      hasSearchResults.value = results.length > 0
      searchQuery.value = query

      logger.info('Search', '快速搜索完成', {
        query,
        resultCount: results.length
      })
    } catch (error) {
      logger.error('Search', '快速搜索失败', error)
      throw error
    }
  }

  /**
   * 清空搜索结果
   */
  const clearSearchResults = () => {
    searchResults.value = []
    hasSearchResults.value = false
    searchQuery.value = ''
    searchError.value = null
    logger.info('Search', '搜索结果已清空')
  }

  /**
   * 添加到搜索历史（同步到 session storage）
   */
  const addToSearchHistory = async (query: string, resultCount: number) => {
    const historyItem: SearchHistoryItem = {
      query: query.trim(),
      timestamp: Date.now(),
      resultCount
    }

    // 避免重复添加相同的查询
    const existingIndex = searchHistory.value.findIndex(
      item => item.query.toLowerCase() === query.toLowerCase()
    )

    if (existingIndex >= 0) {
      searchHistory.value[existingIndex] = historyItem
    } else {
      searchHistory.value.unshift(historyItem)
    }

    // 限制历史记录数量
    if (searchHistory.value.length > maxHistoryItems) {
      searchHistory.value = searchHistory.value.slice(0, maxHistoryItems)
    }

    // 🔴 同步到 session storage
    try {
      await modernStorage.setSession(
        SESSION_KEYS.SEARCH_HISTORY,
        searchHistory.value
      )
      logger.debug('Search', '搜索历史已更新并同步', { query, resultCount })
    } catch (error) {
      logger.error('Search', '同步搜索历史失败', error)
    }
  }

  /**
   * 更新搜索统计信息
   */
  const updateSearchStatistics = (searchTime: number, resultCount: number) => {
    const stats = searchStatistics.value
    stats.totalSearches++
    stats.searchPerformance.totalTime += searchTime
    stats.searchPerformance.averageTime =
      stats.searchPerformance.totalTime / stats.totalSearches
    stats.averageResultCount =
      (stats.averageResultCount * (stats.totalSearches - 1) + resultCount) /
      stats.totalSearches

    // 更新最常搜索的术语
    const termCounts = new Map<string, number>()
    searchHistory.value.forEach(item => {
      const term = item.query.toLowerCase().trim()
      if (term) {
        termCounts.set(term, (termCounts.get(term) || 0) + 1)
      }
    })

    stats.mostSearchedTerms = Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term)
  }

  /**
   * 更新搜索设置
   */
  const updateSearchSettings = (
    settings: Partial<typeof searchSettings.value>
  ) => {
    searchSettings.value = { ...searchSettings.value, ...settings }
    logger.info('Search', '搜索设置已更新', settings)
    // 🟢 保存到 local storage
    saveSearchSettings().catch(err => {
      logger.warn('QueryStore', '保存搜索设置失败', err)
    })
  }

  /**
   * 清空搜索历史（同步到 session storage）
   */
  const clearSearchHistory = async () => {
    searchHistory.value = []

    // 🔴 清空 session storage
    try {
      await modernStorage.setSession(SESSION_KEYS.SEARCH_HISTORY, [])
      logger.info('Search', '搜索历史已清空并同步')
    } catch (error) {
      logger.error('Search', '清空搜索历史失败', error)
    }
  }

  /**
   * 获取搜索统计信息
   */
  const getSearchStatistics = () => {
    return {
      ...searchStatistics.value,
      recentSearches: recentSearches.value,
      topSearchTerms: topSearchTerms.value
    }
  }

  return {
    // State
    searchQuery,
    searchResults,
    isSearching,
    searchProgress,
    hasSearchResults,
    searchError,
    searchHistory,
    searchStatistics,
    searchSettings,

    // Computed
    recentSearches,
    searchPerformance,
    topSearchTerms,

    // Actions
    search,
    quickSearch,
    clearSearchResults,
    updateSearchSettings,
    clearSearchHistory,
    getSearchStatistics
  }
})
