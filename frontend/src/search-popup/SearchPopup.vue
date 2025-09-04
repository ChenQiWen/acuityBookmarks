<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

// --- Type Definitions ---
interface BookmarkStats {
  bookmarks: number;
  folders: number;
}

// --- Reactive State ---
const stats = ref<BookmarkStats>({ bookmarks: 0, folders: 0 });

// Search functionality
const searchQuery = ref('');
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchMode = ref<'fast' | 'smart'>('fast');

// Search mode options
const searchModeOptions = [
  { value: 'fast', label: '快速搜索', description: '仅搜索标题和URL' },
  { value: 'smart', label: '智能搜索', description: '模糊匹配和关键词分析' }
];

// Track last search for mode switching optimization
const lastSearchQuery = ref('');
const lastSearchMode = ref<'fast' | 'smart'>('fast');
const showModeSelector = ref(false);

// Search dropdown
const showSearchDropdown = ref(false);
const selectedIndex = ref(-1);
const maxDropdownItems = 8;
const searchInput = ref<any>(null);

// Search history
const searchHistory = ref<string[]>([]);
const showSearchHistory = ref(false);

// Search stats
const searchStats = ref({
  totalBookmarks: 0,
  searchTime: 0,
  resultsCount: 0
});

// Keyboard shortcuts info (kept for future use)
// const shortcuts = ref([
//   {
//     name: '打开管理页面',
//     command: 'open-management',
//     defaultKey: 'Alt+B',
//     description: '打开书签管理页面'
//   },
//   {
//     name: '智能保存书签',
//     command: 'smart-bookmark',
//     defaultKey: 'Alt+S',
//     description: '保存当前页面为智能分类书签'
//   },
//   {
//     name: '搜索书签',
//     command: 'search-bookmarks',
//     defaultKey: 'Alt+F',
//     description: '打开搜索界面'
//   }
// ]);

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

// Open bookmark in new tab
function openBookmark(bookmark: any): void {
  if (bookmark && bookmark.url) {
    chrome.tabs.create({ url: bookmark.url });
    // Close the search popup after opening bookmark
    window.close();
  }
}

// Handle keyboard navigation for search dropdown
function handleSearchKeydown(event: KeyboardEvent): void {
  if (!showSearchDropdown.value && !showSearchHistory.value) return;

  const results = showSearchDropdown.value ? searchResults.value.slice(0, maxDropdownItems) :
                showSearchHistory.value ? searchHistory.value.slice(0, maxDropdownItems) : [];
  const maxIndex = results.length - 1;

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
          openBookmark(results[selectedIndex.value]);
        } else if (showSearchHistory.value && searchHistory.value[selectedIndex.value]) {
          searchQuery.value = searchHistory.value[selectedIndex.value];
          handleSearchInput();
        }
      }
      break;

    case 'Escape':
      event.preventDefault();
      showSearchDropdown.value = false;
      showSearchHistory.value = false;
      selectedIndex.value = -1;
      // Close the popup on Escape
      window.close();
      break;
  }
}

// Handle dropdown item click
function selectDropdownItem(bookmark: any): void {
  openBookmark(bookmark);
}

// Handle search input focus/blur
function handleSearchFocus(): void {
  // Handle focus behavior based on search state
  try {
    const currentQuery = safeTrim(searchQuery.value);

    if (!currentQuery) {
      // Input is empty - show search history if available
      if (Array.isArray(searchHistory.value) && searchHistory.value.length > 0) {
        showSearchHistory.value = true;
        showSearchDropdown.value = false;
      } else {
        showSearchHistory.value = false;
        showSearchDropdown.value = false;
      }
    } else {
      // Input has content - show search results if available
      if (Array.isArray(searchResults.value) && searchResults.value.length > 0) {
        showSearchHistory.value = false;
        showSearchDropdown.value = true;
      } else {
        showSearchHistory.value = false;
        showSearchDropdown.value = false;
      }
    }
  } catch (error) {
    showSearchHistory.value = false;
    showSearchDropdown.value = false;
  }
}

