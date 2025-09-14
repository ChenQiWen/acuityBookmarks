<template>
  <div class="popup-container">
    <!-- 加载状态 -->
    <div v-if="!isStoresReady" class="loading-container">
      <Spinner color="primary" size="lg" />
      <p class="loading-text">正在初始化...</p>
    </div>

    <!-- 主内容 - 只有当stores都存在时才显示 -->
    <div v-else>
      <!-- Toast通知 -->
      <Toast
        v-model:show="snackbar.show"
        :text="snackbar.text"
        :color="snackbar.color"
        :timeout="3000"
        location="top"
      />

      <!-- 主内容 -->
      <Grid is="container" fluid class="main-container">
        <!-- 搜索区域 -->
        <div class="search-section">
          <div class="search-input-wrapper">
            <Input
              ref="searchInput"
              v-model="searchQuery"
              :placeholder="getSearchPlaceholder()"
              type="text"
              variant="outlined"
              density="comfortable"
              :loading="isSearching"
              :disabled="isSearchDisabled"
              clearable
              @input="handleSearchInput"
              @keydown="handleSearchKeydown"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
            >
              <template #prepend>
                <Icon name="mdi-magnify" :size="20" />
              </template>
              
              <template #append>
                <!-- 搜索模式下拉菜单 -->
                <Dropdown
                  v-model="showSearchModeMenu"
                  placement="bottom-end"
                  closeOnContentClick
                >
                  <template #trigger="{ toggle }">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      :disabled="isSearchDisabled"
                      @click="toggle"
                      class="search-mode-btn"
                    >
                      <Icon :name="searchMode === 'fast' ? 'mdi-lightning-bolt' : 'mdi-brain'" :size="16" />
                      <Icon name="mdi-chevron-down" :size="12" />
                    </Button>
                  </template>

                  <List is="list" density="compact">
                    <List
                      is="item"
                      @click="selectSearchMode('fast')"
                      :active="searchMode === 'fast'"
                    >
                      <template #prepend>
                        <Icon name="mdi-lightning-bolt" :size="16" color="primary" />
                      </template>
                      <template #title>快速搜索</template>
                      <template #subtitle>基于书签标题和URL快速匹配</template>
                    </List>

                    <List
                      is="item"
                      @click="selectSearchMode('smart')"
                      :active="searchMode === 'smart'"
                    >
                      <template #prepend>
                        <Icon name="mdi-brain" :size="16" color="secondary" />
                      </template>
                      <template #title>AI搜索</template>
                      <template #subtitle>基于网页内容智能匹配</template>
                    </List>
                  </List>
                </Dropdown>
              </template>
            </Input>
          </div>

          <!-- 搜索结果下拉框 -->
          <div v-if="showSearchDropdown" class="search-dropdown">
            <Card elevation="high" rounded>
              <List is="list" density="compact">
                <!-- AI搜索进度 -->
                <List
                  v-if="isAIProcessing && searchProgress.stage"
                  is="item"
                  :clickable="false"
                >
                  <template #prepend>
                    <Icon name="mdi-brain" color="secondary" />
                  </template>
                  <template #title>
                    <span class="progress-text">{{ searchProgress.message }}</span>
                  </template>
                  <template #subtitle>
                    <ProgressBar
                      v-if="searchProgress.total > 0"
                      :modelValue="((searchProgress.current || 0) / (searchProgress.total || 1)) * 100"
                      color="secondary"
                      :height="4"
                    />
                  </template>
                </List>

                <!-- 搜索统计 -->
                <List
                  v-if="searchResults.length > 0"
                  is="item"
                  :clickable="false"
                  disabled
                >
                  <template #title>
                    <span class="stats-text">找到 {{ searchResults.length }} 个结果</span>
                  </template>
                </List>

                <Divider v-if="searchResults.length > 0" />

                <!-- 搜索结果 -->
                <List
                  v-for="(bookmark, index) in searchResults.slice(0, 5)"
                  :key="bookmark?.id || index"
                  is="item"
                  :class="{ 'selected': selectedIndex === index }"
                  @click="selectDropdownItem(bookmark)"
                  class="bookmark-item"
                >
                  <template #prepend>
                    <Avatar
                      v-if="bookmark.favicon"
                      :src="bookmark.favicon"
                      :size="20"
                      @error="handleFaviconError"
                    />
                    <Avatar
                      v-else
                      icon="mdi-bookmark"
                      :size="20"
                    />
                  </template>

                  <template #title>
                    <span class="bookmark-title" v-html="highlightText(bookmark.title, searchQuery)"></span>
                  </template>

                  <template #subtitle>
                    <span class="bookmark-url" v-html="highlightText(getDomainFromUrl(bookmark.url), searchQuery)"></span>
                  </template>

                  <!-- AI分数显示 -->
                  <template #append v-if="bookmark._aiScore">
                    <Badge
                      size="sm"
                      :color="getAIScoreColor(bookmark._aiScore)"
                    >
                      AI: {{ bookmark._aiScore.toFixed(1) }}
                    </Badge>
                  </template>
                </List>

                <!-- 更多结果提示 -->
                <List
                  v-if="searchResults.length > 5"
                  is="item"
                  :clickable="false"
                  disabled
                >
                  <template #title>
                    <span class="more-results-text">还有 {{ searchResults.length - 5 }} 个结果...</span>
                  </template>
                </List>

                <!-- AI错误信息 -->
                <List
                  v-if="aiSearchError"
                  is="item"
                  :clickable="false"
                >
                  <template #prepend>
                    <Icon name="mdi-alert" color="error" />
                  </template>
                  <template #title>
                    <span class="error-text">{{ aiSearchError }}</span>
                  </template>
                </List>

                <!-- 无结果提示 -->
                <List
                  v-if="searchResults.length === 0 && safeTrim(searchQuery) && !aiSearchError"
                  is="item"
                  :clickable="false"
                  disabled
                >
                  <template #prepend>
                    <Icon name="mdi-magnify" color="muted" />
                  </template>
                  <template #title>没有找到相关书签</template>
                </List>
              </List>
            </Card>
          </div>

          <!-- 搜索历史下拉框 -->
          <div v-if="showSearchHistory && !showSearchDropdown" class="search-dropdown">
            <Card elevation="high" rounded>
              <List is="list" density="compact">
                <List
                  v-for="(query, index) in searchHistory.slice(0, 5)"
                  :key="index"
                  is="item"
                  :class="{ 'selected': selectedIndex === index }"
                  @click="selectHistoryItem(query)"
                  class="history-item"
                >
                  <template #prepend>
                    <Icon name="mdi-history" :size="16" />
                  </template>
                  <template #title>{{ query }}</template>
                </List>

                <Divider v-if="searchHistory.length > 0" />
                <List
                  is="item"
                  @click="clearSearchHistory"
                  class="clear-history"
                >
                  <template #prepend>
                    <Icon name="mdi-delete" :size="16" color="error" />
                  </template>
                  <template #title>
                    <span class="error-text">清除搜索历史</span>
                  </template>
                </List>
              </List>
            </Card>
          </div>
        </div>

        <!-- 统计信息 -->
        <Grid is="row" class="stats-section" gutter="md">
          <Grid is="col" cols="6">
            <Card class="stats-card" elevation="medium" rounded>
              <div class="stats-number primary-text">{{ stats.bookmarks }}</div>
              <div class="stats-label">书签</div>
            </Card>
          </Grid>
          <Grid is="col" cols="6">
            <Card class="stats-card" elevation="medium" rounded>
              <div class="stats-number secondary-text">{{ stats.folders }}</div>
              <div class="stats-label">文件夹</div>
            </Card>
          </Grid>
        </Grid>

        <!-- 处理信息 -->
        <div class="process-info">
          {{ lastProcessedInfo }}
        </div>

        <!-- 操作按钮 -->
        <Grid is="row" class="action-buttons" gutter="md">
          <Grid is="col" cols="2">
            <Button
              @click="openSidePanel"
              color="info"
              variant="outline"
              size="sm"
              block
              class="action-btn"
            >
              <template v-slot:prepend>
