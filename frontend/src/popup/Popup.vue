<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';

// --- Type Definitions ---
interface BookmarkStats {
  bookmarks: number;
  folders: number;
}

// --- Reactive State ---
const currentTab = ref<chrome.tabs.Tab | null>(null);
const stats = ref<BookmarkStats>({ bookmarks: 0, folders: 0 });
const lastProcessedInfo = ref('尚未进行过AI整理');
const isClearingCache = ref(false);

// Snackbar state for global feedback
const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref<'success' | 'error' | 'warning'>('success');

// Search functionality
const searchQuery = ref('');
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchMode = ref<'fast' | 'smart'>('fast');
const showSearchModeMenu = ref(false);
const isAIProcessing = ref(false);
const aiSearchError = ref('');

// Performance optimization states
const searchProgress = ref({
  current: 0,
  total: 0,
  stage: '',
  message: ''
});
const isSearchDisabled = ref(false);
const searchAbortController = ref<AbortController | null>(null);

// Search dropdown
const showSearchDropdown = ref(false);
const selectedIndex = ref(-1);
const maxDropdownItems = 5;
const searchInput = ref<any>(null);

// Search history
const searchHistory = ref<string[]>([]);
const showSearchHistory = ref(false);

// Unified search UI state management
const searchUIState = ref({
  showDropdown: false,
  showHistory: false,
  selectedIndex: -1,
  lastUpdate: 0
});

// Computed properties to sync with unified state
const computedShowDropdown = computed({
  get: () => searchUIState.value.showDropdown,
  set: (value) => updateUIState({ showDropdown: value })
});

const computedShowHistory = computed({
  get: () => searchUIState.value.showHistory,
  set: (value) => updateUIState({ showHistory: value })
});

const computedSelectedIndex = computed({
  get: () => searchUIState.value.selectedIndex,
  set: (value) => updateUIState({ selectedIndex: value })
});

// Unified UI state update function
let uiUpdateTimeout: number | null = null;
function updateUIState(updates: Partial<typeof searchUIState.value>) {
  if (uiUpdateTimeout) {
    clearTimeout(uiUpdateTimeout);
  }
  uiUpdateTimeout = window.setTimeout(() => {
    requestAnimationFrame(() => {
      nextTick(() => {
        const updateTime = Date.now();
        if (updateTime - searchUIState.value.lastUpdate > 50) {
          searchUIState.value = {
            ...searchUIState.value,
            ...updates,
            lastUpdate: updateTime
          };
        }
      });
    });
  }, 16);
}

// Search stats
const searchStats = ref({
  totalBookmarks: 0,
  searchTime: 0,
  resultsCount: 0
});

// Popup behavior control
const isUserActive = ref(false);
const popupCloseTimeout = ref<number | null>(null);
const isInputFocused = ref(false);

// --- Utility Functions ---
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
  return { bookmarks, folders };
}

// --- Event Handlers ---
function openAiOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPageAndOrganize' }, (_response) => {
    // 等待background响应后再关闭
    if (chrome.runtime.lastError) {
      // 处理错误情况
    }
    // 增加延迟时间，确保异步操作完成后再关闭
    setTimeout(() => {
      window.close();
    }, 1500);
  });
}

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPage', mode: 'manual' }, (_response) => {
    // 等待background响应后再关闭
    if (chrome.runtime.lastError) {
      // 处理错误情况
    }
    // 增加延迟时间，确保异步操作完成后再关闭
    setTimeout(() => {
      window.close();
    }, 1000);
  });
}

function showSnackbar(text: string, color: 'success' | 'error' | 'warning' = 'success'): void {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
}

function clearCacheAndRestructure(): void {
  isClearingCache.value = true;
  chrome.runtime.sendMessage({ action: 'clearCacheAndRestructure' }, (response) => {
    if (chrome.runtime.lastError) {
      showSnackbar(`错误: ${chrome.runtime.lastError.message}`, 'error');
    } else if (response && response.status === 'success') {
      showSnackbar('缓存已成功清除！', 'success');
    } else {
      showSnackbar(`清除失败: ${response?.message || '未知错误'}`, 'error');
    }
    isClearingCache.value = false;

    // 延迟关闭popup，确保用户能看到结果
    setTimeout(() => {
      window.close();
    }, 2000);
  });
}

function openKeyboardShortcuts(): void {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
}

function openDebugPanel(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('debug-panel.html') });
  setTimeout(() => {
    window.close();
  }, 500);
}

function focusSearchInput(): void {
  const searchInputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
  if (searchInputElement) {
    searchInputElement.focus();
    searchInputElement.select();
  }
}

