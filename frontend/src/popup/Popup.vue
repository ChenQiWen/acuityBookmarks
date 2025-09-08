<template>
  <div class="popup-container">
    <!-- 加载状态 -->
    <div v-if="!isStoresReady" class="loading-container">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <p class="text-caption mt-2">正在初始化...</p>
      </div>

    <!-- 主内容 - 只有当stores都存在时才显示 -->
    <div v-else>
      <!-- Snackbar通知 -->
      <v-snackbar
        v-model="snackbar.show"
        :color="snackbar.color"
        location="top"
        :timeout="3000"
      >
        {{ snackbar.text }}
      </v-snackbar>

      <!-- 主内容 -->
      <v-container fluid class="pa-4">
      <!-- 搜索区域 -->
      <div class="search-section mb-4">
        <v-text-field
          ref="searchInput"
          v-model="searchQuery"
          :label="getSearchPlaceholder()"
          variant="outlined"
          density="comfortable"
          :loading="isSearching"
          :loading-text="isAIProcessing ? 'AI分析中...' : '搜索中...'"
          :disabled="isSearchDisabled"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          @input="handleSearchInput"
          @keydown="handleSearchKeydown"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
        >
          <!-- 搜索模式下拉菜单 -->
          <template v-slot:append-inner>
            <v-menu v-model="showSearchModeMenu" offset-y>
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
                  <v-icon size="16">
                    {{ searchMode === 'fast' ? 'mdi-lightning-bolt' : 'mdi-brain' }}
                  </v-icon>
                  <v-icon size="12">mdi-chevron-down</v-icon>
                </v-btn>
              </template>

              <v-list dense>
                <v-list-item @click="selectSearchMode('fast')">
                  <template v-slot:prepend>
                    <v-icon size="16" color="primary">mdi-lightning-bolt</v-icon>
                  </template>
                  <v-list-item-title>快速搜索</v-list-item-title>
                  <v-list-item-subtitle>基于书签标题和URL快速匹配</v-list-item-subtitle>
                </v-list-item>

                <v-list-item @click="selectSearchMode('smart')">
                  <template v-slot:prepend>
                    <v-icon size="16" color="secondary">mdi-brain</v-icon>
                  </template>
                  <v-list-item-title>AI搜索</v-list-item-title>
                  <v-list-item-subtitle>基于网页内容智能匹配</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </v-text-field>

        <!-- 搜索结果下拉框 -->
        <div v-if="showSearchDropdown" class="search-dropdown mt-2">
          <v-card elevation="8" rounded="lg">
            <v-list density="compact">
              <!-- AI搜索进度 -->
              <v-list-item v-if="isAIProcessing && searchProgress.stage">
                <template v-slot:prepend>
                  <v-icon color="secondary">mdi-brain</v-icon>
                </template>
                <v-list-item-title class="text-caption">
                  {{ searchProgress.message }}
                </v-list-item-title>
                <v-progress-linear
                  v-if="searchProgress.total > 0"
                  :model-value="((searchProgress.current || 0) / (searchProgress.total || 1)) * 100"
                  height="4"
                  color="secondary"
                  class="mt-2"
                ></v-progress-linear>
            </v-list-item>

              <!-- 搜索统计 -->
              <v-list-item v-if="searchResults.length > 0" disabled>
                <v-list-item-title class="text-caption">
                  找到 {{ searchResults.length }} 个结果
              </v-list-item-title>
            </v-list-item>

              <v-divider v-if="searchResults.length > 0"></v-divider>

              <!-- 搜索结果 -->
            <v-list-item
                v-for="(bookmark, index) in searchResults.slice(0, 5)"
              :key="bookmark?.id || index"
                :class="{ 'selected': selectedIndex === index }"
              @click="selectDropdownItem(bookmark)"
                class="bookmark-item"
            >
              <template v-slot:prepend>
                  <v-avatar size="20" class="mr-2">
                    <img
                      v-if="bookmark.favicon"
                      :src="bookmark.favicon"
                      @error="handleFaviconError"
                      alt="favicon"
                    />
                    <v-icon v-else size="16">mdi-bookmark</v-icon>
                  </v-avatar>
              </template>

                <v-list-item-title class="bookmark-title" v-html="highlightText(bookmark.title, searchQuery)"></v-list-item-title>
                <v-list-item-subtitle class="bookmark-url">
                  <div v-html="highlightText(getDomainFromUrl(bookmark.url), searchQuery)"></div>
              </v-list-item-subtitle>

                <!-- AI分数显示 -->
                <template v-slot:append v-if="bookmark._aiScore">
                  <v-chip size="x-small" :color="getAIScoreColor(bookmark._aiScore)">
                    AI: {{ bookmark._aiScore.toFixed(1) }}
                  </v-chip>
                </template>
            </v-list-item>

              <!-- 更多结果提示 -->
              <v-list-item v-if="searchResults.length > 5" disabled>
              <v-list-item-title class="text-center text-caption">
                  还有 {{ searchResults.length - 5 }} 个结果...
              </v-list-item-title>
            </v-list-item>

              <!-- AI错误信息 -->
              <v-list-item v-if="aiSearchError">
              <template v-slot:prepend>
                  <v-icon color="error">mdi-alert</v-icon>
              </template>
                <v-list-item-title class="text-error">
                {{ aiSearchError }}
              </v-list-item-title>
            </v-list-item>

              <!-- 无结果提示 -->
              <v-list-item v-if="searchResults.length === 0 && safeTrim(searchQuery) && !aiSearchError" disabled>
              <template v-slot:prepend>
                  <v-icon color="grey">mdi-magnify</v-icon>
              </template>
                <v-list-item-title>
                  没有找到相关书签
              </v-list-item-title>
            </v-list-item>
          </v-list>
          </v-card>
        </div>

        <!-- 搜索历史下拉框 -->
        <div v-if="showSearchHistory && !showSearchDropdown" class="search-dropdown mt-2">
          <v-card elevation="8" rounded="lg">
            <v-list density="compact">
            <v-list-item
              v-for="(query, index) in searchHistory.slice(0, 5)"
              :key="index"
                :class="{ 'selected': selectedIndex === index }"
                @click="selectHistoryItem(query)"
                class="history-item"
            >
              <template v-slot:prepend>
                  <v-icon size="16">mdi-history</v-icon>
              </template>
              <v-list-item-title>{{ query }}</v-list-item-title>
            </v-list-item>

            <v-divider v-if="searchHistory.length > 0"></v-divider>
              <v-list-item @click="clearSearchHistory" class="clear-history">
              <template v-slot:prepend>
                  <v-icon size="16" color="error">mdi-delete</v-icon>
              </template>
                <v-list-item-title class="text-error">清除搜索历史</v-list-item-title>
            </v-list-item>
          </v-list>
          </v-card>
      </div>
    </div>

      <!-- 统计信息 -->
      <v-row class="stats-section mb-4">
          <v-col cols="6">
          <v-card class="text-center pa-2" elevation="1">
            <div class="text-h6">{{ stats.bookmarks }}</div>
            <div class="text-caption">书签</div>
          </v-card>
          </v-col>
          <v-col cols="6">
          <v-card class="text-center pa-2" elevation="1">
            <div class="text-h6">{{ stats.folders }}</div>
            <div class="text-caption">文件夹</div>
          </v-card>
          </v-col>
        </v-row>

      <!-- 处理信息 -->
      <div class="text-caption text-center text-grey mb-4">
        {{ lastProcessedInfo }}
      </div>

      <!-- 操作按钮 -->
      <v-row class="action-buttons">
        <v-col cols="6">
          <v-btn
            @click="openAiOrganizePage"
            color="primary"
            variant="elevated"
            block
            prepend-icon="mdi-brain"
          >
            AI整理
          </v-btn>
        </v-col>
        <v-col cols="6">
          <v-btn
            @click="openManualOrganizePage"
            color="secondary"
            variant="elevated"
            block
            prepend-icon="mdi-folder-edit"
          >
            手动整理
          </v-btn>
        </v-col>
      </v-row>

      <v-row class="mt-2">
        <v-col cols="12">
          <v-btn
            @click="clearCacheAndRestructure"
            color="warning"
            variant="outlined"
            block
            prepend-icon="mdi-cached"
            :loading="isClearingCache"
          >
            <span v-if="!isClearingCache">清除缓存</span>
            <span v-else>清除中...</span>
          </v-btn>
        </v-col>
      </v-row>

      <!-- 快捷键提示 -->
      <div class="text-caption text-center text-grey mt-4">
        快捷键: Ctrl+K 搜索 | Alt+A AI整理 | Alt+M 手动整理
        </div>
      </v-container>
    </div> <!-- 关闭 v-else div -->
              </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { performanceMonitor } from '../utils/performance-monitor';