<Icon name="mdi-tab-plus"  />
</template>
              新标签页
            </Button>
          </Grid>
          <Grid is="col" cols="2">
            <Button
              @click="openRealSidePanel"
              color="info"
              variant="outline"
              size="sm"
              block
              class="action-btn"
            >
              <template v-slot:prepend>
<Icon name="mdi-dock-left"  />
</template>
              打开侧边栏
            </Button>
          </Grid>
          <Grid is="col" cols="4">
            <Button
              @click="openAiOrganizePage"
              color="primary"
              variant="primary"
              size="lg"
              block
              class="action-btn"
            >
              <template v-slot:prepend>
<Icon name="mdi-brain"  />
</template>
              AI整理
            </Button>
          </Grid>
          <Grid is="col" cols="4">
            <Button
              @click="openManualOrganizePage"
              color="secondary"
              variant="secondary"
              size="lg"
              block
              class="action-btn"
            >
              <template v-slot:prepend>
<Icon name="mdi-folder-edit"  />
</template>
              手动整理
            </Button>
          </Grid>
        </Grid>

        <Grid is="row" gutter="md">
          <Grid is="col" cols="12">
            <Button
              @click="clearCacheAndRestructure"
              color="warning"
              variant="outline"
              size="lg"
              block
              :loading="isClearingCache"
            >
              <template v-slot:prepend>
