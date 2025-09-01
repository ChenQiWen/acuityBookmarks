<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

// --- Type Definitions ---
interface BookmarkStats {
  bookmarks: number;
  folders: number;
}

interface BookmarkData {
  title: string;
  url: string;
}

// --- Reactive State ---
const currentTab = ref<chrome.tabs.Tab | null>(null);
const stats = ref<BookmarkStats>({ bookmarks: 0, folders: 0 });
const lastProcessedInfo = ref('尚未进行过AI整理');
const isAdding = ref(false);
const addStatus = ref(''); // To provide feedback to the user
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

// Keyboard shortcuts info
const shortcuts = ref([
  {
    name: '打开管理页面',
    command: 'open-management',
    defaultKey: 'Alt+B',
    description: '打开书签管理页面'
  },
  {
    name: '智能保存书签',
    command: 'smart-bookmark',
    defaultKey: 'Alt+S',
    description: '保存当前页面为智能分类书签'
  },
  {
    name: '搜索书签',
    command: 'search-bookmarks',
    defaultKey: 'Alt+F',
    description: '打开搜索界面'
  }
]);


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
async function smartBookmark(): Promise<void> {
  if (!currentTab.value || !currentTab.value.url) return;

  isAdding.value = true;
  addStatus.value = '检查书签...';

  const bookmark: BookmarkData = {
    title: currentTab.value.title || 'No Title',
    url: currentTab.value.url,
  };

  chrome.runtime.sendMessage({ action: 'smartBookmark', bookmark }, (response) => {
    if (chrome.runtime.lastError) {
      addStatus.value = `错误: ${chrome.runtime.lastError.message}`;
      isAdding.value = false;
      console.error(chrome.runtime.lastError);
      return;
    }

    if (response && response.status === 'success') {
      addStatus.value = `已收藏到: ${response.folder}`;
      setTimeout(() => window.close(), 1500);
    } else if (response && response.status === 'cancelled') {
      isAdding.value = false;
      addStatus.value = '';
    } else {
      addStatus.value = `错误: ${response?.error || '未知错误'}`;
      isAdding.value = false;
    }
  });
}

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

// Logo debugging functions
const onLogoLoad = () => {
  console.log('🎨 Logo SVG loaded successfully');
  const logo = document.querySelector('.custom-logo-bg') as HTMLElement;
  if (logo) {
    console.log('Logo element:', logo);
    console.log('Logo computed style:', getComputedStyle(logo));
    console.log('Logo background-image:', getComputedStyle(logo).backgroundImage);

    // Check if SVG is actually loaded
    const bgImage = getComputedStyle(logo).backgroundImage;
    if (bgImage && bgImage !== 'none') {
      console.log('✅ SVG background-image loaded correctly');
    } else {
      console.log('❌ SVG background-image failed to load');
    }
  }
};

const onLogoError = () => {
  console.error('❌ Logo SVG failed to load');
};

// Diagnostic function to check logo display
const diagnoseLogo = () => {
  console.log('🔍 === Logo Display Diagnosis ===');
  const logo = document.querySelector('.custom-logo-bg') as HTMLElement;
  if (logo) {
    const style = getComputedStyle(logo);
    console.log('Logo element found');
    console.log('- Width:', logo.clientWidth, 'Height:', logo.clientHeight);
    console.log('- Background:', style.background);
    console.log('- Background-image:', style.backgroundImage);
    console.log('- Background-size:', style.backgroundSize);
    console.log('- Background-position:', style.backgroundPosition);

    // Check parent container
    const container = logo.parentElement;
    if (container) {
      const containerStyle = getComputedStyle(container);
      console.log('Container styles:');
      console.log('- Background:', containerStyle.background);
      console.log('- Padding:', containerStyle.padding);
    }

    // Check if SVG is accessible
    fetch('/logo.svg')
      .then(response => {
        if (response.ok) {
          console.log('✅ SVG file is accessible');
          return response.text();
        } else {
          console.log('❌ SVG file not accessible:', response.status);
        }
      })
      .then(svgText => {
        if (svgText) {
          console.log('SVG content preview:', svgText.substring(0, 200) + '...');
          if (svgText.includes('background-color')) {
            console.log('✅ SVG has background-color setting');
          } else {
            console.log('⚠️ SVG missing background-color setting');
          }
        }
      })
      .catch(error => {
        console.log('❌ Error fetching SVG:', error);
      });
  } else {
    console.log('❌ Logo element not found');
  }
};

