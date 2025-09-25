<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { performanceMonitor } from '../utils/performance-monitor';
import { useUIStore, useSearchPopupStore } from '../stores';

// AcuityUI Components
import {
  Spinner,
  Input,
  Button,
  Icon
} from '../components/ui';

// 🏪 Pinia Store 实例（使用ref确保响应式）
const uiStore = ref<any>(null);
const searchPopupStore = ref<any>(null);

// 🛡️ 安全访问计算属性 - 统一所有store访问
const isStoresReady = computed(() => !!uiStore.value && !!searchPopupStore.value);
const safeSearchPopupStore = computed(() => searchPopupStore.value || {});

// 🔍 搜索相关计算属性
const searchQuery = computed({
  get: () => safeSearchPopupStore.value.searchQuery || '',
  set: (value: string) => {
    if (searchPopupStore.value) {
      searchPopupStore.value.searchQuery = value;
    }
  }
});

const searchResults = computed(() => safeSearchPopupStore.value.searchResults || []);
const isSearching = computed(() => safeSearchPopupStore.value.isSearching || false);
const searchMode = computed(() => safeSearchPopupStore.value.searchMode || 'fast');

// 搜索模式选项
const searchModeOptions = computed(() => safeSearchPopupStore.value.searchModeOptions || []);

// 搜索历史和UI状态
const showModeSelector = computed(() => safeSearchPopupStore.value.showModeSelector || false);
const showSearchDropdown = computed(() => safeSearchPopupStore.value.showSearchDropdown || false);
const selectedIndex = computed(() => safeSearchPopupStore.value.selectedIndex || -1);
const maxDropdownItems = computed(() => safeSearchPopupStore.value.maxDropdownItems || 8);
const searchHistory = computed(() => safeSearchPopupStore.value.searchHistory || []);
const showSearchHistory = computed(() => safeSearchPopupStore.value.showSearchHistory || false);

// 输入框引用
const searchInput = ref<any>(null);

// 🛡️ 其他安全计算属性（为模板访问保留必要的计算属性）

// 📱 本地UI状态（不依赖store的本地状态）
const isWindowFocused = ref(true);

// 🛠️ 工具函数代理（调用store的方法）
const safeTrim = (value: any): string => {
  return searchPopupStore.value?.safeTrim?.(value) || '';
};

const getHostname = (url: string): string => {
  return searchPopupStore.value?.getHostname?.(url) || 'unknown';
};

const highlightText = (text: string, query: string): string => {
  return searchPopupStore.value?.highlightText?.(text, query) || text;
};

// 📝 事件处理函数（代理到store方法）

// 打开书签
function openBookmark(bookmark: any): void {
  if (searchPopupStore.value?.openBookmark) {
    searchPopupStore.value.openBookmark(bookmark);
  }
}

// 处理键盘导航
function handleSearchKeydown(event: KeyboardEvent): void {
  if (searchPopupStore.value?.handleKeyboardNavigation) {
    searchPopupStore.value.handleKeyboardNavigation(event);
  }
}

// 选择下拉项
function selectDropdownItem(bookmark: any): void {
  openBookmark(bookmark);
}

// 处理搜索输入焦点
function handleSearchFocus(): void {
  if (searchPopupStore.value?.handleSearchFocus) {
    searchPopupStore.value.handleSearchFocus();
  }
}

// 处理搜索输入失焦
function handleSearchBlur(): void {
  if (searchPopupStore.value?.handleSearchBlur) {
    searchPopupStore.value.handleSearchBlur();
  }
}

// 🖥️ 窗口事件处理函数

function handleWindowFocus(): void {
  isWindowFocused.value = true;
}

function handleWindowBlur(): void {
  isWindowFocused.value = false;
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
    if (searchPopupStore.value) {
      searchPopupStore.value.showModeSelector = false;
    }
  }

  // Close popup when clicking outside the search container
  const searchContainer = document.querySelector('.search-popup-container');
  if (searchContainer && !searchContainer.contains(target)) {
    window.close();
  }
}

// 处理搜索输入变化
function handleSearchInput(): void {
  if (searchPopupStore.value?.handleSearchInput) {
    searchPopupStore.value.handleSearchInput();
  }
}

// 🕐 防抖搜索
let searchTimeout: number | null = null;
function debounceSearch(func: () => void, delay: number = 300): void {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = window.setTimeout(func, delay);
}

// 🔄 搜索查询监听（使用新的统一API）
watch(searchQuery, (newQuery) => {
  // 防抖触发搜索
  debounceSearch(async () => {
    if (newQuery.trim()) {
      await searchPopupStore.value.performSearch();
    } else {
      // 清空搜索结果
      if (searchPopupStore.value) {
        searchPopupStore.value.searchResults = [];
      }
    }
  }, 300);
});

// 📝 聚焦搜索输入框
function focusSearchInput(): void {
  // 聚焦搜索输入框
  const searchInputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
  if (searchInputElement) {
    searchInputElement.focus();
    searchInputElement.select();
  }
}

