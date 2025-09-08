/**
 * Popup弹窗状态管理Store
 * 管理Chrome扩展弹窗的所有状态
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { performanceMonitor } from '../utils/performance-monitor'

// 类型定义
export interface BookmarkStats {
  bookmarks: number
  folders: number
}

export interface SearchUIState {
  showDropdown: boolean
  showHistory: boolean
  selectedIndex: number
  lastUpdate: number
}

export interface SearchProgress {
  current: number
  total: number
  stage: string
  message: string
}

/**
 * Popup状态管理Store
 */
export const usePopupStore = defineStore('popup', () => {
  // === 状态 ===
  
  // Chrome标签页状态
  const currentTab = ref<chrome.tabs.Tab | null>(null)
  
  // 书签统计
  const stats = ref<BookmarkStats>({ bookmarks: 0, folders: 0 })
  const lastProcessedInfo = ref('尚未进行过AI整理')
  
  // 缓存清理状态
  const isClearingCache = ref(false)
  
  // 搜索功能状态
  const searchQuery = ref('')
  const searchResults = ref<any[]>([])
  const isSearching = ref(false)
  const searchMode = ref<'fast' | 'smart'>('fast')
  const showSearchModeMenu = ref(false)
  const isAIProcessing = ref(false)
  const aiSearchError = ref('')
  
  // 搜索进度状态
  const searchProgress = ref<SearchProgress>({
    current: 0,
    total: 0,
    stage: '',
    message: ''
  })
  const isSearchDisabled = ref(false)
  const searchAbortController = ref<AbortController | null>(null)
  
  // 搜索UI状态
  const searchUIState = ref<SearchUIState>({
    showDropdown: false,
    showHistory: false,
    selectedIndex: -1,
    lastUpdate: 0
  })
  const selectedIndex = ref(-1)
  const maxDropdownItems = 5
  const searchInput = ref<any>(null)
  
  // 搜索历史
  const searchHistory = ref<string[]>([])
  
  // === 计算属性 ===
  
  // 搜索结果显示数量
  const displayResults = computed(() => {
    return searchResults.value.slice(0, maxDropdownItems)
  })
  
  // 是否有搜索结果
  const hasSearchResults = computed(() => {
    return searchResults.value.length > 0
  })
  
  // 搜索进度百分比
  const searchProgressPercent = computed(() => {
    if (searchProgress.value.total === 0) return 0
    return Math.round((searchProgress.value.current / searchProgress.value.total) * 100)
  })
  
  // 是否可以搜索
  const canSearch = computed(() => {
    return !isSearching.value && !isSearchDisabled.value && searchQuery.value.trim().length > 0
  })
  
  // 当前标签页URL
  const currentTabUrl = computed(() => {
    return currentTab.value?.url || ''
  })
  
  // 当前标签页标题
  const currentTabTitle = computed(() => {
    return currentTab.value?.title || ''
  })
  
  // === 动作 ===
  
  /**
   * 获取当前活动标签页
   */
  async function getCurrentTab(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs.length > 0) {
          currentTab.value = tabs[0]
          
          performanceMonitor.trackUserAction('current_tab_loaded', {
            url: tabs[0].url,
            title: tabs[0].title
          })
        }
      }
    } catch (error) {
      console.error('获取当前标签页失败:', error)
    }
  }
  
  /**
   * 获取书签统计
   */
  async function loadBookmarkStats(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const tree = await chrome.bookmarks.getTree()
        let bookmarkCount = 0
        let folderCount = 0
        
        function countNodes(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
          nodes.forEach(node => {
            if (node.url) {
              bookmarkCount++
            } else {
              folderCount++
            }
            
            if (node.children) {
              countNodes(node.children)
            }
          })
        }
        
        countNodes(tree)
        
        stats.value = {
          bookmarks: bookmarkCount,
          folders: folderCount
        }
        
        performanceMonitor.trackUserAction('bookmark_stats_loaded', {
          bookmarks: bookmarkCount,
          folders: folderCount
        })
      }
    } catch (error) {
      console.error('加载书签统计失败:', error)
    }
  }
  
  /**
   * 执行搜索
   */
  async function performSearch(query: string = searchQuery.value): Promise<void> {
    if (!query.trim() || isSearching.value) return
    
    isSearching.value = true
    aiSearchError.value = ''
    searchResults.value = []
    
    try {
      await performanceMonitor.measureAIAnalysis(async () => {
        // 更新搜索进度
        updateSearchProgress(0, 100, 'initializing', '正在初始化搜索...')
        
        // 模拟搜索过程
        if (searchMode.value === 'fast') {
          await performFastSearch(query)
        } else {
          await performSmartSearch(query)
        }
        
        // 添加到搜索历史
        addToSearchHistory(query)
        
        updateSearchProgress(100, 100, 'completed', '搜索完成')
        
      }, searchResults.value.length, 'popup_search')
      
    } catch (error) {
      aiSearchError.value = `搜索失败: ${(error as Error).message}`
      console.error('搜索失败:', error)
    } finally {
      isSearching.value = false
    }
  }
  
  /**
   * 快速搜索
   */
  async function performFastSearch(query: string): Promise<void> {
    updateSearchProgress(25, 100, 'fast_search', '正在进行快速搜索...')
    
    // 模拟快速搜索
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 模拟搜索结果
    searchResults.value = [
      {
        id: '1',
        title: `${query} - 相关结果1`,
        url: `https://example.com/search?q=${query}`,
        snippet: `包含关键词"${query}"的内容片段...`
      },
      {
        id: '2',
        title: `${query} - 相关结果2`,
        url: `https://docs.example.com/${query}`,
        snippet: `关于${query}的详细文档和说明...`
      }
    ]
    
    updateSearchProgress(100, 100, 'fast_search', '快速搜索完成')
  }
  
  /**
   * 智能搜索
   */
  async function performSmartSearch(query: string): Promise<void> {
    updateSearchProgress(25, 100, 'smart_search', '正在进行AI语义分析...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    updateSearchProgress(50, 100, 'smart_search', '正在匹配相关书签...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    updateSearchProgress(75, 100, 'smart_search', '正在优化搜索结果...')
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 模拟AI智能搜索结果
    searchResults.value = [
      {
        id: '1',
        title: `${query} - AI推荐结果1`,
        url: `https://ai-search.example.com/${query}`,
        snippet: `基于AI语义理解，为您推荐关于"${query}"的最相关内容...`,
        confidence: 0.95
      },
      {
        id: '2',
        title: `${query} - AI推荐结果2`,
        url: `https://smart.example.com/${query}`,
        snippet: `智能分析您的浏览历史，推荐与"${query}"相关的优质内容...`,
        confidence: 0.87
      }
    ]
    
    updateSearchProgress(100, 100, 'smart_search', '智能搜索完成')
  }
  
  /**
   * 更新搜索进度
   */
  function updateSearchProgress(
    current: number, 
    total: number, 
    stage: string, 
    message: string
  ): void {
    searchProgress.value = {
      current,
      total,
      stage,
      message
    }
  }
  
  /**
   * 添加到搜索历史
   */
  function addToSearchHistory(query: string): void {
    if (!query.trim()) return
    
    // 移除重复项
    const index = searchHistory.value.indexOf(query)
    if (index > -1) {
      searchHistory.value.splice(index, 1)
    }
    
    // 添加到开头
    searchHistory.value.unshift(query)
    
    // 限制历史记录数量
    if (searchHistory.value.length > 10) {
      searchHistory.value = searchHistory.value.slice(0, 10)
    }
    
    // 保存到本地存储
    saveSearchHistory()
  }
  
  /**
   * 保存搜索历史到本地存储
   */
  async function saveSearchHistory(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          search_history: searchHistory.value
        })
      }
    } catch (error) {
      console.error('保存搜索历史失败:', error)
    }
  }
  
  /**
   * 加载搜索历史
   */
  async function loadSearchHistory(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['search_history'])
        if (result.search_history) {
          searchHistory.value = result.search_history
        }
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error)
    }
  }
  
  /**
   * 清除搜索结果
   */
  function clearSearchResults(): void {
    searchResults.value = []
    searchQuery.value = ''
    aiSearchError.value = ''
  }
  
  /**
   * 取消搜索
   */
  function cancelSearch(): void {
    if (searchAbortController.value) {
      searchAbortController.value.abort()
      searchAbortController.value = null
    }
    
    isSearching.value = false
    updateSearchProgress(0, 0, '', '')
  }
  
  /**
   * 更新UI状态
   */
  function updateUIState(updates: Partial<SearchUIState>): void {
    searchUIState.value = {
      ...searchUIState.value,
      ...updates,
      lastUpdate: Date.now()
    }
  }
  
  /**
   * 清理缓存
   */
  async function clearCache(): Promise<void> {
    if (isClearingCache.value) return
    
    isClearingCache.value = true
    
    try {
      // 清理搜索历史
      searchHistory.value = []
      
      // 清理本地存储
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.clear()
      }
      
      performanceMonitor.trackUserAction('cache_cleared')
      
    } catch (error) {
      console.error('清理缓存失败:', error)
    } finally {
      isClearingCache.value = false
    }
  }
  
  /**
   * 初始化Popup状态
   */
  async function initialize(): Promise<void> {
    console.log('PopupStore初始化开始...')
    
    // 简化初始化逻辑，移除复杂的超时机制
    try {
      // 并行执行初始化任务，但使用allSettled确保不会因单个失败而中断
      const results = await Promise.allSettled([
        getCurrentTab().catch(e => {
          console.warn('获取当前标签失败:', e)
          return null
        }),
        loadBookmarkStats().catch(e => {
          console.warn('加载书签统计失败:', e)
          return null
        }),
        loadSearchHistory().catch(e => {
          console.warn('加载搜索历史失败:', e)
          return null
        })
      ])
      
      console.log('初始化任务完成状态:', results.map(r => r.status))
      
      // 确保基本状态有效
      if (!currentTab.value) {
        currentTab.value = { id: -1, url: '', title: '未知页面' } as chrome.tabs.Tab
      }
      if (!stats.value || (stats.value.bookmarks === 0 && stats.value.folders === 0)) {
        console.log('使用默认统计数据')
        stats.value = { bookmarks: 0, folders: 0 }
      }
      
      console.log('PopupStore状态:', {
        hasTab: !!currentTab.value,
        bookmarks: stats.value.bookmarks,
        folders: stats.value.folders,
        historyCount: searchHistory.value.length
      })
      
    } catch (error) {
      console.error('初始化过程出错:', error)
      // 设置最基本的默认状态
      currentTab.value = { id: -1, url: '', title: '未知页面' } as chrome.tabs.Tab
      stats.value = { bookmarks: 0, folders: 0 }
      searchHistory.value = []
    }
    
    // 性能监控（非关键，失败不影响初始化）
    try {
      performanceMonitor.trackUserAction('popup_initialized', {
        has_tab: !!currentTab.value,
        bookmark_count: stats.value.bookmarks,
        history_count: searchHistory.value.length
      })
    } catch (error) {
      console.warn('性能监控失败，忽略:', error)
    }
    
    console.log('PopupStore初始化完成')
  }
  
  // 监听搜索查询变化
  watch(searchQuery, (newQuery) => {
    if (!newQuery.trim()) {
      clearSearchResults()
    }
  })
  
  // 返回公共API
  return {
    // 状态
    currentTab,
    stats,
    lastProcessedInfo,
    isClearingCache,
    searchQuery,
    searchResults,
    isSearching,
    searchMode,
    showSearchModeMenu,
    isAIProcessing,
    aiSearchError,
    searchProgress,
    isSearchDisabled,
    searchUIState,
    selectedIndex,
    maxDropdownItems,
    searchInput,
    searchHistory,
    
    // 计算属性
    displayResults,
    hasSearchResults,
    searchProgressPercent,
    canSearch,
    currentTabUrl,
    currentTabTitle,
    
    // 动作
    getCurrentTab,
    loadBookmarkStats,
    performSearch,
    performFastSearch,
    performSmartSearch,
    updateSearchProgress,
    addToSearchHistory,
    saveSearchHistory,
    loadSearchHistory,
    clearSearchResults,
    cancelSearch,
    updateUIState,
    clearCache,
    initialize
  }
})