// Make diagnostic function available globally for debugging
(window as any).diagnoseLogo = diagnoseLogo;

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

  // Run logo diagnosis after component is mounted
  setTimeout(() => {
    console.log('🕐 Running logo diagnosis...');
    diagnoseLogo();
  }, 1000);
});
</script>

<template>
  <v-app style="width: 350px; height: auto;">
    <div class="popup-header">
      <!-- 使用自定义SVG logo -->
      <div class="logo-container">
        <div class="custom-logo-bg" @load="onLogoLoad" @error="onLogoError"></div>
        <!-- 调试信息 -->
        <div class="debug-info" style="position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.8); color: white; font-size: 10px; padding: 2px; display: none;">
          Logo loaded
        </div>
      </div>
      <h4 class="mt-2">AcuityBookmarks</h4>
      <p class="popup-subtitle">您的智能书签助手</p>
    </div>

    <v-main class="pa-4">
      <!-- Quick Add Section -->
      <div v-if="currentTab">
        <div class="text-overline">快速收藏当前页面</div>
        <v-card variant="tonal" class="mb-3">
          <v-card-text>
            <p class="truncate font-weight-bold">{{ currentTab.title }}</p>
            <p class="truncate text-caption text-grey">{{ currentTab.url }}</p>
          </v-card-text>
        </v-card>
        <v-btn 
          :loading="isAdding" 
          @click="smartBookmark" 
          block 
          color="primary" 
          prepend-icon="mdi-auto-fix"
          class="mb-4"
          :disabled="isAdding"
        >
          <span v-if="!isAdding">智能收藏</span>
          <span v-else>{{ addStatus }}</span>
        </v-btn>
      </div>

      <!-- Search Section -->
      <div class="search-section">
        <v-divider class="my-4"></v-divider>
        <div class="d-flex align-center mb-3">
          <v-icon size="small" class="mr-2">mdi-magnify</v-icon>
          <span class="text-subtitle-2 font-weight-medium">搜索书签</span>
          <v-spacer></v-spacer>
          <v-btn-toggle
            v-model="searchMode"
            mandatory
            size="small"
            variant="outlined"
            density="compact"
          >
            <v-btn value="ai" class="text-caption">
              AI搜索
            </v-btn>
            <v-btn value="exact" class="text-caption">
              精确匹配
            </v-btn>
          </v-btn-toggle>
        </div>

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

      <!-- Dashboard Section -->
      <div>
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
              class="text-caption"
            >
              设置
              <v-icon size="x-small" class="ml-1">mdi-open-in-new</v-icon>
            </v-btn>
          </div>

          <v-list dense class="pa-0">
            <v-list-item
              v-for="shortcut in shortcuts"
              :key="shortcut.command"
              class="px-0 py-1"
            >
              <template v-slot:prepend>
                <v-chip
                  size="small"
                  variant="outlined"
                  class="text-caption font-weight-medium"
                  style="min-width: 60px;"
                >
                  {{ shortcut.defaultKey }}
                </v-chip>
              </template>

              <v-list-item-title class="text-body-2">
                {{ shortcut.name }}
              </v-list-item-title>

              <v-list-item-subtitle class="text-caption text-medium-emphasis">
                {{ shortcut.description }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </div>
      </div>
    </v-main>

    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
    </v-snackbar>
  </v-app>
</template>

<style>
/* 
  This global style is intended to fix the "ResizeObserver loop" error in verify.
  By preventing the root from scrolling, we can break the observation loop that occurs
  when the popup's content dynamically changes its height.
*/
html, body {
  overflow: hidden !important;
}
</style>

<style scoped>
.popup-header {
  background: linear-gradient(135deg, #2962ff, #004fc6);
  color: white;
  padding: 24px 20px;
  text-align: center;
}
.popup-subtitle {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
  font-weight: 300;
}
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.clear-btn {
    font-size: 12px !important;
    text-decoration: underline;
    color: #757575;
}

/* Logo styles */
.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto;
  background: transparent;
  border-radius: 8px;
  padding: 4px;
}

.custom-logo-bg {
  width: 56px;
  height: 56px;
  background: transparent !important;
  border: none !important;
  border-radius: 4px;
  /* 使用background-image来显示SVG，完全控制显示方式 */
  background-image: url('/logo.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

/* 确保SVG在所有容器中都保持透明背景 */
.custom-logo-bg {
  background: transparent !important;
  border: none !important;
  outline: none !important;
}
</style>