// Store实例 - 使用响应式引用以确保模板能正确更新
const uiStore = ref<any>(null);
const popupStore = ref<any>(null);

// 🛡️ 安全访问计算属性 - 统一所有store访问
const isStoresReady = computed(() => !!uiStore.value && !!popupStore.value);

const safeUIStore = computed(() => uiStore.value || {});
const safePopupStore = computed(() => popupStore.value || {});

// 🔍 搜索相关计算属性
const searchQuery = computed({
  get: () => safePopupStore.value.searchQuery || '',
  set: (value: string) => {
    if (popupStore.value) {
      popupStore.value.searchQuery = value;
    }
  }
});

const searchResults = computed(() => safePopupStore.value.searchResults || []);
const searchHistory = computed(() => safePopupStore.value.searchHistory || []);
const isSearching = computed(() => safePopupStore.value.isSearching || false);
const isAIProcessing = computed(() => safePopupStore.value.isAIProcessing || false);
const searchMode = computed(() => safePopupStore.value.searchMode || 'fast');
const isSearchDisabled = computed(() => safePopupStore.value.isSearchDisabled || false);
const aiSearchError = computed(() => safePopupStore.value.aiSearchError || '');
const isClearingCache = computed(() => safePopupStore.value.isClearingCache || false);

// 📊 统计信息计算属性
const stats = computed(() => safePopupStore.value.stats || { bookmarks: 0, folders: 0 });
const lastProcessedInfo = computed(() => safePopupStore.value.lastProcessedInfo || '准备就绪');