<Icon name="mdi-cached"  />
</template>
              <span v-if="!isClearingCache">清除缓存</span>
              <span v-else>清除中...</span>
            </Button>
          </Grid>
        </Grid>

        <!-- 快捷键提示 -->
        <div class="hotkeys-hint">
          ⌨️ 全局快捷键: Alt+B 管理页面 | Alt+S AI整理 | Alt+F 搜索页面 | Alt+D 打开侧边栏
        </div>
      </Grid>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
// import { PERFORMANCE_CONFIG } from '../config/constants'; // 不再需要，已移除所有自动关闭popup的行为
import { performanceMonitor } from '../utils/performance-monitor';

// 导入新的UI组件
import { 
  Button, 
  Icon, 
  Card, 
  Input, 
  Grid, 
  List, 
  Spinner, 
  Toast, 
  Avatar, 
  Badge, 
  ProgressBar, 
  Divider,
  Dropdown
} from '../components/ui';

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

// 本地UI状态
const showSearchModeMenu = ref(false);
const showSearchDropdown = ref(false);
const selectedIndex = ref(-1);
const searchInput = ref<any>(null);
const showSearchHistory = ref(false);
const isInputFocused = ref(false);
const isUserActive = ref(false);
const popupCloseTimeout = ref<number | null>(null);
// 移除了侧边栏状态跟踪，因为点击图标永远显示popup

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

function getAIScoreColor(score: number): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' {
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
    // 🎯 点击书签跳转时关闭popup是合理的，用户期望这样的行为
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
async function openSidePanel(): Promise<void> {
  try {
    // 🔧 新标签页方案：避免状态冲突
    console.log('🚀 使用新标签页方式打开管理页面...');
    
    // 获取扩展的side-panel.html路径
    const sidePanelUrl = chrome.runtime.getURL('side-panel.html');
    
    // 在新标签页中打开侧边栏页面
    await chrome.tabs.create({
      url: sidePanelUrl,
      active: true
    });
    
    console.log('✅ 已在新标签页中打开管理页面');
    
    // 🎯 保持popup开启，让用户可以继续使用其他功能
    // setTimeout(() => window.close(), 100);
  } catch (error) {
    console.error('打开管理页面失败:', error);
    if (uiStore.value) {
      uiStore.value.showError(`打开管理页面失败: ${(error as Error).message}`);
    }
  }
}