function handleSearchBlur(): void {
  // Delay hiding to allow for clicks on dropdown items
  setTimeout(() => {
    if (!isInputFocused.value) {
      showSearchDropdown.value = false;
      showSearchHistory.value = false;
      selectedIndex.value = -1;
    }
  }, 200);
}

// Handle popup window events
function handleWindowFocus(): void {
  // Keep popup open when focused
}

function handleWindowBlur(): void {
  // Close popup when it loses focus
  setTimeout(() => {
    window.close();
  }, 200);
}

function handleWindowClick(event: MouseEvent): void {
  // Close mode selector dropdown when clicking outside
  const target = event.target as HTMLElement;
  const modeSelector = document.querySelector('.mode-selector');
  if (modeSelector && !modeSelector.contains(target)) {
    showModeSelector.value = false;
  }

  // Close popup when clicking outside the search container
  const searchContainer = document.querySelector('.search-popup-container');
  if (searchContainer && !searchContainer.contains(target)) {
    window.close();
  }
}

// Helper function to get hostname safely
function getHostname(url: string): string {
  try {
    if (!url || typeof url !== 'string') {
      return 'unknown';
    }
    const urlObj = new (window as any).URL(url);
    return urlObj.hostname || 'unknown';
  } catch {
    return url || 'unknown';
  }
}