// 🔄 搜索进度计算属性
const searchProgress = computed(() => safePopupStore.value.searchProgress || {});

// 🔔 通知相关计算属性
const snackbar = computed(() => safeUIStore.value.snackbar || { show: false, text: '', color: 'info' });

// 临时移除，使用简化版本进行测试

// 本地UI状态
const showSearchModeMenu = ref(false);
const showSearchDropdown = ref(false);
const selectedIndex = ref(-1);
const searchInput = ref<any>(null);
const showSearchHistory = ref(false);
const isInputFocused = ref(false);
const isUserActive = ref(false);
const popupCloseTimeout = ref<number | null>(null);

// 搜索防抖
let searchTimeout: number | null = null;

// --- 工具函数 ---
function safeTrim(str: string | undefined | null): string {
  return (str || '').toString().trim();
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function highlightText(text: string, query: string): string {
  if (!query || !text) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function handleFaviconError(event: Event): void {
  const target = event.target as HTMLImageElement;
  target.style.display = 'none';
}

function getAIScoreColor(score: number): string {
  if (score >= 8) return 'success';
  if (score >= 5) return 'primary';
  if (score >= 3) return 'warning';
  return 'error';
}

// --- 搜索相关函数 ---
function getSearchPlaceholder(): string {
  switch (searchMode.value) {
    case 'fast':
      return '输入书签标题或URL关键字';
    case 'smart':
      return '输入网页内相关内容';
    default:
      return '输入搜索关键词';
  }
}

async function performSearch(): Promise<void> {
  if (!popupStore.value || !uiStore.value) {
    console.warn('Stores not initialized yet');
    return;
  }
  
  try {
    await popupStore.value.performSearch();
    updateSearchUI();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    if (popupStore.value.searchMode === 'smart' && errorMessage.includes('AI')) {
      uiStore.value.showWarning('AI搜索失败，已切换到快速搜索模式');
      popupStore.value.searchMode = 'fast';
      await performSearch();
    } else {
      uiStore.value.showError(`搜索失败: ${errorMessage}`);
    }
  }
}

function updateSearchUI(): void {
  const currentQuery = safeTrim(searchQuery.value);
  if (!currentQuery) {
    const shouldShowHistory = isInputFocused.value && searchHistory.value.length > 0;
    showSearchDropdown.value = false;
    showSearchHistory.value = shouldShowHistory;
    selectedIndex.value = -1;
  } else {
    const shouldShowDropdown = searchResults.value.length > 0 || !!currentQuery;
    showSearchDropdown.value = shouldShowDropdown;
    showSearchHistory.value = false;
    selectedIndex.value = -1;
  }
}

function debounceSearch(func: () => Promise<void>, delay: number): void {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = window.setTimeout(func, delay);
}

function handleSearchInput(): void {
  const query = safeTrim(searchQuery.value);
  if (!query) {
    updateSearchUI();
    return;
  }

  updateSearchUI();
  debounceSearch(performSearch, searchMode.value === 'smart' ? 1000 : 400);
}

function selectSearchMode(mode: 'fast' | 'smart'): void {
  if (!popupStore.value) return;
  
  popupStore.value.searchMode = mode;
  showSearchModeMenu.value = false;
  if (safeTrim(searchQuery.value)) {
    performSearch();
  }
}

function handleSearchKeydown(event: KeyboardEvent): void {
  if (!showSearchDropdown.value && !showSearchHistory.value) return;

  const items = showSearchDropdown.value ? searchResults.value : searchHistory.value;
  const maxIndex = Math.min(items.length, 5) - 1;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedIndex.value = selectedIndex.value < maxIndex ? selectedIndex.value + 1 : 0;
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : maxIndex;
      break;
    case 'Enter':
      event.preventDefault();
      if (selectedIndex.value >= 0 && selectedIndex.value < items.length) {
        if (showSearchDropdown.value) {
          selectDropdownItem(items[selectedIndex.value]);
        } else {
          selectHistoryItem(items[selectedIndex.value]);
        }
      }
      break;
    case 'Escape':
      event.preventDefault();
      showSearchDropdown.value = false;
      showSearchHistory.value = false;
      selectedIndex.value = -1;
      searchInput.value?.blur();
      break;
  }
}

function handleSearchFocus(): void {
  isInputFocused.value = true;
  isUserActive.value = true;
  if (popupCloseTimeout.value) {
    clearTimeout(popupCloseTimeout.value);
    popupCloseTimeout.value = null;
  }
  if (!safeTrim(searchQuery.value) && searchHistory.value.length > 0) {
    showSearchHistory.value = true;
    showSearchDropdown.value = false;
    selectedIndex.value = -1;
  } else if (safeTrim(searchQuery.value)) {
    showSearchDropdown.value = true;
    showSearchHistory.value = false;
    selectedIndex.value = -1;
  }
}

function handleSearchBlur(): void {
  isInputFocused.value = false;
  setTimeout(() => {
    if (!isInputFocused.value) {
      showSearchDropdown.value = false;
      showSearchHistory.value = false;
      selectedIndex.value = -1;
    }
  }, 150);
}

function selectDropdownItem(bookmark: any): void {
  if (bookmark?.url) {
    chrome.tabs.create({ url: bookmark.url });
    window.close();
  }
}

function selectHistoryItem(query: string): void {
  if (!popupStore.value) return;
  
  searchQuery.value = query;
  handleSearchInput();
}

function clearSearchHistory(): void {
  if (!popupStore.value) return;
  
  popupStore.value.searchHistory = [];
  showSearchHistory.value = false;
  chrome.storage.local.set({ searchHistory: [] });
}

// --- 操作函数 ---
function openAiOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPageAndOrganize' }, () => {
    setTimeout(() => window.close(), 1500);
  });
}

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPage', mode: 'manual' }, () => {
    setTimeout(() => window.close(), 1000);
  });
}

