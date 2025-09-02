<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

// --- Type Definitions ---
interface BookmarkStats {
  bookmarks: number;
  folders: number;
}

// interface BookmarkData {
//   title: string;
//   url: string;
// }

// --- Reactive State ---
const currentTab = ref<chrome.tabs.Tab | null>(null);
const stats = ref<BookmarkStats>({ bookmarks: 0, folders: 0 });
const lastProcessedInfo = ref('尚未进行过AI整理');
// const isAdding = ref(false);
// const addStatus = ref(''); // To provide feedback to the user
const isClearingCache = ref(false);

// Snackbar state for global feedback
const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref<'success' | 'error'>('success');

// Search functionality
const searchQuery = ref('');
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchMode = ref<'fast' | 'smart'>('fast'); // 'fast' or 'smart'

// Search dropdown
const showSearchDropdown = ref(false);
const selectedIndex = ref(-1);
const maxDropdownItems = 5;
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

// Popup behavior control
const isUserActive = ref(false);
const popupCloseTimeout = ref<number | null>(null);
const isInputFocused = ref(false);

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
// Note: smartBookmark function is currently not used in the new UI layout
// Keeping it for potential future use
// async function smartBookmark(): Promise<void> {
//   if (!currentTab.value || !currentTab.value.url) return;

//   isAdding.value = true;
//   addStatus.value = '检查书签...';

//   const bookmark: BookmarkData = {
//     title: currentTab.value.title || 'No Title',
//     url: currentTab.value.url,
//   };

//   chrome.runtime.sendMessage({ action: 'smartBookmark', bookmark }, (response) => {
//     if (chrome.runtime.lastError) {
//       addStatus.value = `错误: ${chrome.runtime.lastError.message}`;
//       isAdding.value = false;
//       console.error(chrome.runtime.lastError);
//       return;
//     }

//     if (response && response.status === 'success') {
//       addStatus.value = `已收藏到: ${response.folder}`;
//       setTimeout(() => window.close(), 1500);
//     } else if (response && response.status === 'cancelled') {
//       isAdding.value = false;
//       addStatus.value = '';
//     } else {
//       addStatus.value = `错误: ${response?.error || '未知错误'}`;
//       isAdding.value = false;
//     }
//   });
// }

function openAiOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPageAndOrganize' });
  window.close();
}

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPage' });
  window.close();
}

function showSnackbar(text: string, color: 'success' | 'error'): void {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
}

function clearCacheAndRestructure(): void {
  isClearingCache.value = true;
  chrome.runtime.sendMessage({ action: 'clearCacheAndRestructure' }, (response) => {
    if (chrome.runtime.lastError) {
      showSnackbar(`错误: ${chrome.runtime.lastError.message}`, 'error');
      console.error(chrome.runtime.lastError);
    } else if (response && response.status === 'success') {
      showSnackbar('缓存已成功清除！', 'success');
    } else {
      showSnackbar(`清除失败: ${response?.message || '未知错误'}`, 'error');
    }
    isClearingCache.value = false;
  });
}

function openKeyboardShortcuts(): void {
  // Open Chrome's extension shortcuts settings page
  chrome.tabs.create({
    url: 'chrome://extensions/shortcuts'
  });
  window.close();
}

// Logo debugging functions (commented out for production)
// const onLogoLoad = () => {
//   console.log('🎨 Logo SVG loaded successfully');
//   const logo = document.querySelector('.custom-logo-bg') as HTMLElement;
//   if (logo) {
//     console.log('Logo element:', logo);
//     console.log('Logo computed style:', getComputedStyle(logo));
//     console.log('Logo background-image:', getComputedStyle(logo).backgroundImage);

//     // Check if SVG is actually loaded
//     const bgImage = getComputedStyle(logo).backgroundImage;
//     if (bgImage && bgImage !== 'none') {
//       console.log('✅ SVG background-image loaded correctly');
//     } else {
//       console.log('❌ SVG background-image failed to load');
//     }
//   }
// };

// const onLogoError = () => {
//   console.error('❌ Logo SVG failed to load');
// };

// Diagnostic function to check logo display (commented out for production)
// const diagnoseLogo = () => {
//   console.log('🔍 === Logo Display Diagnosis ===');
//   const logo = document.querySelector('.custom-logo-bg') as HTMLElement;
//   if (logo) {
//     const style = getComputedStyle(logo);
//     console.log('Logo element found');
//     console.log('- Width:', logo.clientWidth, 'Height:', logo.clientHeight);
//     console.log('- Background:', style.background);
//     console.log('- Background-image:', style.backgroundImage);
//     console.log('- Background-size:', style.backgroundSize);
//     console.log('- Background-position:', style.backgroundPosition);