// 🔄 处理搜索模式变化（代理到store方法）
function handleModeChange(newMode: string): void {
  if (searchPopupStore.value?.handleModeChange) {
    searchPopupStore.value.handleModeChange(newMode);
  }
}

// 搜索逻辑已迁移到SearchPopupStore中的performSearch方法

// 🔄 生命周期钩子

onMounted(async () => {
  try {
    // 初始化Pinia stores
    uiStore.value = useUIStore();
    searchPopupStore.value = useSearchPopupStore();
    
    // 初始化SearchPopup数据
    uiStore.value.setCurrentPage('searchPopup', 'AcuityBookmarksSearchPopup');
    const startupTimer = performanceMonitor.measureStartupTime();
    await searchPopupStore.value.initialize();
    const startupTime = startupTimer.end();
    console.log(`搜索弹窗加载完成 (${startupTime.toFixed(0)}ms)`);
    
    // 添加窗口事件监听器
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('click', handleWindowClick);
    
    // 聚焦搜索输入框
    await nextTick();
    setTimeout(() => {
      focusSearchInput();
      if (searchPopupStore.value) {
        searchPopupStore.value.isInputFocused = true;
      }
    }, 100);
    
  } catch (error) {
    console.error('SearchPopup初始化失败:', error);
    if (uiStore.value) {
      uiStore.value.showError(`初始化失败: ${(error as Error).message}`);
    }
  }
});

// 🧹 清理函数
onUnmounted(() => {
  // 清理防抖定时器
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
    searchTimeout = null;
  }
  
  // 移除窗口事件监听器
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('click', handleWindowClick);
});
</script>

<template>
  <div class="search-popup-container" @click="handleWindowClick">
    <div class="search-popup-content" @click.stop>
      <!-- Loading状态 -->
      <div v-if="!isStoresReady" class="loading-container">
        <Spinner color="primary" size="md" />
        <p class="loading-text">正在初始化...</p>
      </div>
      
      <!-- 主要内容 -->
      <div v-else class="search-section">
        <!-- 搜索输入框和模式选择器 -->
        <div class="search-container">
          <div class="search-input-wrapper">
            <Input
              ref="searchInput"
              v-model="searchQuery"
              placeholder="搜索书签..."
              variant="outlined"
              :loading="isSearching"
              class="search-input"
              @input="handleSearchInput"
              @keydown="handleSearchKeydown"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
            >
              <template #prepend>
                <Icon name="mdi-magnify" :size="20" />
              </template>
            </Input>

            <!-- 搜索模式选择器 -->
            <div class="mode-selector">
              <Button
                variant="ghost"
                size="sm"
                class="mode-toggle-btn" :class="[{ 'active': showModeSelector }]"
                @click.stop="searchPopupStore?.toggleModeSelector?.()"
              >
                <span class="mode-label">{{ searchModeOptions.find((opt: any) => opt.value === searchMode)?.label }}</span>
                <Icon name="mdi-chevron-down" :size="16" :class="{ 'rotated': showModeSelector }" />
              </Button>

              <!-- 模式选择下拉菜单 -->
              <div
                v-if="showModeSelector"
                class="mode-dropdown"
                @click.stop
              >
                <div
                  v-for="option in searchModeOptions"
                  :key="option.value"
                  class="mode-option" :class="[{ 'selected': option.value === searchMode }]"
                  @click="handleModeChange(option.value)"
                >
                  <div class="mode-option-header">
                    <span class="mode-option-label">{{ option.label }}</span>
                    <Icon
                      v-if="option.value === searchMode"
                      name="mdi-check"
                      :size="16"
                      color="primary"
                    />
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
                  class="result-item" :class="[{ 'selected': selectedIndex === index }]"
                  @click="selectDropdownItem(bookmark)"
                >
                  <div class="result-icon">
                    <img
                      :src="`https://www.google.com/s2/favicons?domain=${getHostname(bookmark.url)}&sz=16`"
                      width="16"
                      height="16"
                      alt=""
                      @error="(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }"
                    />
                    <Icon name="mdi-bookmark-outline" :size="16" class="hidden fallback-icon" />
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
                  <Icon name="mdi-magnify" :size="20" color="secondary" />
                  <span>未找到匹配的书签</span>
                </div>
              </div>

              <!-- 搜索历史 -->
              <div v-if="showSearchHistory && !showSearchDropdown">
                <div
                  v-for="(query, index) in searchHistory.slice(0, maxDropdownItems)"
                  :key="index"
                  class="history-item" :class="[{ 'selected': selectedIndex === index }]"
                  @click="searchQuery = query; handleSearchInput()"
                >
                  <Icon name="mdi-history" :size="16" />
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

/* Loading状态样式 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  gap: var(--spacing-md);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
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

/* AcuityUI特定样式 */
.hidden {
  display: none !important;
}

.fallback-icon {
  color: var(--color-text-secondary);
}

.result-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.result-icon img {
  border-radius: 2px;
}

.mode-toggle-btn .rotated {
  transform: rotate(180deg);
  transition: transform var(--transition-base);
}

.mode-toggle-btn {
  transition: all var(--transition-base);
}

.search-input {
  flex: 1;
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