async function clearCacheAndRestructure(): Promise<void> {
  if (!popupStore.value || !uiStore.value) return;
  
  try {
    await popupStore.value.clearCache();
    uiStore.value.showSuccess('缓存已成功清除！');
    setTimeout(() => window.close(), 2000);
  } catch (error) {
    uiStore.value.showError(`清除失败: ${(error as Error).message}`);
  }
}

function focusSearchInput(): void {
  nextTick(() => {
    searchInput.value?.focus();
  });
}

// --- 监听器 ---
watch(() => searchQuery.value, (newQuery) => {
  if (!newQuery) {
    updateSearchUI();
  }
});

// --- 生命周期钩子 ---
onMounted(async () => {
  // 延迟动态导入stores避免初始化顺序问题
  try {
    console.log('开始动态导入stores...');
    
    // 动态导入stores
    const { useUIStore } = await import('../stores/ui-store');
    const { usePopupStore } = await import('../stores/popup-store');
    
    uiStore.value = useUIStore();
    popupStore.value = usePopupStore();
    
    console.log('Stores初始化完成');
    
    // 设置当前页面信息
    uiStore.value.setCurrentPage('popup', 'AcuityBookmarksPopup');
    
    // 测量启动时间
    const startupTimer = performanceMonitor.measureStartupTime();
    
    // 初始化Popup状态 - 增强错误处理
    console.log('开始初始化PopupStore...');
    try {
      await popupStore.value.initialize();
      console.log('PopupStore初始化成功');
    } catch (initError) {
      console.warn('PopupStore初始化失败，使用默认状态:', initError);
      // 即使初始化失败，也要确保基本状态可用
      if (uiStore.value) {
        uiStore.value.showWarning('部分功能初始化失败，但基本功能仍可使用');
      }
    }
    
    // 结束启动时间测量
    const startupTime = startupTimer.end();
    console.log(`弹窗加载完成 (${startupTime.toFixed(0)}ms)`);
    
  } catch (error) {
    console.error('Popup整体初始化失败:', error);
    // 即使出错也要确保stores可用，让界面能显示
    if (uiStore.value) {
      uiStore.value.showError(`初始化失败: ${(error as Error).message}`);
    }
  }

  // 监听消息
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'focusSearch') {
      focusSearchInput();
    }
  });

  // 全局快捷键
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
          clearCacheAndRestructure();
          return;
      }
    }
  };

  window.addEventListener('keydown', globalHotkeyHandler);
  (window as any)._abGlobalHotkeyHandler = globalHotkeyHandler;
});

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (popupCloseTimeout.value) clearTimeout(popupCloseTimeout.value);
  
  if ((window as any)._abGlobalHotkeyHandler) {
    window.removeEventListener('keydown', (window as any)._abGlobalHotkeyHandler);
    (window as any)._abGlobalHotkeyHandler = null;
  }
});
</script>

<style scoped>
.popup-container {
  width: 380px;
  min-height: 500px;
  max-height: 600px;
  overflow-y: auto;
}

.search-section {
  position: relative;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.search-mode-btn {
  min-width: 32px !important;
  width: 32px;
  height: 32px;
}

.bookmark-item:hover,
.history-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.bookmark-item.selected,
.history-item.selected {
  background-color: rgba(25, 118, 210, 0.12);
}

.bookmark-title {
  font-size: 0.875rem;
  line-height: 1.2;
}

.bookmark-url {
  font-size: 0.75rem;
  opacity: 0.7;
}

.stats-section .v-card {
  transition: all 0.2s ease;
}

.stats-section .v-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
}

.action-buttons .v-btn {
  height: 48px;
}

.clear-history {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

:deep(mark) {
  background-color: #ffeb3b;
  color: #000;
  padding: 0 2px;
  border-radius: 2px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
}
</style>