// Search functionality
async function performSearch(): Promise<void> {
  const query = safeTrim(searchQuery.value);
  if (!query) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;
  isAIProcessing.value = searchMode.value === 'smart';
  aiSearchError.value = '';

  if (searchMode.value === 'smart') {
    isSearchDisabled.value = true;
    searchAbortController.value = new AbortController();
    searchProgress.value = { current: 0, total: 100, stage: 'starting', message: '正在准备AI搜索...' };
    simulateAIProgress();
  }

  const startTime = Date.now();

  try {
    const response = await new Promise<any>((resolve, reject) => {
      let progressListener: ((message: any) => void) | null = null;
      if (searchMode.value === 'smart') {
        progressListener = (message) => {
          if (message.action === 'searchProgress' && message.progress) {
            searchProgress.value = message.progress;
          }
        };
        chrome.runtime.onMessage.addListener(progressListener);
      }

      chrome.runtime.sendMessage({ action: 'searchBookmarks', query: query, mode: searchMode.value }, (response) => {
        if (progressListener) {
          chrome.runtime.onMessage.removeListener(progressListener);
        }
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || { results: [], stats: {} });
        }
      });
    });

    if (response && Array.isArray(response.results)) {
      searchResults.value = response.results;
    } else {
      searchResults.value = [];
      if (response && response.error) {
        showSnackbar(`搜索警告: ${response.error}`, 'error');
      }
    }

    searchStats.value = {
      totalBookmarks: response.stats?.totalBookmarks || 0,
      searchTime: response.stats?.searchTime || (Date.now() - startTime),
      resultsCount: searchResults.value.length
    };

    const currentQuery = safeTrim(searchQuery.value);
    if (!currentQuery) {
      const shouldShowHistory = isInputFocused.value && searchHistory.value.length > 0;
      updateUIState({ showDropdown: false, showHistory: shouldShowHistory, selectedIndex: -1 });
    } else {
      const shouldShowDropdown = searchResults.value.length > 0 || !!currentQuery;
      updateUIState({ showDropdown: shouldShowDropdown, showHistory: false, selectedIndex: -1 });
    }

    if (searchResults.value.length > 0 && query && !searchHistory.value.includes(query)) {
      searchHistory.value.unshift(query);
      if (searchHistory.value.length > 10) {
        searchHistory.value = searchHistory.value.slice(0, 10);
      }
      chrome.storage.local.set({ searchHistory: searchHistory.value });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    if (searchMode.value === 'smart' && errorMessage.includes('AI')) {
      aiSearchError.value = 'AI服务暂时不可用，请稍后重试';
      showSnackbar('AI搜索失败，已切换到快速搜索模式', 'warning');
      searchMode.value = 'fast';
      await performSearch();
    } else {
      showSnackbar(`搜索失败: ${errorMessage}`, 'error');
    }
    searchResults.value = [];
    showSearchDropdown.value = !!safeTrim(searchQuery.value);
    selectedIndex.value = -1;
  } finally {
    isSearching.value = false;
    isAIProcessing.value = false;
    isSearchDisabled.value = false;
    searchAbortController.value = null;
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    searchProgress.value = { current: 0, total: 0, stage: '', message: '' };
  }
}

function loadSearchHistory(): void {
  chrome.storage.local.get('searchHistory', (data) => {
    if (data.searchHistory && Array.isArray(data.searchHistory)) {
      searchHistory.value = data.searchHistory;
    }
  });
}

function selectSearchMode(mode: 'fast' | 'smart'): void {
  searchMode.value = mode;
  showSearchModeMenu.value = false;
  if (safeTrim(searchQuery.value)) {
    performSearch();
  }
}

function getSearchPlaceholder(): string {
  switch (searchMode.value) {
    case 'fast':
      return '输入书签标题或URL关键字221';
    case 'smart':
      return '输入网页内相关内容';
    default:
      return '输入搜索关键词';
  }
}

function openBookmark(bookmark: any): void {
  if (bookmark && bookmark.url) {
    chrome.tabs.create({ url: bookmark.url });
    showSearchDropdown.value = false;
    selectedIndex.value = -1;
  }
}

function handleSearchKeydown(event: KeyboardEvent): void {
  if (!showSearchDropdown.value && !showSearchHistory.value) return;

  const items = showSearchDropdown.value ? searchResults.value : searchHistory.value;
  const maxIndex = Math.min(items.length, maxDropdownItems) - 1;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (selectedIndex.value < maxIndex) selectedIndex.value++;
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (selectedIndex.value > -1) selectedIndex.value--;
      break;
    case 'Enter':
      event.preventDefault();
      if (selectedIndex.value >= 0) {
        if (showSearchDropdown.value) {
          openBookmark(items[selectedIndex.value]);
        } else if (showSearchHistory.value) {
          searchQuery.value = items[selectedIndex.value];
          handleSearchInput();
        }
      }
      break;
    case 'Escape':
      event.preventDefault();
      if (isAIProcessing.value) {
        cancelSearch();
      } else {
        showSearchDropdown.value = false;
        showSearchHistory.value = false;
        selectedIndex.value = -1;
      }
      break;
  }
}

function selectDropdownItem(bookmark: any): void {
  openBookmark(bookmark);
}

function handleSearchFocus(): void {
  isInputFocused.value = true;
  isUserActive.value = true;
  if (popupCloseTimeout.value) {
    clearTimeout(popupCloseTimeout.value);
    popupCloseTimeout.value = null;
  }
  if (!safeTrim(searchQuery.value) && searchHistory.value.length > 0) {
    updateUIState({ showHistory: true, showDropdown: false, selectedIndex: -1 });
  } else if (safeTrim(searchQuery.value)) {
    updateUIState({ showDropdown: true, showHistory: false, selectedIndex: -1 });
  }
}

function handleSearchBlur(): void {
  isInputFocused.value = false;
  setTimeout(() => {
    if (!isInputFocused.value) {
      updateUIState({ showDropdown: false, showHistory: false, selectedIndex: -1 });
    }
  }, 200);
}

function handleWindowFocus(): void {
  isUserActive.value = true;
  if (popupCloseTimeout.value) {
    clearTimeout(popupCloseTimeout.value);
    popupCloseTimeout.value = null;
  }
}

function handleWindowBlur(): void {
  isUserActive.value = false;
  if (!isInputFocused.value && !safeTrim(searchQuery.value) && !isSearching.value) {
    window.close();
  }
}

function handleWindowClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest('.v-application')) {
    isUserActive.value = true;
    if (popupCloseTimeout.value) {
      clearTimeout(popupCloseTimeout.value);
      popupCloseTimeout.value = null;
    }
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname || 'unknown';
  } catch {
    return url || 'unknown';
  }
}

