/**
 * SearchPopup搜索弹窗页面状态管理Store
 * 管理搜索弹窗页面的所有状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SearchResult } from '../utils/indexeddb-schema'
// import { getPerformanceOptimizer } from '../services/realtime-performance-optimizer';

// 类型定义
export interface BookmarkStats {
  bookmarks: number
  folders: number
  total: number
}

export interface SearchStats {
  totalBookmarks: number
  searchTime: number
  resultsCount: number
}

/**
 * SearchPopup状态管理Store
 */
export const useSearchPopupStore = defineStore('searchPopup', () => {
  // === 基础状态 ===

  // 书签统计信息
  const stats = ref<BookmarkStats>({ bookmarks: 0, folders: 0, total: 0 });

  // === 搜索状态 ===

  // 搜索关键词
  const searchQuery = ref('');

  // 搜索结果
  const searchResults = ref<SearchResult[]>([]);

  // 搜索中状态
  const isSearching = ref(false);

  // 搜索模式
  const searchMode = ref<'fast' | 'smart'>('fast');

  // 上次搜索信息（用于模式切换优化）
  const lastSearchQuery = ref('');
  const lastSearchMode = ref<'fast' | 'smart'>('fast');

  // 搜索统计信息
  const searchStats = ref<SearchStats>({
    totalBookmarks: 0,
    searchTime: 0,
    resultsCount: 0
  });

  // === UI控制状态 ===

  // 模式选择器显示状态
  const showModeSelector = ref(false);

  // 搜索下拉框显示状态
  const showSearchDropdown = ref(false);

  // 选中的项目索引
  const selectedIndex = ref(-1);

  // 最大下拉项目数量
  const maxDropdownItems = 8;

  // === 搜索历史状态 ===

  // 搜索历史记录
  const searchHistory = ref<string[]>([]);

  // 显示搜索历史
  const showSearchHistory = ref(false);

  // === 输入框状态 ===

  // 搜索输入框引用
  const searchInput = ref<any>(null);

  // 输入框焦点状态
  const isInputFocused = ref(false);

  // === 计算属性 ===

  // 搜索模式选项
  const searchModeOptions = computed(() => [
    { value: 'fast', label: '快速搜索', description: '仅搜索标题和URL' },
    { value: 'smart', label: '智能搜索', description: '模糊匹配和关键词分析' }
  ]);

  // 当前搜索模式信息
  const currentModeInfo = computed(() => {
    return searchModeOptions.value.find(opt => opt.value === searchMode.value);
  });

  // 是否有搜索结果
  const hasSearchResults = computed(() => {
    return searchResults.value.length > 0;
  });

  // 是否有搜索历史
  const hasSearchHistory = computed(() => {
    return searchHistory.value.length > 0;
  });

  // 应该显示什么内容
  const shouldShowDropdown = computed(() => {
    return showSearchDropdown.value || showSearchHistory.value;
  });

  // === 工具函数 ===

  /**
   * 安全的字符串trim
   */
  const safeTrim = (value: any): string => {
    try {
      if (typeof value === 'string') {
        return value.trim();
      }
      if (value && typeof value === 'object' && typeof value.toString === 'function') {
        const strValue = value.toString();
        if (typeof strValue === 'string') {
          return strValue.trim();
        }
      }
      return '';
    } catch {
      return '';
    }
  };

  /**
   * 获取域名
   */
  const getHostname = (url: string): string => {
    try {
      if (!url || typeof url !== 'string') {
        return 'unknown';
      }
      const urlObj = new (window as any).URL(url);
      return urlObj.hostname || 'unknown';
    } catch {
      return url || 'unknown';
    }
  };

  /**
   * 高亮搜索关键词
   */
  const highlightText = (text: string, query: string): string => {
    if (!text || !query || typeof text !== 'string' || typeof query !== 'string') {
      return text || '';
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      return text;
    }

    // Check if text contains the query
    if (lowerText.indexOf(lowerQuery) === -1) {
      // If no direct match, try to find partial matches for better UX
      let highlightedText = text;
      let hasMatch = false;

      // Try to highlight individual characters if they're consecutive in the text
      for (let i = 0; i <= text.length - lowerQuery.length; i++) {
        const substring = text.substr(i, lowerQuery.length).toLowerCase();
        if (substring === lowerQuery) {
          const before = text.substring(0, i);
          const match = text.substr(i, lowerQuery.length);
          const after = text.substring(i + lowerQuery.length);
          highlightedText = `${before}<mark class="highlight">${match}</mark>${after}`;
          hasMatch = true;
          break;
        }
      }

      if (!hasMatch) {
        return text;
      }

      return highlightedText;
    }

    // Create a regex to match the query (case-insensitive)
    const regex = new RegExp(`(${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

    // Replace matches with highlighted spans
    const result = text.replace(regex, '<mark class="highlight">$1</mark>');
    return result;
  };

  // === Actions ===

  /**
   * 初始化SearchPopup数据
   */
  async function initialize(): Promise<void> {
    console.log('SearchPopupStore初始化开始...');

    try {
      const results = await Promise.allSettled([
        loadBookmarkStats().catch(e => {
          console.warn('加载书签统计失败:', e);
          return null;
        }),
        loadSearchHistory().catch(e => {
          console.warn('加载搜索历史失败:', e);
          return null;
        })
      ]);

      console.log('SearchPopup初始化任务完成状态:', results.map(r => r.status));

      // 设置默认值
      if (!stats.value || (stats.value.bookmarks === 0 && stats.value.folders === 0)) {
        console.log('使用默认统计数据');
        stats.value = { bookmarks: 0, folders: 0, total: 0 };
      }

      console.log('SearchPopup状态:', {
        stats: stats.value,
        searchHistoryLength: searchHistory.value.length
      });

    } catch (error) {
      console.error('SearchPopup初始化过程出错:', error);
      // 设置默认值
      stats.value = { bookmarks: 0, folders: 0, total: 0 };
      searchHistory.value = [];
    }

    try {
      console.log('searchPopup_initialized:', {
        bookmarks: stats.value.bookmarks,
        folders: stats.value.folders,
        historyCount: searchHistory.value.length
      });
    } catch (error) {
      console.warn('性能监控失败，忽略:', error);
    }

    console.log('SearchPopupStore初始化完成');
  }

  /**
   * 加载书签统计信息 (从IndexedDB)
   */
  async function loadBookmarkStats(): Promise<void> {
    try {
      console.log('📊 从IndexedDB获取搜索页面统计数据');
      const response = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARK_STATS' });

      if (response?.success) {
        stats.value = {
          bookmarks: response.data.totalBookmarks || 0,
          folders: response.data.totalFolders || 0,
          total: (response.data.totalBookmarks || 0) + (response.data.totalFolders || 0)
        };
        console.log('📊 搜索页面IndexedDB统计完成:', stats.value);
      } else {
        throw new Error('IndexedDB统计数据获取失败');
      }
    } catch (error) {
      console.error('❌ 搜索页面IndexedDB统计获取失败:', error);
      // 设置默认值
      stats.value = { bookmarks: 0, folders: 0, total: 0 };
    }
  }

  /**
   * 统计书签数量
   */
  function countBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkStats {
    let bookmarks = 0;
    let folders = 0;

    for (const node of nodes) {
      if (node.url) {
        bookmarks++;
      } else if (node.children) {
        folders++;
        const childStats = countBookmarks(node.children);
        bookmarks += childStats.bookmarks;
        folders += childStats.folders;
      }
    }

    return { bookmarks, folders, total: bookmarks + folders };
  }

  /**
   * 加载搜索历史
   */
  async function loadSearchHistory(): Promise<void> {
    // 注意：已迁移到IndexedDB，搜索历史通过IndexedDB管理
    return Promise.resolve();
  }

  /**
   * 执行搜索
   */
  async function performSearch(): Promise<void> {
    const query = safeTrim(searchQuery.value);

    if (!query) {
      searchResults.value = [];
      return;
    }

    isSearching.value = true;
    const startTime = Date.now();

    try {
      // 使用统一搜索服务替代直接消息通信
      const searchAPI = await import('../utils/unified-bookmark-api');
      const response = await searchAPI.searchPopupAPI.searchBookmarks(query, {
        limit: 50,
        includeUrl: true,
        includeDomain: true,
        includeKeywords: true,
        includeTags: true
      });

      // 处理搜索结果 - searchPopupAPI.searchBookmarks()直接返回SearchResult[]
      const results = Array.isArray(response) ? response : [];
      searchResults.value = results;

      // 更新搜索统计
      const searchTime = Date.now() - startTime;
      searchStats.value = {
        totalBookmarks: results.length,
        searchTime: searchTime,
        resultsCount: results.length
      };

      // 写入IndexedDB搜索历史（统一API，来源为 search-popup）
      try {
        await searchAPI.unifiedBookmarkAPI.addSearchHistory(query, results.length, searchTime, 'search-popup');
      } catch (e) {
        console.warn('添加搜索历史到IndexedDB失败:', e);
      }

      // 控制下拉框显示
      const currentQuery = safeTrim(searchQuery.value);
      if (!currentQuery) {
        showSearchDropdown.value = false;
        selectedIndex.value = -1;

        // 检查是否显示历史
        const shouldShowHistory = isInputFocused.value &&
          Array.isArray(searchHistory.value) &&
          searchHistory.value.length > 0;
        showSearchHistory.value = shouldShowHistory;
      } else {
        const shouldShowDropdown = searchResults.value.length > 0 || !!currentQuery;
        showSearchDropdown.value = shouldShowDropdown;
        selectedIndex.value = -1;
        showSearchHistory.value = false;
      }

      // 添加到搜索历史（仅用于本地UI显示，不持久化）
      if (searchResults.value.length > 0 && query && typeof query === 'string') {
        await addToSearchHistory(query);
      }

    } catch (error) {
      console.error('搜索失败:', error);
      searchResults.value = [];
      // 保持下拉框显示以显示错误信息
      showSearchDropdown.value = !!safeTrim(searchQuery.value);
      selectedIndex.value = -1;
    } finally {
      isSearching.value = false;

      // 更新最后搜索记录
      const currentQuery = safeTrim(searchQuery.value);
      if (currentQuery && searchResults.value.length >= 0) {
        lastSearchQuery.value = currentQuery;
        lastSearchMode.value = searchMode.value;
      }
    }
  }

  /**
   * 添加到搜索历史
   */
  async function addToSearchHistory(query: string): Promise<void> {
    try {
      if (Array.isArray(searchHistory.value)) {
        const historyArray = searchHistory.value as string[];
        if (!historyArray.includes(query)) {
          historyArray.unshift(query);
          // 保持最多10条搜索记录
          if (historyArray.length > 10) {
            searchHistory.value = historyArray.slice(0, 10);
          } else {
            searchHistory.value = historyArray;
          }
          // 注意：已迁移到IndexedDB，搜索历史通过IndexedDB管理
        }
      } else {
        // 重置搜索历史
        searchHistory.value = [query];
        // 注意：已迁移到IndexedDB，搜索历史通过IndexedDB管理
      }
    } catch {
      // 重置为空数组
      searchHistory.value = [];
    }
  }

  /**
   * 处理搜索输入
   */
  function handleSearchInput(): void {
    try {
      const query = safeTrim(searchQuery.value);

      if (!query) {
        // 显示搜索历史
        if (isInputFocused.value && Array.isArray(searchHistory.value) && searchHistory.value.length > 0) {
          showSearchHistory.value = true;
          showSearchDropdown.value = false;
        } else {
          showSearchHistory.value = false;
          showSearchDropdown.value = false;
        }
        return;
      }

      // 隐藏历史，准备显示搜索结果
      showSearchHistory.value = false;
      searchResults.value = [];
      showSearchDropdown.value = false;
      selectedIndex.value = -1;

      // 立即显示下拉框
      if (query.length >= 1) {
        showSearchDropdown.value = true;
      }

    } catch {
      searchResults.value = [];
      showSearchDropdown.value = false;
      showSearchHistory.value = false;
      selectedIndex.value = -1;
    }
  }

  /**
   * 处理搜索焦点
   */
  function handleSearchFocus(): void {
    isInputFocused.value = true;

    try {
      const currentQuery = safeTrim(searchQuery.value);

      if (!currentQuery) {
        // 显示搜索历史
        if (Array.isArray(searchHistory.value) && searchHistory.value.length > 0) {
          showSearchHistory.value = true;
          showSearchDropdown.value = false;
        } else {
          showSearchHistory.value = false;
          showSearchDropdown.value = false;
        }
      } else {
        // 显示搜索结果
        if (Array.isArray(searchResults.value) && searchResults.value.length > 0) {
          showSearchHistory.value = false;
          showSearchDropdown.value = true;
        } else {
          showSearchHistory.value = false;
          showSearchDropdown.value = false;
        }
      }
    } catch {
      showSearchHistory.value = false;
      showSearchDropdown.value = false;
    }
  }

  /**
   * 处理搜索失焦
   */
  function handleSearchBlur(): void {
    isInputFocused.value = false;

    // 延迟隐藏以允许点击下拉项
    setTimeout(() => {
      if (!isInputFocused.value) {
        showSearchDropdown.value = false;
        showSearchHistory.value = false;
        selectedIndex.value = -1;
      }
    }, 200);
  }

  /**
   * 处理搜索模式变化
   */
  function handleModeChange(newMode: string): void {
    if (searchMode.value === newMode) return;

    const currentQuery = safeTrim(searchQuery.value);

    // 如果有当前搜索且与上次不同，则重新搜索
    if (currentQuery && (currentQuery !== lastSearchQuery.value || searchMode.value !== lastSearchMode.value)) {
      searchMode.value = newMode as 'fast' | 'smart';
      performSearch();
    } else {
      // 只更新模式
      searchMode.value = newMode as 'fast' | 'smart';
    }

    // 更新最后搜索记录
    lastSearchQuery.value = currentQuery;
    lastSearchMode.value = newMode as 'fast' | 'smart';
    showModeSelector.value = false;
  }

  /**
   * 打开书签
   */
  function openBookmark(result: SearchResult): void {
    const url = result?.bookmark?.url;
    if (url && typeof url === 'string') {
      chrome.tabs.create({ url });
      // 关闭搜索弹窗
      window.close();
    }
  }

  /**
   * 处理键盘导航
   */
  function handleKeyboardNavigation(event: KeyboardEvent): void {
    if (!showSearchDropdown.value && !showSearchHistory.value) return;

    const dropdownResults: SearchResult[] = showSearchDropdown.value
      ? searchResults.value.slice(0, maxDropdownItems)
      : [];
    const historyResults: string[] = showSearchHistory.value
      ? searchHistory.value.slice(0, maxDropdownItems)
      : [];

    const activeLength = showSearchDropdown.value
      ? dropdownResults.length
      : showSearchHistory.value
      ? historyResults.length
      : 0;
    const maxIndex = activeLength - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (selectedIndex.value < maxIndex) {
          selectedIndex.value++;
        } else if (selectedIndex.value === -1 && maxIndex >= 0) {
          selectedIndex.value = 0;
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (selectedIndex.value > 0) {
          selectedIndex.value--;
        } else if (selectedIndex.value === 0) {
          selectedIndex.value = -1;
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedIndex.value >= 0 && selectedIndex.value <= maxIndex) {
          if (showSearchDropdown.value) {
            const item = dropdownResults[selectedIndex.value];
            if (item) openBookmark(item);
          } else if (showSearchHistory.value) {
            const q = historyResults[selectedIndex.value];
            if (q) {
              searchQuery.value = q;
              handleSearchInput();
            }
          }
        }
        break;

      case 'Escape':
        event.preventDefault();
        showSearchDropdown.value = false;
        showSearchHistory.value = false;
        selectedIndex.value = -1;
        // 关闭弹窗
        window.close();
        break;
    }
  }

  /**
   * 重置搜索状态
   */
  function resetSearch(): void {
    searchQuery.value = '';
    searchResults.value = [];
    isSearching.value = false;
    showSearchDropdown.value = false;
    showSearchHistory.value = false;
    selectedIndex.value = -1;
  }

  /**
   * 切换模式选择器
   */
  function toggleModeSelector(): void {
    showModeSelector.value = !showModeSelector.value;
  }

  return {
    // 状态
    stats,
    searchQuery,
    searchResults,
    isSearching,
    searchMode,
    lastSearchQuery,
    lastSearchMode,
    searchStats,
    showModeSelector,
    showSearchDropdown,
    selectedIndex,
    maxDropdownItems,
    searchHistory,
    showSearchHistory,
    searchInput,
    isInputFocused,

    // 计算属性
    searchModeOptions,
    currentModeInfo,
    hasSearchResults,
    hasSearchHistory,
    shouldShowDropdown,

    // 工具函数
    safeTrim,
    getHostname,
    highlightText,

    // Actions
    initialize,
    loadBookmarkStats,
    countBookmarks,
    loadSearchHistory,
    performSearch,
    addToSearchHistory,
    handleSearchInput,
    handleSearchFocus,
    handleSearchBlur,
    handleModeChange,
    openBookmark,
    handleKeyboardNavigation,
    resetSearch,
    toggleModeSelector
  };
});
