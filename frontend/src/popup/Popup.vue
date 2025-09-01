<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

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
const searchMode = ref<'fast' | 'smart' | 'content'>('fast'); // 'fast', 'smart', or 'content'

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
  const query = searchQuery.value?.trim();
  if (!query) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;
  const startTime = Date.now();

  try {
    // Add to search history if not already there
    if (!searchHistory.value.includes(query)) {
      searchHistory.value.unshift(query);
      // Keep only last 10 searches
      if (searchHistory.value.length > 10) {
        searchHistory.value = searchHistory.value.slice(0, 10);
      }
      // Save to storage
      chrome.storage.local.set({ searchHistory: searchHistory.value });
    }

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

    // Safely handle search results
    const results = response.results || [];
    searchResults.value = Array.isArray(results) ? results : [];
    searchStats.value = {
      totalBookmarks: response.stats?.totalBookmarks || 0,
      searchTime: response.stats?.searchTime || (Date.now() - startTime),
      resultsCount: searchResults.value.length
    };

    showSearchHistory.value = false; // Hide history when showing results

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
  } finally {
    isSearching.value = false;
  }
}

// Load search history on mount
function loadSearchHistory(): void {
  chrome.storage.local.get('searchHistory', (data) => {
    if (data.searchHistory) {
      searchHistory.value = data.searchHistory;
    }
  });
}

// Handle search history selection
function selectFromHistory(query: string): void {
  searchQuery.value = query;
  performSearch();
}

// Toggle search history visibility
function toggleSearchHistory(): void {
  showSearchHistory.value = !showSearchHistory.value;
}

// Get search placeholder based on mode
function getSearchPlaceholder(): string {
  switch (searchMode.value) {
    case 'fast':
      return '输入网站名称或域名...';
    case 'smart':
      return '描述你想找的网站...';
    case 'content':
      return '描述网站内容关键词...';
    default:
      return '输入搜索关键词...';
  }
}

// Get search mode display name
function getSearchModeName(): string {
  switch (searchMode.value) {
    case 'fast':
      return '快速搜索';
    case 'smart':
      return '智能搜索';
    case 'content':
      return '内容搜索';
    default:
      return '搜索';
  }
}

// Get search mode description
function getSearchModeDescription(): string {
  switch (searchMode.value) {
    case 'fast':
      return '基于网站标题和域名进行精确匹配，速度最快';
    case 'smart':
      return '使用AI理解你的搜索意图，智能匹配相关网站';
    case 'content':
      return '分析网站内容，寻找相关主题和关键词';
    default:
      return '选择搜索模式开始查找';
  }
}