function highlightText(text: string, query: string): string {
  if (!text || !query) return text || '';
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return text;
  const escapedQuery = lowerQuery.replace(/[.*+?^${}()|[\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark class="highlight">$1</mark>');
}

let searchTimeout: number | null = null;
function debounceSearch(func: () => void, delay = 400): void {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(func, delay) as unknown as number;
}

function handleSearchInput(): void {
  const query = safeTrim(searchQuery.value);
  if (!query) {
    updateUIState({ showDropdown: false, showHistory: isInputFocused.value && searchHistory.value.length > 0, selectedIndex: -1 });
    searchResults.value = [];
    return;
  }
  updateUIState({ showHistory: false, showDropdown: true, selectedIndex: -1 });
  debounceSearch(performSearch, searchMode.value === 'smart' ? 1000 : 400);
}

function getAIScoreColor(score: number): string {
  if (score >= 8) return 'success';
  if (score >= 5) return 'primary';
  if (score >= 3) return 'warning';
  return 'grey';
}

let progressInterval: number | null = null;
function simulateAIProgress(): void {
  let progressStep = 0;
  progressInterval = (setInterval as unknown as (callback: () => void, delay?: number) => number)(() => {
    requestAnimationFrame(() => {
      progressStep += Math.random() * 2 + 0.5;
      if (progressStep >= 100) {
        progressStep = 100;
        if (progressInterval) clearInterval(progressInterval);
      }
      searchProgress.value.current = Math.round(progressStep);
    });
  }, 300);
}

function cancelSearch(): void {
  if (searchAbortController.value) {
    searchAbortController.value.abort();
    isSearching.value = false;
    isAIProcessing.value = false;
    isSearchDisabled.value = false;
    if (progressInterval) clearInterval(progressInterval);
    searchProgress.value = { current: 0, total: 0, stage: '', message: '' };
    showSnackbar('搜索已取消', 'success');
  }
}

function safeTrim(value: any): string {
  return String(value || '').trim();
}

watch(searchQuery, (newQuery) => {
  if (!newQuery) {
    searchResults.value = [];
    updateUIState({ showDropdown: false, showHistory: isInputFocused.value && searchHistory.value.length > 0, selectedIndex: -1 });
  }
});

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (popupCloseTimeout.value) clearTimeout(popupCloseTimeout.value);
  if (uiUpdateTimeout) clearTimeout(uiUpdateTimeout);
  if (progressInterval) clearInterval(progressInterval);
  if ((window as any)._resizeObserverErrHandler) {
    window.removeEventListener('error', (window as any)._resizeObserverErrHandler);
  }
  if (searchAbortController.value) {
    searchAbortController.value.abort();
  }
  if ((window as any)._abGlobalHotkeyHandler) {
    window.removeEventListener('keydown', (window as any)._abGlobalHotkeyHandler);
    (window as any)._abGlobalHotkeyHandler = null;
  }
});

onMounted(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url && !tabs[0].url.startsWith('chrome://')) {
      currentTab.value = tabs[0];
    }
  });

  chrome.bookmarks.getTree((tree) => {
    const totalStats = countBookmarks(tree);
    stats.value = { ...totalStats, folders: totalStats.folders > 0 ? totalStats.folders - 1 : 0 };
  });

  chrome.storage.local.get('processedAt', (data) => {
    if (data.processedAt) {
      lastProcessedInfo.value = `上次整理于: ${new Date(data.processedAt).toLocaleString()}`;
    }
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'focusSearch') {
      focusSearchInput();
    }
  });

  loadSearchHistory();

  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('click', handleWindowClick);

  // Global hotkeys for popup interactions
  const globalHotkeyHandler = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      focusSearchInput();
      return;
    }
    if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      switch (key) {
        case 'm':
          event.preventDefault();
          openManualOrganizePage();
          return;
        case 'a':
          event.preventDefault();
          openAiOrganizePage();
          return;
        case 'c':
          event.preventDefault();
          if (!isClearingCache.value) clearCacheAndRestructure();
          return;
        case 'p':
          event.preventDefault();
          openKeyboardShortcuts();
          return;
        case 'd':
          event.preventDefault();
          openDebugPanel();
          return;
        case '1':
          event.preventDefault();
          selectSearchMode('fast');
          return;
        case '2':
          event.preventDefault();
          selectSearchMode('smart');
          return;
        case 'f':
          event.preventDefault();
          focusSearchInput();
          return;
      }
    }
  };
  window.addEventListener('keydown', globalHotkeyHandler);
  (window as any)._abGlobalHotkeyHandler = globalHotkeyHandler;

  let resizeObserverErrorCount = 0;
  const resizeObserverErrHandler = (e: ErrorEvent) => {
    if (e.message?.includes('ResizeObserver loop')) {
      e.preventDefault();
      if (resizeObserverErrorCount++ < 3) {
      }
    }
  };
  window.addEventListener('error', resizeObserverErrHandler);
  (window as any)._resizeObserverErrHandler = resizeObserverErrHandler;
});
</script>

