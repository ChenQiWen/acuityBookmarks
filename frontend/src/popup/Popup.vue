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
const searchMode = ref<'exact' | 'ai'>('ai'); // 'exact' or 'ai'

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
  if (!searchQuery.value || !searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;

  try {
    const response = await new Promise<any[]>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'searchBookmarks',
          query: searchQuery.value || '',
          mode: searchMode.value
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response || []);
        }
      );
    });

    searchResults.value = response;
  } catch (error) {
    console.error('Search failed:', error);
    showSnackbar('搜索失败，请重试', 'error');
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

// Open bookmark in new tab
function openBookmark(bookmark: any): void {
  chrome.tabs.create({ url: bookmark.url });
}

// Helper function to get hostname safely
function getHostname(url: string): string {
  try {
    const urlObj = new (window as any).URL(url);
    return urlObj.hostname;
  } catch {
    return url;
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
      <!-- 使用自定义SVG logo -->
      <div class="logo-container">
        <div class="custom-logo-bg"></div>
      </div>
      <h4 class="mb-1" style="color: #1f2937; font-weight: 600; font-size: 18px;">AcuityBookmarks</h4>
      <p class="popup-subtitle">您的智能书签助手</p>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">
      <v-text-field
        v-model="searchQuery"
        label="输入搜索关键词..."
        variant="outlined"
        density="compact"
        :loading="isSearching"
        prepend-inner-icon="mdi-magnify"
        clearable
        hide-details
        class="mb-3"
      ></v-text-field>

      <!-- Search Results -->
      <div v-if="searchResults.length > 0" class="search-results">
        <v-list dense class="pa-0" style="max-height: 300px; overflow-y: auto;">
          <v-list-item
            v-for="bookmark in searchResults"
            :key="bookmark.id"
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
}

.custom-logo-bg {
  width: 56px;
  height: 56px;
  background: transparent !important;
  border: none !important;
  border-radius: 50%;
  background-image: url('./logo.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

/* 确保SVG在所有容器中都保持透明背景 */
.custom-logo-bg {
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
</style>