// Open bookmark in new tab
function openBookmark(bookmark: any): void {
  if (bookmark && bookmark.url) {
    chrome.tabs.create({ url: bookmark.url });
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

// Watch for search query changes
watch(searchQuery, (newQuery) => {
  if (newQuery && newQuery.length >= 2) {
    performSearch();
  } else {
    searchResults.value = [];
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

  // Logo diagnosis commented out for production
  // setTimeout(() => {
  //   console.log('🕐 Running logo diagnosis...');
  //   diagnoseLogo();
  // }, 1000);
});
</script>

<template>
  <v-app style="width: 380px; min-height: 500px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%); padding: 16px; box-sizing: border-box;">
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
      <h4 class="mb-1" style="color: #1f2937; font-weight: 600; font-size: 18px;">AcuityBookmarks</h4>
      <p class="popup-subtitle">您的智能书签助手</p>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">
      <!-- 搜索模式切换 -->
      <div class="search-mode-selector">
        <v-btn-toggle
          v-model="searchMode"
          mandatory
          size="small"
          variant="outlined"
          density="compact"
          color="primary"
          class="mb-3"
        >
          <v-btn value="fast" class="mode-btn">
            <v-icon size="16" class="mr-1">mdi-lightning-bolt</v-icon>
            快速搜索
          </v-btn>
          <v-btn value="smart" class="mode-btn">
            <v-icon size="16" class="mr-1">mdi-brain</v-icon>
            智能搜索
          </v-btn>
          <v-btn value="content" class="mode-btn">
            <v-icon size="16" class="mr-1">mdi-file-document-outline</v-icon>
            内容搜索
          </v-btn>
        </v-btn-toggle>

        <!-- 搜索历史按钮 -->
        <v-btn
          size="small"
          variant="text"
          @click="toggleSearchHistory"
          class="history-btn"
        >
          <v-icon size="16">mdi-history</v-icon>
        </v-btn>
      </div>

      <!-- 搜索历史 -->
      <div v-if="showSearchHistory && searchHistory.length > 0" class="search-history">
        <div class="history-header">
          <span class="text-caption text-medium-emphasis">搜索历史</span>
          <v-btn size="small" variant="text" @click="searchHistory = []">清空</v-btn>
        </div>
        <v-list dense class="history-list">
          <v-list-item
            v-for="query in searchHistory"
            :key="query"
            @click="selectFromHistory(query)"
            class="history-item"
          >
            <template v-slot:prepend>
              <v-icon size="16" color="grey">mdi-clock-outline</v-icon>
            </template>
            <v-list-item-title class="text-body-2">{{ query }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </div>

      <!-- 搜索输入框 -->
      <v-text-field
        v-model="searchQuery"
        :label="getSearchPlaceholder()"
        variant="outlined"
        density="comfortable"
        :loading="isSearching"
        prepend-inner-icon="mdi-magnify"
        clearable
        hide-details
        class="search-input"
        @keydown.enter="performSearch"
      >
        <template v-slot:append-inner>
          <v-btn
            size="small"
            variant="text"
            @click="performSearch"
            :disabled="!searchQuery?.trim()"
            class="search-btn"
          >
            <v-icon size="16">mdi-magnify</v-icon>
          </v-btn>
        </template>
      </v-text-field>

      <!-- 搜索统计信息 -->
      <div v-if="searchStats.resultsCount > 0" class="search-stats">
        <span class="text-caption text-medium-emphasis">
          找到 {{ searchStats.resultsCount }} 个结果
          <span v-if="searchStats.searchTime">({{ searchStats.searchTime }}ms)</span>
        </span>
      </div>

      <!-- 搜索模式说明 -->
      <div class="search-mode-info">
        <div class="text-caption">
          <strong>{{ getSearchModeName() }}:</strong> {{ getSearchModeDescription() }}
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="searchResults.length > 0" class="search-results">
        <v-list dense class="pa-0" style="max-height: 300px; overflow-y: auto;">
          <v-list-item
            v-for="(bookmark, index) in searchResults"
            :key="bookmark?.id || index"
            @click="openBookmark(bookmark)"
            class="px-0"
          >
            <template v-slot:prepend>
              <v-avatar size="24" class="mr-3">
                <v-img
                  :src="`https://www.google.com/s2/favicons?domain=${getHostname(bookmark.url)}&sz=32`"
                  alt=""
                >
                  <template v-slot:error>
                    <v-icon size="small">mdi-bookmark-outline</v-icon>
                  </template>
                </v-img>
              </v-avatar>
            </template>

            <v-list-item-title class="text-body-2">
              {{ bookmark.title }}
            </v-list-item-title>

            <v-list-item-subtitle class="text-caption text-medium-emphasis">
              {{ getHostname(bookmark.url) }}
            </v-list-item-subtitle>

            <template v-slot:append>
              <v-icon size="small" color="primary">mdi-open-in-new</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </div>

      <div v-else-if="searchQuery && searchQuery.length >= 2 && !isSearching" class="text-center text-caption text-medium-emphasis py-4">
        未找到匹配的书签
      </div>
    </div>

    <!-- 统计区域 -->
    <div class="stats-section">
      <div class="text-overline">概览</div>
      <v-row dense class="text-center my-2">
        <v-col>
          <v-icon color="primary">mdi-bookmark-multiple-outline</v-icon>
          <div class="text-h6">{{ stats.bookmarks }}</div>
          <div class="text-caption">书签总数</div>
        </v-col>
        <v-col>
          <v-icon color="primary">mdi-folder-outline</v-icon>
          <div class="text-h6">{{ stats.folders }}</div>
          <div class="text-caption">文件夹</div>
        </v-col>
      </v-row>
      <div class="text-caption text-center text-grey mb-3">{{ lastProcessedInfo }}</div>
    </div>

    <!-- 按钮区域 -->
    <div class="actions-section">
      <v-btn @click="openAiOrganizePage" block color="primary" prepend-icon="mdi-auto-fix-high" class="mb-2">
        一键 AI 整理
      </v-btn>
      <v-btn @click="openManualOrganizePage" block color="blue" prepend-icon="mdi-cog" variant="outlined">
        手动整理
      </v-btn>

      <div class="d-flex justify-center align-center mt-3 flex-column">
          <v-btn
            @click="clearCacheAndRestructure"
            variant="text"
            size="small"
            class="clear-btn"
            :disabled="isClearingCache"
          >
            <span v-if="!isClearingCache">清除缓存</span>
            <span v-else>正在清除...</span>
          </v-btn>
          <v-tooltip location="top">
            <template v-slot:activator="{ props }">
              <v-icon v-bind="props" size="x-small" class="ml-1">mdi-help-circle-outline</v-icon>
            </template>
            <span>为了加快分析速度，AI会缓存已成功访问的网页内容。若您觉得分类结果不准，可清除缓存后重试。</span>
          </v-tooltip>
      </div>

      <!-- Keyboard Shortcuts Section -->
      <v-divider class="my-4"></v-divider>
      <div class="shortcuts-section">
        <div class="d-flex align-center mb-3">
          <v-icon size="small" class="mr-2">mdi-keyboard</v-icon>
          <span class="text-subtitle-2 font-weight-medium">快捷键</span>
          <v-spacer></v-spacer>
          <v-btn
            size="small"
            variant="text"
            @click="openKeyboardShortcuts"
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
  padding: 20px 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  margin-bottom: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.popup-subtitle {
  color: #4b5563;
  font-size: 13px;
  margin-top: 4px;
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
}

/* 统计区域样式 */
.stats-section {
  padding: 20px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

/* 按钮区域样式 */
.actions-section {
  padding: 20px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Logo styles */
.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  background: transparent;
  border-radius: 50%;
  padding: 4px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.logo-container svg {
  width: 56px;
  height: 56px;
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
}

/* 副标题样式 */
.text-caption {
  color: #6b7280 !important;
  font-weight: 400 !important;
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

.mode-btn {
  font-size: 12px !important;
  padding: 4px 8px !important;
  min-height: 32px !important;
}

.mode-btn .v-icon {
  margin-right: 4px !important;
}

.history-btn {
  min-width: 32px !important;
  width: 32px !important;
  height: 32px !important;
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

/* 搜索模式说明样式 */
.search-mode-info {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  border-left: 3px solid #1f7bbd;
}

.search-mode-info .text-caption {
  line-height: 1.4;
}

/* 响应式调整 */
@media (max-width: 400px) {
  .search-mode-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .search-mode-selector .v-btn-toggle {
    margin-bottom: 8px;
  }

  .history-btn {
    align-self: flex-end;
  }
}
</style>