<template>
  <v-app class="ab-app">
    <!-- 顶部品牌 + 搜索 合并为单卡片 -->
    <div class="hero-card">
      <div class="brand">
        <img src="/logo.png" alt="AcuityBookmarks" class="popup-logo" />
        <div class="brand-text">
          <div class="brand-title">AcuityBookmarks</div>
          <div class="brand-subtitle">您的智能书签助手</div>
        </div>
      </div>

      <!-- 快捷键功能保持实现（在 background.js 中），此处不展示视觉入口 -->

      <!-- 搜索输入框 -->
      <div class="search-container hero-search">
        <v-text-field
          ref="searchInput"
          v-model="searchQuery"
          :label="getSearchPlaceholder()"
          variant="outlined"
          density="comfortable"
          :loading="isSearching"
          :loading-text="isAIProcessing ? 'AI分析中...' : '搜索中...'
          "
          :disabled="isSearchDisabled"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          class="search-input"
          @input="handleSearchInput"
          @keydown="handleSearchKeydown"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
                     @update:modelValue="(value: string) => {
             searchQuery = value;
           }"
        >
          <!-- 搜索模式下拉菜单触发器 -->
          <template v-slot:append-inner>
            <v-menu
              v-model="showSearchModeMenu"
              :close-on-content-click="false"
              location="bottom end"
              offset-y
              min-width="200"
            >
              <template v-slot:activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon
                  size="small"
                  variant="text"
                  class="search-mode-btn"
                  :disabled="isSearchDisabled"
                  @click.stop
                >
                  <v-icon size="16" class="search-mode-icon">
                    {{ searchMode === 'fast' ? 'mdi-lightning-bolt' : 'mdi-brain' }}
                  </v-icon>
                  <v-icon size="12" class="dropdown-arrow">mdi-chevron-down</v-icon>
                </v-btn>
              </template>

              <v-list dense class="search-mode-menu">
                <v-list-item
                  :class="{ 'active': searchMode === 'fast' }"
                  @click="selectSearchMode('fast')"
                >
                  <template v-slot:prepend>
                    <v-icon size="16" color="primary">mdi-lightning-bolt</v-icon>
                  </template>
                  <v-list-item-title>快速搜索</v-list-item-title>
                  <v-list-item-subtitle>基于书签标题和URL快速匹配</v-list-item-subtitle>
                </v-list-item>

                <v-list-item
                  :class="{ 'active': searchMode === 'smart' }"
                  @click="selectSearchMode('smart')"
                >
                  <template v-slot:prepend>
                    <v-icon size="16" color="secondary">mdi-brain</v-icon>
                  </template>
                  <v-list-item-title>AI搜索</v-list-item-title>
                  <v-list-item-subtitle>基于网页内容智能匹配，即使忘记标题和URL也能找到</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </v-text-field>

        <!-- Search Dropdown -->
        <div
          v-if="computedShowDropdown"
          class="search-dropdown"
          @mousedown.prevent
        >
          <v-list dense class="dropdown-list">
            <!-- AI Search Progress Indicator -->
            <v-list-item v-if="isAIProcessing && searchProgress.stage && searchMode === 'smart'" class="ai-progress-item">
              <v-list-item-title class="text-center">
                <div class="d-flex align-center justify-center mb-2">
                  <v-progress-circular
                    :size="16"
                    :width="2"
                    indeterminate
                    color="secondary"
                    class="mr-2"
                  ></v-progress-circular>
                  <span class="text-caption text-secondary">{{ searchProgress.message }}</span>
                </div>
                <v-progress-linear
                  v-if="searchProgress.total > 0"
                  :model-value="(searchProgress.current / searchProgress.total) * 100"
                  color="secondary"
                  height="4"
                  class="mb-2"
                ></v-progress-linear>
                <div class="text-caption text-disabled mb-2">
                  {{ searchProgress.current }} / {{ searchProgress.total }}
                  <span class="ml-2">{{ searchProgress.stage }}</span>
                </div>
                <!-- Cancel Button -->
                <v-tooltip text="点击取消搜索，或按ESC键" location="top">
                  <template v-slot:activator="{ props }">
                    <v-btn
                      v-bind="props"
                      size="x-small"
                      variant="outlined"
                      color="warning"
                      @click="cancelSearch"
                      class="cancel-btn"
                    >
                      <v-icon size="12" class="mr-1">mdi-close</v-icon>
                      取消搜索
                    </v-btn>
                  </template>
                </v-tooltip>
              </v-list-item-title>
            </v-list-item>

            <!-- Search results count at the top -->
            <v-list-item v-if="searchStats.resultsCount > 0" class="search-stats-item" disabled>
              <v-list-item-title class="text-center text-caption text-medium-emphasis">
                <div class="d-flex align-center justify-center">
                  <span>找到 {{ searchStats.resultsCount }} 个结果</span>
                  <span v-if="searchStats.searchTime" class="text-disabled ml-1">({{ searchStats.searchTime }}ms)</span>
                  <!-- AI processing time indicator -->
                  <v-chip
                    v-if="(searchStats as any).aiProcessingTime !== undefined"
                    size="x-small"
                    color="secondary"
                    variant="flat"
                    class="ml-2 ai-indicator"
                  >
                    <v-icon size="10" class="mr-1">mdi-brain</v-icon>
                    AI: {{ (searchStats as any).aiProcessingTime }}ms
                  </v-chip>
                </div>
                <!-- AI analysis info -->
                <div v-if="(searchStats as any).searchStrategy && searchMode === 'smart'" class="text-caption text-disabled mt-1">
                  <v-icon size="12" class="mr-1">mdi-information-outline</v-icon>
                  {{ (searchStats as any).searchStrategy }}
                  <span v-if="(searchStats as any).contentFetchTime !== undefined" class="ml-2">
                    网页获取: {{ (searchStats as any).contentFetchTime }}ms
                  </span>
                </div>
              </v-list-item-title>
            </v-list-item>

            <v-divider v-if="searchStats.resultsCount > 0"></v-divider>

            <v-list-item
              v-for="(bookmark, index) in searchResults.slice(0, maxDropdownItems)"
              :key="bookmark?.id || index"
              :class="{ 'selected': computedSelectedIndex === index, 'ai-result': bookmark._aiScore }"
              @click="selectDropdownItem(bookmark)"
              class="dropdown-item"
            >
              <template v-slot:prepend>
                <div class="d-flex align-center">
                  <v-avatar size="20" class="mr-2">
                    <v-img
                      :src="`https://www.google.com/s2/favicons?domain=${getHostname(bookmark.url)}&sz=32`"
                      alt=""
                    >
                      <template v-slot:error>
                        <v-icon size="12">mdi-bookmark-outline</v-icon>
                      </template>
                    </v-img>
                  </v-avatar>
                  <!-- AI score indicator -->
                  <v-chip
                    v-if="bookmark._aiScore"
                    size="x-small"
                    :color="getAIScoreColor(bookmark._aiScore)"
                    variant="flat"
                    class="ai-score-chip"
                  >
                    <v-icon size="10" class="mr-1">mdi-star</v-icon>
                    {{ bookmark._aiScore.toFixed(1) }}
                  </v-chip>
                </div>
              </template>
              <v-list-item-title class="dropdown-title" v-html="highlightText(bookmark.title, searchQuery)"></v-list-item-title>
              <v-list-item-subtitle class="dropdown-url">
                <div v-html="highlightText(bookmark.url, searchQuery)"></div>
                <!-- Content-based match indicator -->
                <div v-if="bookmark._contentMatched" class="content-match-indicator mt-1">
                  <v-chip
                    size="x-small"
                    variant="flat"
                    color="info"
                    class="content-match-chip"
                  >
                    <v-icon size="8" class="mr-1">mdi-file-document-outline</v-icon>
                    内容匹配
                  </v-chip>
                </div>
                <!-- AI match reasons -->
                <div v-if="bookmark._matchReasons && bookmark._matchReasons.length > 0" class="ai-match-reasons mt-1">
                  <v-chip
                    v-for="reason in bookmark._matchReasons.slice(0, 2)"
                    :key="reason"
                    size="x-small"
                    variant="outlined"
                    color="secondary"
                    class="mr-1 mb-1 match-reason-chip"
                  >
                    <v-icon size="8" class="mr-1">mdi-check-circle</v-icon>
                    {{ reason }}
                  </v-chip>
                  <v-chip
                    v-if="bookmark._matchReasons.length > 2"
                    size="x-small"
                    variant="outlined"
                    color="grey"
                    class="match-reason-chip"
                  >
                    +{{ bookmark._matchReasons.length - 2 }}
                  </v-chip>
                </div>
              </v-list-item-subtitle>
            </v-list-item>

            <!-- Show "more results" indicator if there are more results -->
            <v-list-item
              v-if="searchResults.length > maxDropdownItems"
              class="more-results"
              disabled
            >
              <v-list-item-title class="text-center text-caption">
                还有 {{ searchResults.length - maxDropdownItems }} 个结果...
              </v-list-item-title>
            </v-list-item>

            <!-- Show AI error message -->
            <v-list-item
              v-if="aiSearchError && searchMode === 'smart'"
              class="ai-error"
              disabled
            >
              <template v-slot:prepend>
                <v-icon size="20" color="warning">mdi-brain</v-icon>
              </template>
              <v-list-item-title class="text-center text-caption text-warning">
                AI搜索遇到问题
              </v-list-item-title>
              <v-list-item-subtitle class="text-center text-caption">
                {{ aiSearchError }}
              </v-list-item-subtitle>
              <v-list-item-subtitle class="text-center text-caption text-disabled">
                已自动切换到快速搜索模式
              </v-list-item-subtitle>
            </v-list-item>

            <!-- Show "no results" message when search has no matches -->
            <v-list-item
              v-if="searchResults.length === 0 && safeTrim(searchQuery) && !aiSearchError"
              class="no-results"
              disabled
            >
              <template v-slot:prepend>
                <v-icon size="20" color="grey">mdi-magnify</v-icon>
              </template>
              <v-list-item-title class="text-center text-caption text-medium-emphasis">
                未找到匹配的书签
              </v-list-item-title>
              <v-list-item-subtitle class="text-center text-caption">
                尝试调整搜索关键词或选择其他搜索模式
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </div>

        <!-- Search History Dropdown -->
        <div
          v-if="computedShowHistory && !computedShowDropdown"
          class="search-dropdown"
          @mousedown.prevent
        >
          <v-list dense class="dropdown-list" v-if="Array.isArray(searchHistory)">
            <v-list-item
              v-for="(query, index) in searchHistory.slice(0, 5)"
              :key="index"
              :class="{ 'selected': computedSelectedIndex === index }"
              @click="searchQuery = query; handleSearchInput()"
              class="dropdown-item"
            >
              <template v-slot:prepend>
                <v-icon size="16" class="mr-2">mdi-history</v-icon>
              </template>
              <v-list-item-title>{{ query }}</v-list-item-title>
            </v-list-item>

            <v-divider v-if="searchHistory.length > 0"></v-divider>

            <v-list-item @click="searchHistory = []; showSearchHistory = false" class="clear-history">
              <template v-slot:prepend>
                <v-icon size="16" class="mr-2 text-error">mdi-delete-outline</v-icon>
              </template>
              <v-list-item-title class="text-error">清空历史记录</v-list-item-title>
            </v-list-item>
          </v-list>
        </div>
      </div>
    </div>

    <!-- 合并的统计和操作区域 -->
    <div class="combined-section">
      <!-- 概览统计 -->
      <div class="overview-section">
        <v-row dense class="text-center mb-2">
          <v-col cols="6">
            <div class="text-h6">{{ stats.bookmarks }}</div>
            <div class="text-caption text-xs">书签总数</div>
          </v-col>
          <v-col cols="6">
            <div class="text-h6">{{ stats.folders }}</div>
            <div class="text-caption text-xs">文件夹</div>
          </v-col>
        </v-row>
        <div class="text-caption text-center text-grey text-xs">{{ lastProcessedInfo }}</div>
      </div>

      <v-divider class="my-3"></v-divider>

      <!-- 操作按钮区域 -->
      <div class="buttons-section">
        <!-- 一键AI整理和手动整理按钮在一行 -->
        <div class="d-flex mb-3" style="gap: 8px;">
          <v-btn
            @click="openAiOrganizePage"
            color="primary"
            prepend-icon="mdi-robot"
            size="small"
            class="flex-grow-1 btn-primary-gradient"
          >
            一键AI整理
          </v-btn>
          <v-btn
            @click="openManualOrganizePage"
            color="blue"
            prepend-icon="mdi-cog"
            variant="outlined"
            size="small"
            class="flex-grow-1 btn-outline-mint"
          >
            手动整理
          </v-btn>
        </div>

        <!-- 清除缓存按钮和icon在一行 -->
        <div class="d-flex align-center mb-1">
          <v-btn
            @click="clearCacheAndRestructure"
            variant="text"
            size="small"
            class="clear-btn px-2"
            :disabled="isClearingCache"
          >
            <span v-if="!isClearingCache">清除缓存</span>
            <span v-else>正在清除...</span>
          </v-btn>
          <v-tooltip location="top">
            <template v-slot:activator="{ props }">
              <v-icon v-bind="props" size="16" class="ml-2 text-grey">mdi-help-circle-outline</v-icon>
            </template>
            <span>为了加快分析速度，AI会缓存已成功访问的网页内容。若您觉得分类结果不准，可清除缓存后重试。</span>
          </v-tooltip>
        </div>

        <!-- 调试入口 -->
        <div class="d-flex align-center mb-2">
          <v-btn
            @click="openDebugPanel"
            size="small"
            variant="tonal"
            color="secondary"
            prepend-icon="mdi-bug-outline"
            class="px-2"
          >
            调试面板
          </v-btn>
        </div>

        <!-- 快捷键设置 -->
        <div class="d-flex align-center justify-space-between">
          <v-tooltip location="top">
            <template v-slot:activator="{ props }">
              <div v-bind="props" class="d-flex align-center">
                <v-icon size="16" class="mr-2 text-grey">mdi-keyboard</v-icon>
                <span class="text-body-2">快捷键</span>
                <v-icon size="14" class="ml-2 text-grey">mdi-information-outline</v-icon>
              </div>
            </template>
            <span>Alt+B: 打开管理页面<br>Alt+S: 智能书签当前页面<br>Alt+F: 打开搜索</span>
          </v-tooltip>
          <v-btn
            size="small"
            variant="text"
            @click="openKeyboardShortcuts"
            class="px-2"
          >
            设置
          </v-btn>
        </div>
      </div>
    </div>
  </v-app>