// Helper function to highlight search keywords
function highlightText(text: string, query: string): string {
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
      // If still no match, return original text
      return text;
    }

    return highlightedText;
  }

  // Create a regex to match the query (case-insensitive)
  const regex = new RegExp(`(${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

  // Replace matches with highlighted spans
  const result = text.replace(regex, '<mark class="highlight">$1</mark>');
  return result;
}

// Handle search input changes
function handleSearchInput(): void {
  try {
    const query = safeTrim(searchQuery.value);

  if (!query) {
      isInputFocused: isInputFocused.value,
      searchHistoryLength: searchHistory.value?.length || 0,
      showSearchHistory: showSearchHistory.value,
      showSearchDropdown: showSearchDropdown.value
    });

    searchResults.value = [];
    showSearchDropdown.value = false;
    selectedIndex.value = -1;

    // History should only show when BOTH conditions are met: focused AND empty
    if (isInputFocused.value && Array.isArray(searchHistory.value) && searchHistory.value.length > 0) {
      showSearchHistory.value = true;
    } else {
      showSearchHistory.value = false;
    }
    return;
  }

  // Hide history when there is any search content - history should only show when BOTH empty AND focused
  showSearchHistory.value = false;

  // Hide history when typing longer queries
  showSearchHistory.value = false;

    // Show dropdown immediately when user starts typing
    if (query.length >= 1) {
      showSearchDropdown.value = true;
      // Use debounce to prevent excessive API calls
      debounceSearch(() => {
        performSearch();
      }, 300);
    }
  } catch (error) {
    searchResults.value = [];
    showSearchDropdown.value = false;
    showSearchHistory.value = false;
    selectedIndex.value = -1;
  }
}

// Safe trim function to handle non-string values
function safeTrim(value: any): string {
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
  } catch (error) {
    return '';
  }
}

// Debounce function for search input
let searchTimeout: number | null = null;
function debounceSearch(func: () => void, delay: number = 300): void {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = window.setTimeout(func, delay);
}

// Watch for search query changes with debouncing to prevent ResizeObserver loops
let watchTimeout: number | null = null;
watch(searchQuery, (newQuery) => {
  const query = safeTrim(newQuery);

  // Clear previous timeout to prevent rapid firing
  if (watchTimeout) {
    window.clearTimeout(watchTimeout);
  }

  // Debounce the watch handler to prevent ResizeObserver loops
  watchTimeout = window.setTimeout(() => {
    if (!query) {
      // Only update if values actually changed to prevent unnecessary re-renders
      if (searchResults.value.length > 0) {
        searchResults.value = [];
      }
      if (showSearchDropdown.value) {
        showSearchDropdown.value = false;
      }
      if (selectedIndex.value !== -1) {
        selectedIndex.value = -1;
      }

      // Show search history when input is focused and empty
      const shouldShowHistory = isInputFocused.value &&
                               Array.isArray(searchHistory.value) &&
                               searchHistory.value.length > 0;

      if (showSearchHistory.value !== shouldShowHistory) {
        showSearchHistory.value = shouldShowHistory;
      }
    }
  }, 50); // Small debounce delay
});

// Search functionality
async function performSearch(): Promise<void> {
  const query = safeTrim(searchQuery.value);

  if (!query) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;
  const startTime = Date.now();

  try {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'searchBookmarks',
          query: query,
          mode: searchMode.value
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          // Ensure response is a valid object
          if (!response || typeof response !== 'object') {
            resolve({ results: [], stats: {} });
            return;
          }

          resolve(response);
        }
      );
    });

      // Safely handle search results with enhanced type checking
    let results: any[] = [];
    try {
      if (response && typeof response === 'object' && 'results' in response) {
        const rawResults = response.results;
        if (Array.isArray(rawResults)) {
          results = rawResults;
        } else if (rawResults) {
          results = [];
        } else {
          results = [];
        }
      } else {
        results = [];
      }
    } catch (error) {
      results = [];
    }
    searchResults.value = results;

    // Debug: Log search results for analysis

    searchStats.value = {
      totalBookmarks: response.stats?.totalBookmarks || 0,
      searchTime: response.stats?.searchTime || (Date.now() - startTime),
      resultsCount: searchResults.value.length
    };

    // Show dropdown if we have search content (to show results or "no results" message)
    // But if query is empty, don't show dropdown (let history show instead)
    const currentQuery = safeTrim(searchQuery);
    if (!currentQuery) {

      // Only update if values actually changed to prevent unnecessary re-renders
      if (showSearchDropdown.value) {
        showSearchDropdown.value = false;
      }
      if (selectedIndex.value !== -1) {
        selectedIndex.value = -1;
      }

      // Check if we should show history
      const shouldShowHistory = isInputFocused.value &&
                               Array.isArray(searchHistory.value) &&
                               searchHistory.value.length > 0;

      if (showSearchHistory.value !== shouldShowHistory) {
        showSearchHistory.value = shouldShowHistory;
      }
    } else {
      // Only update if values actually changed
      const shouldShowDropdown = searchResults.value.length > 0 || !!currentQuery;
      if (showSearchDropdown.value !== shouldShowDropdown) {
        showSearchDropdown.value = shouldShowDropdown;
      }

      if (selectedIndex.value !== -1) {
        selectedIndex.value = -1; // Reset selection
      }

      if (showSearchHistory.value) {
        showSearchHistory.value = false; // Hide history when showing results
      }
    }

    // Add to search history only if we have results (with enhanced type safety)
    if (searchResults.value.length > 0 && query && typeof query === 'string') {
      try {
        if (Array.isArray(searchHistory.value)) {
          const historyArray = searchHistory.value as string[];
          if (!historyArray.includes(query)) {
            historyArray.unshift(query);
            // Keep only last 10 searches
            if (historyArray.length > 10) {
              searchHistory.value = historyArray.slice(0, 10);
            } else {
              searchHistory.value = historyArray;
            }
            // Save to storage
            chrome.storage.local.set({ searchHistory: searchHistory.value });
          }
        } else {
          // Reset search history if it's corrupted
          searchHistory.value = [query];
          chrome.storage.local.set({ searchHistory: searchHistory.value });
        }
      } catch (error) {
        // Reset to empty array on error
        searchHistory.value = [];
      }
    }

    // Check if there was a backend error
    if (response.error) {
    }

  } catch (error) {
    searchResults.value = [];
    // Keep dropdown visible to show error message if there's search content
    showSearchDropdown.value = !!safeTrim(searchQuery);
    selectedIndex.value = -1;
  } finally {
    isSearching.value = false;

    // Update last search tracking after successful search
    const currentQuery = safeTrim(searchQuery.value);
    if (currentQuery && searchResults.value.length >= 0) { // >= 0 to include empty results
      lastSearchQuery.value = currentQuery;
      lastSearchMode.value = searchMode.value;
    }
  }
}

// Load search history on mount
function loadSearchHistory(): void {
  chrome.storage.local.get('searchHistory', (data) => {
    if (data.searchHistory && Array.isArray(data.searchHistory)) {
      searchHistory.value = data.searchHistory;
    } else {
      searchHistory.value = [];
    }
  });
}

// Placeholder is now fixed in template

// Handle search shortcut - focus on search input
function focusSearchInput(): void {
  // Keep popup open and focus on search input
  const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}

// Handle search mode change with smart re-search logic
function handleModeChange(newMode: string): void {
  if (searchMode.value === newMode) return;

  const currentQuery = safeTrim(searchQuery.value);

  // If there's a current search query and it's different from last search, or mode changed
  if (currentQuery && (currentQuery !== lastSearchQuery.value || searchMode.value !== lastSearchMode.value)) {
    searchMode.value = newMode as 'fast' | 'smart';
    performSearch();
  } else {
    // Just update mode without searching
    searchMode.value = newMode as 'fast' | 'smart';
  }

  // Update last search tracking
  lastSearchQuery.value = currentQuery;
  lastSearchMode.value = newMode as 'fast' | 'smart';
  showModeSelector.value = false;
}

// Focus input when component is mounted
let isInputFocused = ref(false);

// --- Lifecycle Hooks ---
onMounted(() => {
  chrome.bookmarks.getTree((tree) => {
    const totalStats = countBookmarks(tree);
    totalStats.folders = totalStats.folders > 0 ? totalStats.folders - 1 : 0;
    stats.value = totalStats;
  });

  // Load search history
  loadSearchHistory();

  // Add window event listeners for better UX
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('click', handleWindowClick);

  // Focus search input when popup opens
  setTimeout(() => {
    focusSearchInput();
    isInputFocused.value = true;
  }, 100);
});

// Cleanup function for ResizeObserver loop prevention
onUnmounted(() => {
  // Clear any pending timeouts to prevent ResizeObserver loops
  if (watchTimeout) {
    window.clearTimeout(watchTimeout);
    watchTimeout = null;
  }
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
    searchTimeout = null;
  }
});
</script>

<template>
  <div class="search-popup-container" @click="handleWindowClick">
    <div class="search-popup-content" @click.stop>
      <!-- 简化的搜索区域 -->
      <div class="search-section">
        <!-- 搜索输入框和模式选择器 -->
        <div class="search-container">
          <div class="search-input-wrapper">
            <v-text-field
              ref="searchInput"
              v-model="searchQuery"
              placeholder="搜索书签..."
              variant="solo"
              density="comfortable"
              :loading="isSearching"
              prepend-inner-icon="mdi-magnify"
              hide-details
              class="search-input"
              @input="handleSearchInput"
              @keydown="handleSearchKeydown"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
              @update:modelValue="(value) => {
                searchQuery = value;
              }"
            />

            <!-- 搜索模式选择器 -->
            <div class="mode-selector">
              <v-btn
                variant="text"
                size="small"
                :class="['mode-toggle-btn', { 'active': showModeSelector }]"
                @click.stop="showModeSelector = !showModeSelector"
              >
                <span class="mode-label">{{ searchModeOptions.find(opt => opt.value === searchMode)?.label }}</span>
                <v-icon size="16" :class="{ 'rotated': showModeSelector }">
                  mdi-chevron-down
                </v-icon>
              </v-btn>

              <!-- 模式选择下拉菜单 -->
              <div
                v-if="showModeSelector"
                class="mode-dropdown"
                @click.stop
              >
                <div
                  v-for="option in searchModeOptions"
                  :key="option.value"
                  :class="['mode-option', { 'selected': option.value === searchMode }]"
                  @click="handleModeChange(option.value)"
                >
                  <div class="mode-option-header">
                    <span class="mode-option-label">{{ option.label }}</span>
                    <v-icon
                      v-if="option.value === searchMode"
                      size="16"
                      color="#007aff"
                    >
                      mdi-check
                    </v-icon>
                  </div>
                  <div class="mode-option-desc">{{ option.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 简化的结果下拉列表 -->
          <div
            v-if="showSearchDropdown || showSearchHistory"
            class="search-dropdown"
            @mousedown.prevent
          >
            <div class="dropdown-content">
              <!-- 搜索结果 -->
              <div v-if="showSearchDropdown">
                <div
                  v-for="(bookmark, index) in searchResults.slice(0, maxDropdownItems)"
                  :key="bookmark?.id || index"
                  :class="['result-item', { 'selected': selectedIndex === index }]"
                  @click="selectDropdownItem(bookmark)"
                >
                  <div class="result-icon">
                    <v-img
                      :src="`https://www.google.com/s2/favicons?domain=${getHostname(bookmark.url)}&sz=16`"
                      width="16"
                      height="16"
                      alt=""
                    >
                      <template v-slot:error>
                        <v-icon size="16">mdi-bookmark-outline</v-icon>
                      </template>
                    </v-img>
                  </div>
                  <div class="result-content">
                    <div class="result-title" v-html="highlightText(bookmark.title, searchQuery)"></div>
                    <div class="result-url" v-html="highlightText(bookmark.url, searchQuery)"></div>
                  </div>
                </div>

                <!-- 无结果提示 -->
                <div
                  v-if="searchResults.length === 0 && safeTrim(searchQuery)"
                  class="no-results"
                >
                  <v-icon size="20" color="grey">mdi-magnify</v-icon>
                  <span>未找到匹配的书签</span>
                </div>
              </div>

              <!-- 搜索历史 -->
              <div v-if="showSearchHistory && !showSearchDropdown">
                <div
                  v-for="(query, index) in searchHistory.slice(0, maxDropdownItems)"
                  :key="index"
                  :class="['history-item', { 'selected': selectedIndex === index }]"
                  @click="searchQuery = query; handleSearchInput()"
                >
                  <v-icon size="16">mdi-history</v-icon>
                  <span>{{ query }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 简洁的Mac风格聚焦搜索样式 */
.search-popup-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-start; /* 改为flex-start，让内容从顶部开始 */
  justify-content: center;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  padding: 80px 20px 20px; /* 在顶部和底部添加一些内边距 */
}

.search-popup-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(40px);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 600px;
  overflow: hidden;
  position: relative;
}