//     // Check parent container
//     const container = logo.parentElement;
//     if (container) {
//       const containerStyle = getComputedStyle(container);
//       console.log('Container styles:');
//       console.log('- Background:', containerStyle.background);
//       console.log('- Padding:', containerStyle.padding);
//     }

//     // Check if SVG is accessible
//     fetch('/logo.svg')
//       .then(response => {
//         if (response.ok) {
//           console.log('✅ SVG file is accessible');
//           return response.text();
//         } else {
//           console.log('❌ SVG file not accessible:', response.status);
//         }
//       })
//       .then(svgText => {
//         if (svgText) {
//           console.log('SVG content preview:', svgText.substring(0, 200) + '...');
//           if (svgText.includes('background-color')) {
//             console.log('✅ SVG has background-color setting');
//           } else {
//             console.log('⚠️ SVG missing background-color setting');
//           }
//         }
//       })
//       .catch(error => {
//         console.log('❌ Error fetching SVG:', error);
//       });
//   } else {
//     console.log('❌ Logo element not found');
//   }
// };

// Make diagnostic function available globally for debugging
// (window as any).diagnoseLogo = diagnoseLogo;

// Handle search shortcut - focus on search input
function focusSearchInput(): void {
  // Keep popup open and focus on search input
  const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}

// Search functionality
async function performSearch(): Promise<void> {
  const query = safeTrim(searchQuery.value);
  console.log('🔍 performSearch called with query:', query, 'mode:', searchMode.value);

  if (!query) {
    console.log('❌ Query is empty, clearing results');
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
        console.log('✅ Search completed successfully, results count:', results.length);
      } else if (rawResults) {
        console.warn('❌ Search results is not an array:', rawResults);
        results = [];
      } else {
        console.log('⚠️ No results found');
        results = [];
      }
    } else {
      console.warn('❌ Invalid response format:', response);
      results = [];
    }
  } catch (error) {
    console.warn('❌ Error processing search results:', error);
    results = [];
  }
  searchResults.value = results;

    // Debug: Log search results for analysis
    console.log('Search results for query:', query, 'mode:', searchMode.value);
    console.log('Results:', searchResults.value);
    console.log('Response:', response);

    searchStats.value = {
      totalBookmarks: response.stats?.totalBookmarks || 0,
      searchTime: response.stats?.searchTime || (Date.now() - startTime),
      resultsCount: searchResults.value.length
    };

    // Show dropdown if we have search content (to show results or "no results" message)
    // But if query is empty, don't show dropdown (let history show instead)
    const currentQuery = safeTrim(searchQuery);
    if (!currentQuery) {
      console.log('🔄 Query became empty during search, hiding dropdown and checking history');

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
        console.log('📚 Showing search history after empty search');
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
        console.warn('Error updating search history:', error);
        // Reset to empty array on error
        searchHistory.value = [];
      }
    }

    // Check if there was a backend error
    if (response.error) {
      console.warn('Backend search error:', response.error);
      showSnackbar(`搜索警告: ${response.error}`, 'error');
    }

  } catch (error) {
    console.error('Search failed:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    showSnackbar(`搜索失败: ${errorMessage}`, 'error');
    searchResults.value = [];
    // Keep dropdown visible to show error message if there's search content
    showSearchDropdown.value = !!safeTrim(searchQuery);
    selectedIndex.value = -1;
  } finally {
    isSearching.value = false;
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

// Toggle search history visibility
// Get search placeholder based on mode
function getSearchPlaceholder(): string {
  switch (searchMode.value) {
    case 'fast':
      return '输入网站名称或域名';
    case 'smart':
      return '描述你想找的网站';
    default:
      return '输入搜索关键词';
  }
}



// Open bookmark in new tab
function openBookmark(bookmark: any): void {
  if (bookmark && bookmark.url) {
    chrome.tabs.create({ url: bookmark.url });
    // Hide dropdown after opening bookmark
    showSearchDropdown.value = false;
    selectedIndex.value = -1;
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
      break;
  }
}

// Handle dropdown item click
function selectDropdownItem(bookmark: any): void {
  openBookmark(bookmark);
}

// Handle search input focus/blur
function handleSearchFocus(): void {
  isInputFocused.value = true;
  isUserActive.value = true;

  // Clear any pending close timeout
  if (popupCloseTimeout.value) {
    window.clearTimeout(popupCloseTimeout.value);
    popupCloseTimeout.value = null;
  }

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
    console.warn('Error in handleSearchFocus:', error);
    showSearchHistory.value = false;
    showSearchDropdown.value = false;
  }
}

function handleSearchBlur(): void {
  isInputFocused.value = false;

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
  isUserActive.value = true;

  // Clear any pending close timeout
  if (popupCloseTimeout.value) {
    window.clearTimeout(popupCloseTimeout.value);
    popupCloseTimeout.value = null;
  }
}

function handleWindowBlur(): void {
  // Don't close immediately, give user time to refocus
  isUserActive.value = false;

  // If user is actively typing or interacting, delay closing
  if (isInputFocused.value || safeTrim(searchQuery.value) || isSearching.value) {
    // Delay closing to give user time to continue
    popupCloseTimeout.value = window.setTimeout(() => {
      // Only close if user is still not active and not typing
      if (!isUserActive.value && !isInputFocused.value && !safeTrim(searchQuery.value) && !isSearching.value) {
        window.close();
      }
    }, 3000); // 3 second delay
  } else {
    // Close immediately if no active interaction
    window.close();
  }
}

function handleWindowClick(event: MouseEvent): void {
  // If click is on the popup content, mark user as active
  const target = event.target as HTMLElement;
  if (target.closest('.v-application')) {
    isUserActive.value = true;

    // Clear any pending close timeout
    if (popupCloseTimeout.value) {
      clearTimeout(popupCloseTimeout.value);
      popupCloseTimeout.value = null;
    }
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

  console.log('Highlight check:', { text: text.substring(0, 50), query, lowerText: lowerText.substring(0, 50), lowerQuery });

  // Check if text contains the query
  if (lowerText.indexOf(lowerQuery) === -1) {
    console.log('No direct match found for:', lowerQuery, 'in:', text.substring(0, 50));
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
        console.log('Found partial match:', match, 'in:', text.substring(0, 50));
        break;
      }
    }

    if (!hasMatch) {
      // If still no match, return original text
      console.log('No match found at all for:', lowerQuery, 'in:', text.substring(0, 50));
      return text;
    }

    return highlightedText;
  }

  // Create a regex to match the query (case-insensitive)
  const regex = new RegExp(`(${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

  // Replace matches with highlighted spans
  const result = text.replace(regex, '<mark class="highlight">$1</mark>');
  console.log('Applied highlighting for:', lowerQuery, 'in:', text.substring(0, 50), '->', result.substring(0, 100));
  return result;
}

// Handle search input changes
function handleSearchInput(): void {
  try {
    const query = safeTrim(searchQuery.value);
    console.log('⌨️ handleSearchInput called with query:', query, 'length:', query.length);

  if (!query) {
    console.log('🔄 Empty query detected, switching to history mode');
    console.log('📊 Current states:', {
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
      console.log('📚 Switching to history view');
      showSearchHistory.value = true;
    } else {
      console.log('🚫 No history available or not focused');
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
    console.warn('Error in handleSearchInput:', error);
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
    console.warn('safeTrim error:', error);
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
  if (popupCloseTimeout.value) {
    window.clearTimeout(popupCloseTimeout.value);
    popupCloseTimeout.value = null;
  }
});

// --- Lifecycle Hooks ---
onMounted(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
      currentTab.value = tabs[0];
    }
  });

  chrome.bookmarks.getTree((tree) => {
    const totalStats = countBookmarks(tree);
    totalStats.folders = totalStats.folders > 0 ? totalStats.folders - 1 : 0;
    stats.value = totalStats;
  });

  chrome.storage.local.get('processedAt', (data) => {
    if (data.processedAt) {
      const date = new Date(data.processedAt);
      lastProcessedInfo.value = `上次整理于: ${date.toLocaleString()}`;
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.action === 'focusSearch') {
      console.log('[Popup] Received focusSearch message');
      focusSearchInput();
    }
  });

  // Load search history
  loadSearchHistory();

  // Add window event listeners for better UX
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('click', handleWindowClick);

  // Logo diagnosis commented out for production
  // setTimeout(() => {
  //   console.log('🕐 Running logo diagnosis...');
  //   diagnoseLogo();
  // }, 1000);
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
      <!-- 搜索模式切换 -->
      <div class="search-mode-selector">
        <v-tabs
          v-model="searchMode"
          color="primary"
          grow
          class="mb-3"
          height="36"
        >
          <v-tab value="fast">
            <v-icon size="16" class="mr-2">mdi-lightning-bolt</v-icon>
            快速搜索
            <v-tooltip text="基于网站标题和域名进行精确匹配，速度最快" location="bottom" activator="parent">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="14" class="ml-2 info-icon">mdi-information-outline</v-icon>
              </template>
            </v-tooltip>
          </v-tab>
          <v-tab value="smart">
            <v-icon size="16" class="mr-2">mdi-brain</v-icon>
            AI搜索
            <v-tooltip text="智能匹配你书签中的相关网站" location="bottom" activator="parent">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="14" class="ml-2 info-icon">mdi-information-outline</v-icon>
              </template>
            </v-tooltip>
          </v-tab>
        </v-tabs>
      </div>

      <!-- 搜索输入框 -->
      <div class="search-container">
        <v-text-field
          ref="searchInput"
          v-model="searchQuery"
          :label="getSearchPlaceholder()"
          variant="outlined"
          density="comfortable"
          :loading="isSearching"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          class="search-input"
          @input="handleSearchInput"
          @keydown="handleSearchKeydown"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
          @update:modelValue="(value) => {
            console.log('🔄 v-model updated:', value);
            searchQuery = value;
          }"
        >

        </v-text-field>

        <!-- Search Dropdown -->
        <div
          v-if="showSearchDropdown"
          class="search-dropdown"
          @mousedown.prevent
        >
          <v-list dense class="dropdown-list">
            <!-- Search results count at the top -->
            <v-list-item v-if="searchStats.resultsCount > 0" class="search-stats-item" disabled>
              <v-list-item-title class="text-center text-caption text-medium-emphasis">
                找到 {{ searchStats.resultsCount }} 个结果
                <span v-if="searchStats.searchTime" class="text-disabled">({{ searchStats.searchTime }}ms)</span>
              </v-list-item-title>
            </v-list-item>

            <v-divider v-if="searchStats.resultsCount > 0"></v-divider>

            <v-list-item
              v-for="(bookmark, index) in searchResults.slice(0, maxDropdownItems)"
              :key="bookmark?.id || index"
              :class="{ 'selected': selectedIndex === index }"
              @click="selectDropdownItem(bookmark)"
              class="dropdown-item"
            >
              <template v-slot:prepend>
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
              </template>
              <v-list-item-title class="dropdown-title" v-html="highlightText(bookmark.title, searchQuery)"></v-list-item-title>
              <v-list-item-subtitle class="dropdown-url" v-html="highlightText(bookmark.url, searchQuery)"></v-list-item-subtitle>
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

            <!-- Show "no results" message when search has no matches -->
            <v-list-item
              v-if="searchResults.length === 0 && safeTrim(searchQuery)"
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
          v-if="showSearchHistory && !showSearchDropdown"
          class="search-dropdown"
          @mousedown.prevent
        >
          <v-list dense class="dropdown-list" v-if="Array.isArray(searchHistory)">
            <v-list-item
              v-for="(query, index) in searchHistory.slice(0, 5)"
              :key="index"
              :class="{ 'selected': selectedIndex === index }"
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
.search-mode-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

/* 搜索容器和下拉列表样式 */
.search-container {
  position: relative;
  width: 100%;
  z-index: 1000;
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
  /* 确保下拉列表在所有元素之上 */
  transform: translateZ(0);
  will-change: transform;
  /* 使用更高的堆叠上下文 */
  isolation: isolate;
}

.dropdown-list {
  padding: 0 !important;
}

.dropdown-item {
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-radius: 6px;
  margin: 2px 4px;
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
}

.search-input .v-field {
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.9) !important;
}

.search-input .v-field__input {
  font-size: 14px !important;
}

.search-input .v-field-label {
  font-size: 14px !important;
  line-height: 1.3 !important;
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
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
  .search-mode-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .search-mode-selector .v-tabs {
    margin-bottom: 8px;
  }

  .search-mode-selector .v-tab {
    min-height: 36px;
  }

  .search-mode-selector .v-tab .v-icon.info-icon {
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  .search-mode-selector .v-tab:hover .v-icon.info-icon {
    opacity: 1;
  }


}
</style>