</template>

// Script setup is already defined at the top of the file
// No additional script block needed

<style>
/* Root container themed to match the 3D soft color logo */
.ab-app {
  width: 380px;
  height: 650px;
  padding: 16px;
  box-sizing: border-box;
  /* soft gradient inspired by logo: mint + pink + sky */
  background: radial-gradient(120% 140% at 0% 0%, #fef3f5 0%, #ffe3ec 18%, #fbd6ec 28%, #d2f6f2 58%, #bff0ea 75%, #cdf0ff 100%);
}

/* Theme tokens */
.ab-app {
  --ab-mint: #86ead4;
  --ab-mint-deep: #2abfaa;
  --ab-pink: #f7a9c4;
  --ab-yellow: #ffd66e;
  --ab-sky: #6ec8ff;
  --ab-navy: #1f2937;
  --ab-muted: #5b6b7b;
  --ab-card: rgba(255,255,255,0.96);
  --ab-border: rgba(255,255,255,0.45);
  --ab-shadow: rgba(24, 120, 192, 0.18);
}

.hero-card {
  padding: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.92) 100%);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ab-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  width: 100%;
}

.popup-logo {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(24, 120, 192, 0.18);
  object-fit: contain;
}

.brand-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.brand-title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.2px;
  /* Gradient text matching brand accent */
  background-image: linear-gradient(90deg, #14213d 0%, #0f766e 65%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-top: 8px;
}