/* 搜索区域 - 极简设计 */
.search-section {
  padding: 0;
  background: transparent;
}

.search-container {
  position: relative;
  width: 100%;
}

/* 搜索输入框包装器 */
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
}

/* 搜索模式选择器 */
.mode-selector {
  position: relative;
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.mode-toggle-btn {
  height: 44px !important;
  min-width: auto !important;
  padding: 8px 12px !important;
  border-radius: 6px !important;
  background: rgba(0, 0, 0, 0.05) !important;
  color: #86868b !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  border: none !important;
  transition: all 0.15s ease !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.mode-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.08) !important;
  color: #1d1d1f !important;
}

.mode-toggle-btn.active {
  background: rgba(0, 0, 0, 0.1) !important;
  color: #1d1d1f !important;
}

.mode-label {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.mode-toggle-btn .v-icon.rotated {
  transform: rotate(180deg);
  transition: transform 0.2s ease;
}

/* 模式选择下拉菜单 */
.mode-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  z-index: 1000;
  overflow: hidden;
}

.mode-option {
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.mode-option:last-child {
  border-bottom: none;
}

.mode-option:hover {
  background: rgba(0, 0, 0, 0.03);
}

.mode-option.selected {
  background: rgba(0, 7, 175, 0.05);
}

.mode-option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.mode-option-label {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}

.mode-option-desc {
  font-size: 11px;
  color: #86868b;
  line-height: 1.2;
}

/* 搜索输入框 - 无边距设计 */
.search-input {
  margin: 0;
  padding: 0;
  flex: 1;
}

.search-input .v-field {
  border-radius: 6px 0 0 6px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  border: none !important;
  box-shadow: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

.search-input .v-field__input {
  font-size: 18px !important;
  font-weight: 400;
  color: #1d1d1f !important;
  padding: 12px 16px !important;
  border-radius: 6px 0 0 6px !important;
  margin: 0 !important;
}

.search-input .v-field__prepend-inner {
  margin-right: 8px;
  color: #86868b;
  padding-left: 4px;
}

/* 下拉列表 - 紧凑设计 */
.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 999999;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 400px;
  overflow-y: auto;
  margin-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top: none;
}

.dropdown-content {
  padding: 4px 0;
}

/* 结果项 - 极简紧凑设计 */
.result-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-radius: 4px;
  margin: 1px 4px;
}

