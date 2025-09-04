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
    }
    window.close();
  });
}

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPage', mode: 'manual' }, (_response) => {
    // 等待background响应后再关闭
    if (chrome.runtime.lastError) {
    }
    window.close();
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
  });
}

function openKeyboardShortcuts(): void {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
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
  <v-app style="width: 380px; height: 650px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%); padding: 16px; box-sizing: border-box;">
    <!-- Logo头部区域 -->
    <div class="popup-header">
      <!-- 使用嵌入式SVG logo -->
      <div class="logo-container">
        <svg width="56" height="56" viewBox="0 0 507 507" style="background-color: transparent;" preserveAspectRatio="xMidYMid meet">
          <defs>
            <style>
              .cls-1 { fill: #1f7bbd; }
              .cls-2 { fill: #424243; }
              .cls-3 { fill: #cfcfd0; }
              .cls-4 { fill: #c9c9c9; }
              .cls-5 { fill: #1a7ac1; }
              .cls-6 { fill: #434445; }
              .cls-7 { fill: #424244; }
              .cls-8 { fill: #1878c0; }
              .cls-9 { fill: #1a79be; }
              .cls-10 { fill: #227dc0; }
            </style>
          </defs>
          <g>
            <path class="cls-10" d="M507,158v1l-73,23c-4.55-1.27-6.82-2.8-6-8,17.27-3.81,34.43-8.21,51.81-11.69,8.97-1.8,18.03-4.27,27.19-4.31Z"/>
            <path class="cls-1" d="M55,278c-.47,6.46,5.84,6.86,5,12-20.06.83-40.28,4.58-60,8v-2c18.4-5.74,36.72-11.89,55-18Z"/>
            <path class="cls-3" d="M396,0v1c-60.65.08-121.35-.11-182,0V0h182Z"/>
            <path class="cls-4" d="M214,0v1c-33.65.06-67.35-.04-101,0V0h101Z"/>
            <path class="cls-8" d="M336,196l-1.01,4.99c8.16,1.69,16.02,1.37,13.01,12.01h-1c-1.57-2.31-4.54-2.1-7-1.99v1.98s4,1.01,4,1.01c-1.79.67-4,2.25-6,3-.35-8.9-12.82-4.73-10,3-1.11.42-2.14.67-3,1,.19-2.32-3.5-5.21-5.35-4.84l-6.22,4.83,1.57,4c-1.65.63-3.32,1.35-5,2l-7-2v5c-53.77,21.01-107.17,43.51-159.36,68.14-7.31,3.45-20.53,11.89-27.25,13.77-1.95.54-1.13-.26-1.49-1.28-.7-1.98-.76-4.31-1.69-6.33-6.99-15.29-38.99-14.88-53.21-14.29.84-5.14-5.47-5.54-5-12,83.2-27.82,166.92-53.29,252-75l4,1v-2c9.06-2.36,16.84-3.95,25-6Z"/>
            <path class="cls-9" d="M428,174c-.82,5.2,1.45,6.73,6,8-9.28,5.13-20.28,6.62-30,10,.02-2.65.85-3.37-2.43-2.92-4.38.59-5.51,2.52-.57,3.92-17.64,6.16-34.95,14.63-53,20,3.02-10.64-4.85-10.32-13.01-12.01l1.01-4.99c18.93-4.75,37.89-9.53,57-14l2-1c10.97-2.55,22.02-4.58,33-7Z"/>
            <path class="cls-9" d="M325,221c-3.15,1.2-6.68,2.72-10,4l-1.57-4,6.22-4.83c1.85-.37,5.54,2.52,5.35,4.84Z"/>
            <path class="cls-5" d="M338,217c-2.83,1.06-7.18,1.93-10,3-2.82-7.73,9.65-11.9,10-3Z"/>
            <path class="cls-9" d="M310,227c-2.22.86-4.56,2.05-7,3v-5s7,2,7,2Z"/>
            <path class="cls-10" d="M401,193c-4.94-1.4-3.81-3.33.57-3.92,3.28-.44,2.44.27,2.43,2.92-1,.35-2.01.65-3,1Z"/>
            <path class="cls-9" d="M347,213c-.79,1.08-2.19.7-3,1l-4-1.01v-1.98c2.46-.1,5.43-.32,7,1.99Z"/>
            <path class="cls-7" d="M395,507h-3c-5.93-3.35-11.17-7.8-16.48-12.02-36.76-29.3-74.45-64.91-112.05-91.95-9.03-6.5-13.44-5.27-21.95,1.01-40.31,29.73-77.68,68.41-118.05,97.95-2.75,2.01-5.52,3.42-8.48,5.02h-4c-4.68-2.3-11-9.14-11-14.5v-188.5c11.93,2.14,6.05,16.82,2,23.99l43.98-20.5-18.98,52.51h49l24.46-67.07,102.44.17,23.6,66.9h48.5l-46.07-130.43,78.06-28.57c-.73,5.29.85,10.38,1.06,15.45,3.73,89.75-2.92,182.07-.01,272.08-.73,9.3-3.53,15.86-13.04,18.46Z"/>
            <path class="cls-2" d="M113,1c33.65-.04,67.35.06,101,0,60.65-.11,121.35.08,182,0,7.82,1.05,11.28,9.51,11.99,16.51,2.5,24.74-2.64,52.81.06,78.03l-.15,73.36-95.81,22-40.2-111.78-43.23-.16-55.18,151.03-73.48,23.02V15.5c0-5.44,6.48-15.2,13-14.5Z"/>
            <polygon class="cls-6" points="268 203.99 229 213.99 250.5 153 268 203.99"/>
            <path class="cls-9" d="M311,202v2s-4-1-4-1c1.32-.34,2.69-.66,4-1Z"/>
            <path class="cls-10" d="M395,181l-2,1c.11-.03.67-.69,2-1Z"/>
          </g>
        </svg>
      </div>
      <h4 class="mb-0" style="color: #1f2937; font-weight: 600; font-size: 20px;">AcuityBookmarks</h4>
      <p class="popup-subtitle" style="margin-top: 8px;">您的智能书签助手</p>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">


      <!-- 搜索输入框 -->
      <div class="search-container">
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
          @update:modelValue="(value) => {
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
            class="flex-grow-1"
          >
            一键AI整理
          </v-btn>
          <v-btn
            @click="openManualOrganizePage"
            color="blue"
            prepend-icon="mdi-cog"
            variant="outlined"
            size="small"
            class="flex-grow-1"
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
.search-section {
  padding: 20px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.3);
  /* 确保搜索区域在统计区域之上 */
  z-index: 10;
  position: relative;
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
  border-radius: 50%;
  padding: 2px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.logo-container svg {
  width: 44px;
  height: 44px;
  border-radius: 50%;
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
  background: rgba(255, 255, 255, 0.9) !important;
  /* Allow floating label to overflow */
  overflow: visible !important;
}

.search-input .v-field__input {
  font-size: 14px !important;
}

.search-input .v-field-label {
  font-size: 14px !important;
  line-height: 1.3 !important;
  white-space: nowrap !important;
  overflow: visible !important;
  /* text-overflow: clip !important; */ /* This was conflicting with overflow: visible */
  max-width: none !important;
  width: auto !important;
}

.search-input .v-field-label--floating {
  transform: translateY(-6px) scale(0.85) !important;
  font-size: 13px !important;
  white-space: nowrap !important;
  overflow: visible !important;
  max-width: none !important;
  width: auto !important;
}

/* 确保label容器能够容纳完整文本 */
.search-input .v-field__field {
  padding-right: 12px !important;
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