.brand-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: #0f766e;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
.shortcut-chip {
  border-radius: 10px !important;
}
.shortcut-settings {
  color: #0f766e !important;
}
.kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-bottom-width: 2px;
  padding: 2px 6px;
  border-radius: 6px;
  color: #111827;
}

/* Stats typography colors */
.overview-section .text-h6 {
  color: var(--ab-navy) !important;
  font-weight: 700 !important;
}
.overview-section .text-caption,
.overview-section .text-xs {
  color: var(--ab-muted) !important;
}
/* Snackbar styles */
.v-snackbar {
  margin-bottom: 60px;
}

/* Popup container styles */
.popup-container {
  padding: 16px;
}

/* 现代化popup样式 */
.popup-header {
  text-align: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.popup-subtitle {
  color: #4b5563;
  font-size: 14px;
  margin-top: 8px;
  font-weight: 400;
}

/* 搜索区域样式优化 */
.hero-search {
  margin-top: 12px;
}

/* 合并的统计和操作区域样式 */
.combined-section {
  padding: 16px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.25);
  /* 确保合并区域在搜索下拉列表之下 */
  z-index: 1;
  position: relative;
}

.overview-section {
  padding-bottom: 8px;
}

.buttons-section {
  padding-top: 8px;
}

/* 按钮间距优化 */
.gap-2 {
  gap: 8px !important;
}