.result-item:hover,
.result-item.selected {
  background-color: rgba(0, 0, 0, 0.05);
}

.result-item.selected {
  background-color: rgba(0, 0, 0, 0.08);
}

.result-icon {
  flex-shrink: 0;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
  line-height: 1.2;
  margin-bottom: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-url {
  font-size: 11px;
  color: #86868b;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 搜索历史项 */
.history-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-radius: 4px;
  margin: 1px 4px;
}

.history-item:hover,
.history-item.selected {
  background-color: rgba(0, 0, 0, 0.05);
}

.history-item.selected {
  background-color: rgba(0, 0, 0, 0.08);
}

.history-item .v-icon {
  margin-right: 8px;
  color: #86868b;
  font-size: 14px;
}

.history-item span {
  font-size: 13px;
  color: #1d1d1f;
}

/* 无结果提示 */
.no-results {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #86868b;
  font-size: 13px;
}

.no-results .v-icon {
  margin-right: 6px;
  font-size: 14px;
}

/* 高亮样式 */
.highlight {
  background-color: #007aff !important;
  color: white !important;
  padding: 0 2px !important;
  border-radius: 2px !important;
  font-weight: 500 !important;
}

/* 滚动条样式 */
.search-dropdown::-webkit-scrollbar {
  width: 6px;
}

.search-dropdown::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.search-dropdown::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.search-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .search-popup-content {
    width: 95vw;
    margin: 0 10px;
  }

  .search-input .v-field__input {
    font-size: 16px !important;
    padding: 14px 16px !important;
  }

  .result-item,
  .history-item {
    padding: 10px 12px;
  }
}