async function openRealSidePanel(): Promise<void> {
  try {
    console.log('🚀 直接打开侧边栏...');
    
    // 🎯 解决方案：直接在popup中调用chrome.sidePanel API，保持用户手势上下文
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      // 获取当前窗口
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (currentTab?.windowId) {
        // 🎯 动态配置侧边栏行为：确保action点击永远只控制popup
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        
        // 确保侧边栏已启用并指向正确的页面
        await chrome.sidePanel.setOptions({
          path: 'side-panel.html',
          enabled: true
        });
        
        // 直接打开侧边栏 - 这里保持了用户手势的上下文
        await chrome.sidePanel.open({ windowId: currentTab.windowId });
        
        console.log('✅ 侧边栏打开成功');
        
        if (uiStore.value) {
          uiStore.value.showSuccess('🎉 侧边栏已打开！');
        }
        
        // 🎯 保持popup开启，实现popup和侧边栏共存
        // setTimeout(() => window.close(), 100);
        return;
      } else {
        throw new Error('无法获取当前窗口信息');
      }
    } else {
      throw new Error('chrome.sidePanel API 不可用');
    }
  } catch (error) {
    console.error('直接打开侧边栏失败:', error);
    
    // 提供回退方案：新标签页
    console.log('🔄 使用新标签页回退方案...');
    try {
      const sidePanelUrl = chrome.runtime.getURL('side-panel.html');
      await chrome.tabs.create({
        url: sidePanelUrl,
        active: true
      });
      
      if (uiStore.value) {
        uiStore.value.showInfo('💡 Chrome侧边栏API不可用，已在新标签页中打开管理页面');
      }
      
      // 🎯 保持popup开启，让用户可以在popup和侧边栏间切换
      // setTimeout(() => window.close(), 100);
    } catch (fallbackError) {
      console.error('回退方案也失败:', fallbackError);
      if (uiStore.value) {
        uiStore.value.showError(`打开侧边栏失败: ${(error as Error).message}`);
      }
    }
  }
}

function openAiOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPageAndOrganize' }, () => {
    // 🎯 保持popup开启，让用户可以查看AI整理进度或继续其他操作
    // setTimeout(() => window.close(), PERFORMANCE_CONFIG.AI_PAGE_CLOSE_DELAY);
  });
}

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ action: 'showManagementPage', mode: 'manual' }, () => {
    // 🎯 保持popup开启，方便用户在管理页面和popup间切换
    // setTimeout(() => window.close(), PERFORMANCE_CONFIG.PAGE_CLOSE_DELAY);
  });
}

async function clearCacheAndRestructure(): Promise<void> {
  if (!popupStore.value || !uiStore.value) return;
  
  try {
    await popupStore.value.clearCache();
    uiStore.value.showSuccess('缓存已成功清除！');
    // 🎯 清除缓存后保持popup开启，让用户看到成功消息并继续使用
    // setTimeout(() => window.close(), 2000);
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
    
    // 🎯 点击图标永远显示popup，不需要状态查询
    console.log('📋 Popup启动，点击图标永远显示popup页面');
    
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

<style>
/* 全局样式 - 重置和设置popup容器 */
html, body {
  margin: 0;
  padding: 0;
  width: 420px;
  min-width: 420px;
  max-width: 420px;
  overflow: hidden;
}

#app {
  width: 420px;
  min-width: 420px;
  max-width: 420px;
  margin: 0;
  padding: 0;
}
</style>

<style scoped>
.popup-container {
  width: 420px;
  min-height: 520px;
  max-height: 650px;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  gap: var(--spacing-md);
}

.loading-text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.main-container {
  padding: var(--spacing-lg);
}

.search-section {
  position: relative;
  margin-bottom: var(--spacing-lg);
}

.search-input-wrapper {
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
  margin-top: var(--spacing-sm);
}

.search-mode-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.bookmark-item.selected,
.history-item.selected {
  background: var(--color-primary-alpha-10) !important;
}

.bookmark-title {
  font-size: var(--text-sm);
  line-height: 1.2;
}

.bookmark-url {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.progress-text,
.stats-text,
.more-results-text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.error-text {
  color: var(--color-error);
}

.stats-section {
  margin-bottom: var(--spacing-lg);
}

.stats-card {
  text-align: center;
  padding: var(--spacing-lg);
  transition: all var(--transition-base);
}

.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.stats-number {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  line-height: 1.2;
}

.stats-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.primary-text {
  color: var(--color-primary);
}

.secondary-text {
  color: var(--color-secondary);
}

.process-info {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-lg);
}

.action-buttons {
  margin-bottom: var(--spacing-md);
}

.action-btn {
  height: 52px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.5px;
}

.hotkeys-hint {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-lg);
}

.clear-history {
  border-top: 1px solid var(--color-border);
}

:deep(mark) {
  background-color: var(--color-warning-alpha-20);
  color: var(--color-warning);
  padding: 0 2px;
  border-radius: var(--radius-sm);
}
</style>