/* 清除缓存按钮样式优化 */
.clear-btn {
  min-height: 32px;
  font-size: 12px;
}

/* 快捷键区域样式 */
.shortcuts-section {
  padding: 8px 0;
}

/* Logo styles */
.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 8px;
  background: transparent;
  border-radius: 8px;
  padding: 2px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.logo-container .popup-logo {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: contain;
  background: transparent !important;
  border: none !important;
  outline: none !important;
}

/* 按钮样式优化 */
.v-btn {
  border-radius: 12px !important;
  font-weight: 500 !important;
  letter-spacing: 0.5px !important;
  text-transform: none !important;
}

/* 输入框样式优化 */
.v-text-field .v-field {
  border-radius: 12px !important;
}

.v-text-field .v-field__input {
  font-size: 14px !important;
}

/* 卡片样式优化 */
.v-card {
  border-radius: 12px !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08) !important;
}

/* 统计数字样式 */
.text-h6 {
  font-weight: 600 !important;
  color: #1f2937 !important;
  font-size: 20px !important;
}

/* 正文字体样式 */
.text-body-2 {
  font-size: 14px !important;
  font-weight: 400 !important;
  line-height: 1.5 !important;
}

/* 副标题样式 */
.text-caption {
  color: #6b7280 !important;
  font-weight: 400 !important;
  font-size: 12px !important;
}

/* 标签样式 */
.text-overline {
  color: #374151 !important;
  font-weight: 500 !important;
  letter-spacing: 1px !important;
  text-transform: uppercase !important;
  font-size: 11px !important;
}

/* 搜索模式选择器样式 */
.search-mode-btn {
  margin-right: 4px !important;
  min-width: 32px !important;
  height: 32px !important;
  border-radius: 6px !important;
  transition: all 0.2s ease !important;
}

.search-mode-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}

.search-mode-icon {
  margin-right: 2px !important;
}

.dropdown-arrow {
  opacity: 0.6 !important;
  transition: transform 0.2s ease !important;
}

.search-mode-btn:hover .dropdown-arrow {
  opacity: 1 !important;
}

.search-mode-menu {
  padding: 4px 0 !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  background: white !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
}

.search-mode-menu .v-list-item {
  min-height: 48px !important;
  padding: 8px 16px !important;
  border-radius: 6px !important;
  margin: 2px 4px !important;
  transition: all 0.15s ease !important;
}

.search-mode-menu .v-list-item:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}

.search-mode-menu .v-list-item.active {
  background-color: rgba(25, 118, 210, 0.08) !important;
  border: 1px solid rgba(25, 118, 210, 0.2) !important;
}

.search-mode-menu .v-list-item-title {
  font-size: 14px !important;
  font-weight: 500 !important;
  color: #1f2937 !important;
}

.search-mode-menu .v-list-item-subtitle {
  font-size: 12px !important;
  color: #6b7280 !important;
  line-height: 1.3 !important;
}