/* 确保在不同主题下的一致性 */
.v-theme--light .search-popup-content {
  background: rgba(255, 255, 255, 0.95);
}

.v-theme--dark .search-popup-content {
  background: rgba(0, 0, 0, 0.95);
}

.v-theme--dark .result-title,
.v-theme--dark .history-item span {
  color: #f5f5f7;
}

.v-theme--dark .result-url {
  color: #86868b;
}

.v-theme--dark .search-input .v-field {
  background: rgba(0, 0, 0, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

.v-theme--dark .search-input .v-field__input {
  color: #f5f5f7 !important;
}

/* 暗色主题下的模式选择器 */
.v-theme--dark .mode-toggle-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #86868b !important;
}

.v-theme--dark .mode-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  color: #f5f5f7 !important;
}

.v-theme--dark .mode-toggle-btn.active {
  background: rgba(255, 255, 255, 0.2) !important;
  color: #f5f5f7 !important;
}

.v-theme--dark .mode-dropdown {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
}

.v-theme--dark .mode-option {
  border-color: rgba(255, 255, 255, 0.1);
}

.v-theme--dark .mode-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.v-theme--dark .mode-option.selected {
  background: rgba(0, 7, 175, 0.1);
}

.v-theme--dark .mode-option-label {
  color: #f5f5f7;
}

.v-theme--dark .mode-option-desc {
  color: #86868b;
}
</style>