/* 搜索容器和下拉列表样式 */
.search-container {
  position: relative;
  width: 100%;
  z-index: 1000;
  /* 给一个最小高度，防止切换placeholder时text-field高度变化导致重排循环 */
  min-height: 56px;
  /* 强制GPU加速，减少重绘 */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  /* 优化子元素布局 */
  display: block;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 9999999999 !important; /* 使用更大的z-index值 */
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 250px;
  overflow-y: auto;
  margin-top: 4px;
  /* 优化渲染性能，减少ResizeObserver loop */
  contain: layout style paint;
  transform: translateZ(0);
  will-change: transform;
  /* 使用更高的堆叠上下文 */
  isolation: isolate;
  /* 防止布局重新计算 */
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.dropdown-list {
  padding: 0 !important;
}

.dropdown-item {
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-radius: 6px;
  margin: 2px 4px;
  /* 优化渲染性能 */
  contain: layout style paint;
  will-change: background-color;
  /* 减少重绘 */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

.dropdown-item:hover,
.dropdown-item.selected {
  background-color: #f3f4f6 !important;
}

.dropdown-item.selected {
  background-color: #e0f2fe !important;
  border: 1px solid #0ea5e9;
}

.dropdown-title {
  font-size: 14px !important;
  font-weight: 500 !important;
  color: #1f2937 !important;
  line-height: 1.4 !important;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dropdown-url {
  font-size: 12px !important;
  color: #6b7280 !important;
  line-height: 1.3 !important;
}

/* 高亮样式 */
.highlight {
  background-color: #fef3c7 !important;
  color: #92400e !important;
  padding: 1px 2px !important;
  border-radius: 2px !important;
  font-weight: 600 !important;
}

.more-results {
  opacity: 0.7;
  cursor: default !important;
}

.more-results .v-list-item-title {
  font-style: italic;
}

.no-results {
  opacity: 0.8;
  pointer-events: none;
}

.no-results .v-list-item-title {
  justify-content: center;
  padding: 8px 0;
}

.no-results .v-list-item-subtitle {
  justify-content: center;
  padding: 4px 0;
}

.clear-history {
  color: #dc2626 !important;
}

.clear-history:hover {
  background-color: #fef2f2 !important;
}

/* 滚动条样式 */
.search-dropdown::-webkit-scrollbar, 
.history-list::-webkit-scrollbar {
  width: 6px;
}

.search-dropdown::-webkit-scrollbar-track, 
.history-list::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.search-dropdown::-webkit-scrollbar-thumb, 
.history-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.search-dropdown::-webkit-scrollbar-thumb:hover, 
.history-list::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}





.search-stats-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  margin-bottom: 4px;
}

.search-stats-item .v-list-item-title {
  justify-content: center;
}

/* AI search result styles */
.ai-result {
  position: relative;
}

.ai-indicator {
  font-size: 10px !important;
  height: 16px !important;
  padding: 0 4px !important;
}

.ai-score-chip {
  font-size: 10px !important;
  height: 16px !important;
  padding: 0 4px !important;
  min-width: 24px !important;
}

.content-match-indicator {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.content-match-chip {
  font-size: 9px !important;
  height: 14px !important;
  padding: 0 4px !important;
  border-radius: 4px !important;
}

.ai-match-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
}

/* AI progress indicator styles */
.ai-progress-item {
  background-color: rgba(124, 77, 255, 0.05) !important;
  border: 1px solid rgba(124, 77, 255, 0.1) !important;
  border-radius: 8px !important;
  margin: 8px !important;
}

.ai-progress-item .v-list-item-title {
  padding: 12px 16px !important;
}

.cancel-btn {
  font-size: 11px !important;
  min-height: 24px !important;
  padding: 0 8px !important;
  border-radius: 4px !important;
}

.cancel-btn .v-icon {
  margin-right: 4px !important;
}

.match-reason-chip {
  font-size: 9px !important;
  height: 14px !important;
  padding: 0 4px !important;
  border-radius: 4px !important;
}

.match-reason-chip .v-icon {
  margin-right: 2px !important;
}

/* AI error styles */
.ai-error {
  opacity: 0.9;
  background-color: rgba(255, 193, 7, 0.08) !important;
  border: 1px solid rgba(255, 193, 7, 0.2) !important;
  border-radius: 6px !important;
  margin: 4px 8px !important;
}

.ai-error .v-list-item-title {
  justify-content: center;
  padding: 8px 0 4px;
}

.ai-error .v-list-item-subtitle {
  justify-content: center;
  padding: 2px 0;
}



/* 搜索历史样式 */
.search-history {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  max-height: 200px;
  overflow-y: auto;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.history-list {
  padding: 0 !important;
}

.history-item {
  cursor: pointer;
  border-radius: 4px;
  margin: 2px 8px;
}

.history-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

/* 搜索输入框样式 */
.search-input {
  margin-bottom: 8px;
  /* The 'contain' property was clipping the floating label. Removing it. */
  /* contain: layout style paint; */
  will-change: auto;
  /* 防止布局重新计算 */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

.search-input .v-field {
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  border: 1.5px solid rgba(134, 234, 212, 0.55) !important;
  box-shadow: 0 6px 16px var(--ab-shadow) !important;
  /* Allow floating label to overflow */
  overflow: visible !important;
}

.search-input .v-field__input {
  font-size: 14px !important;
  color: var(--ab-navy) !important;
}

.search-input .v-field-label {
  font-size: 14px !important;
  line-height: 1.3 !important;
  white-space: nowrap !important;
  overflow: visible !important;
  /* text-overflow: clip !important; */ /* This was conflicting with overflow: visible */
  max-width: none !important;
  width: auto !important;
  color: rgba(15, 118, 110, 0.75) !important;
}

.search-input .v-field-label--floating {
  transform: translateY(-6px) scale(0.85) !important;
  font-size: 13px !important;
  white-space: nowrap !important;
  overflow: visible !important;
  max-width: none !important;
  width: auto !important;
  color: rgba(15, 118, 110, 0.85) !important;
}

/* 确保label容器能够容纳完整文本 */
.search-input .v-field__field {
  padding-right: 12px !important;
}

/* Focused state */
.search-input :deep(.v-field.v-field--focused) {
  border-color: var(--ab-mint-deep) !important;
  box-shadow: 0 0 0 3px rgba(40, 199, 169, 0.2) !important;
}

/* Themed primary button (AI 整理) */
.btn-primary-gradient {
  background: linear-gradient(135deg, #4fc3f7 0%, var(--ab-mint) 100%) !important;
  color: #083344 !important;
  border: none !important;
  border-radius: 14px !important;
  height: 44px !important;
  padding: 0 18px !important;
  box-shadow: 0 10px 20px var(--ab-shadow) !important;
}
.btn-primary-gradient :deep(.v-icon) {
  color: #083344 !important;
}
.btn-primary-gradient:hover {
  filter: brightness(1.02) saturate(1.02);
}

/* Themed outline button (手动整理) */
.btn-outline-mint {
  border: 1.8px solid var(--ab-mint-deep) !important;
  color: #0f766e !important;
  border-radius: 14px !important;
  height: 44px !important;
  padding: 0 18px !important;
  background: rgba(134, 234, 212, 0.08) !important;
}
.btn-outline-mint :deep(.v-icon) {
  color: #0f766e !important;
}
.btn-outline-mint:hover {
  background: rgba(134, 234, 212, 0.18) !important;
}

.search-btn {
  margin-right: 4px;
}

/* 搜索统计样式 */
.search-stats {
  text-align: center;
  margin-top: 8px;
  padding: 4px 0;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
}

/* 搜索结果样式优化 */
.search-results {
  margin-top: 16px;
  max-height: 250px;
  overflow-y: auto;
}

.search-results .v-list-item {
  border-radius: 8px;
  margin: 2px 0;
  transition: all 0.2s ease;
}

.search-results .v-list-item:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}



/* 响应式调整 */
@media (max-width: 400px) {
  .search-mode-btn {
    margin-right: 2px !important;
  }

  .search-mode-menu {
    min-width: 180px !important;
  }
}
</style>