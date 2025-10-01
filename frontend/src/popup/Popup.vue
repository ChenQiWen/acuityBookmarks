<template>
  <div class="popup-container">
    <div class="top-bar">
      <div class="top-left">
        <div
          class="icon-toggle"
          role="button"
          :aria-label="toggleTooltipText"
          @click="toggleSidePanel"
          :title="toggleTooltipText"
        >
          <Icon :name="sidePanelIcon" :size="20" />
        </div>
      </div>

      <div class="top-center">
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="promo-logo" />
        <div class="promo-title">AcuityBookmarks</div>
      </div>

      <div class="top-right">
        <ChromeAIGuide />
      </div>
    </div>
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
        :timeout="2000"
        location="top"
      />

      <!-- 主内容 -->
      <Grid is="container" fluid class="main-container">

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

        <!-- 处理信息：根据需求，移除该文本显示 -->

        <!-- 操作按钮：仅保留管理入口，进入管理页面 -->
        <Grid is="row" class="action-buttons" gutter="md">
          <Grid is="col" cols="12">
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
              管理
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

        

        <!-- 快捷键提示（与manifest保持一致） -->
        <div class="hotkeys-hint">
<div class="shortcut-bar" v-if="shortcutItems.length > 0">
  <span class="label">⌨️ 全局快捷键：</span>
  <ul class="shortcut-list">
    <li v-for="item in shortcutItems" :key="item" class="shortcut-item">
      {{ item }}
    </li>
  </ul>
  <button class="shortcut-settings-btn" title="设置快捷键" aria-label="设置快捷键" @click="openShortcutSettings">⚙️</button>
  <span class="local-tip">Alt+T 切换侧边栏（在弹出页内）</span>
  
</div>
        </div>

        <!-- 设置快捷键入口（底部明显按钮） -->
        <Grid is="row" class="shortcut-settings" gutter="md">
          <Grid is="col" cols="12">
            <Button
              @click="openShortcutSettings"
              color="primary"
              size="lg"
              block
              class="shortcut-btn"
            >
              <template v-slot:prepend>
<Icon name="mdi-keyboard"  />
</template>
              设置快捷键
            </Button>
          </Grid>
        </Grid>
      </Grid>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCommandsShortcuts } from '../composables/useCommandsShortcuts'

const { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh } = useCommandsShortcuts()

// 将当前命令配置映射为展示文案，仅显示已配置的快捷键
const shortcutItems = computed(() => {
  const labelMap: Record<string, string> = {
    'open-popup': '打开弹出页',
    'open-management': '管理页面',
    'search-bookmarks': '搜索书签',
    'open-side-panel': '打开侧边栏'
  }
  const items: string[] = []
  Object.keys(labelMap).forEach((cmd) => {
    const s = shortcuts.value[cmd]
    if (s && s.trim()) {
      items.push(`${s} ${labelMap[cmd]}`)
    }
  })
  return items
})

onMounted(() => {
  loadShortcuts()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
// import { PERFORMANCE_CONFIG } from '../config/constants'; // 不再需要，已移除所有自动关闭popup的行为
import { popupAPI } from '../utils/unified-bookmark-api';
import ChromeAIGuide from '../components/ChromeAIGuide.vue';
import { logger } from '../utils/logger';

// 导入新的UI组件
import { 
  Button,
  Icon,
  Card,
  Grid,
  Spinner,
  Toast
} from '../components/ui';

// Store实例 - 使用响应式引用以确保模板能正确更新
const uiStore = ref<any>(null);
const popupStore = ref<any>(null);

// 🛡️ 安全访问计算属性 - 统一所有store访问
const isStoresReady = computed(() => !!uiStore.value && !!popupStore.value);

const safeUIStore = computed(() => uiStore.value || {});
const safePopupStore = computed(() => popupStore.value || {});

const isClearingCache = computed(() => safePopupStore.value.isClearingCache || false);
// 侧边栏本地状态（由于Chrome无直接查询接口，这里记录最近一次操作状态）
const isSidePanelOpen = ref<boolean | null>(null);
// 根据状态切换不同的图标
const sidePanelIcon = computed(() => {
  return isSidePanelOpen.value ? 'mdi-dock-right' : 'mdi-dock-left';
});
// 悬浮提示文案
const toggleTooltipText = computed(() => (isSidePanelOpen.value ? '收起侧边栏' : '展开侧边栏'));

// 📊 统计信息计算属性
const stats = computed(() => safePopupStore.value.stats || { bookmarks: 0, folders: 0 });


// 🔔 通知相关计算属性
const snackbar = computed(() => safeUIStore.value.snackbar || { show: false, text: '', color: 'info' });

// 本地UI状态
const popupCloseTimeout = ref<number | null>(null);
// --- 工具函数 ---

// --- 操作函数 ---
async function toggleSidePanel(): Promise<void> {
  try {
    
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (currentTab?.windowId) {
        // 根据本地状态执行打开或关闭，不显示提示
        const wantOpen = isSidePanelOpen.value !== true;
        if (wantOpen) {
          // 打开侧边栏
          await chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            path: 'side-panel.html',
            enabled: true
          });
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
          await chrome.sidePanel.open({ windowId: currentTab.windowId });
          isSidePanelOpen.value = true;
          // 广播状态同步
          try { chrome.runtime.sendMessage({ type: 'SIDE_PANEL_STATE_CHANGED', isOpen: true }); } catch {}
          logger.info('Popup', '侧边栏已打开');
        } else {
          // 关闭侧边栏
          await chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            enabled: false
          });
          isSidePanelOpen.value = false;
          // 广播状态同步
          try { chrome.runtime.sendMessage({ type: 'SIDE_PANEL_STATE_CHANGED', isOpen: false }); } catch {}
          logger.info('Popup', '侧边栏已关闭');
        }
        return;
      } else {
        throw new Error('无法获取当前窗口信息');
      }
    } else {
      throw new Error('chrome.sidePanel API 不可用');
    }
  } catch (error) {
      logger.error('Popup', '❌ 切换侧边栏失败', error);
  }
}

// AI 整理入口已移除

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ type: 'OPEN_MANAGEMENT_PAGE' }, (response) => {
    if (chrome.runtime.lastError) {
    logger.error('Popup', '❌ 发送消息失败', chrome.runtime.lastError?.message);
      // 降级方案：直接打开管理页面
      chrome.tabs.create({ url: chrome.runtime.getURL('management.html') });
    } else if (!response?.success) {
    logger.error('Popup', '❌ 打开管理页面失败', response?.error);
      // 降级方案：直接打开管理页面
      chrome.tabs.create({ url: chrome.runtime.getURL('management.html') });
    }
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

function openShortcutSettings(): void {
  try {
    // 打开Chrome的扩展快捷键配置页面（用户点击触发，允许）
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } catch (error) {
    // 如果无法直接打开，给出指引提示
    try {
      uiStore.value?.showInfo('请在浏览器地址栏输入 chrome://extensions/shortcuts 进行快捷键设置');
    } catch {}
  }
}


 

// --- 监听器 ---

// 加载书签统计数据
const loadBookmarkStats = async () => {
  try {
  logger.info('Popup', '🚀 开始加载书签统计数据...');
    const globalStats = await popupAPI.getQuickStats();
    
    if (globalStats && popupStore.value) {
      // 更新store中的统计数据
      popupStore.value.stats.bookmarks = globalStats.totalBookmarks || 0;
      popupStore.value.stats.folders = globalStats.totalFolders || 0;
      
    logger.info('Popup', '✅ 书签统计数据加载完成', globalStats);
    }
  } catch (error) {
    logger.error('Popup', '❌ 加载书签统计数据失败', error);
    // 设置默认值
    if (popupStore.value) {
      popupStore.value.stats.bookmarks = 0;
      popupStore.value.stats.folders = 0;
    }
  }
};

// --- 生命周期钩子 ---
onMounted(async () => {
  // 延迟动态导入stores避免初始化顺序问题
  try {
  logger.info('Popup', '开始动态导入stores...');
    
    // 🎯 点击图标永远显示popup，不需要状态查询
  logger.info('Popup', '📋 Popup启动，点击图标永远显示popup页面');
    
    // 动态导入stores - 使用IndexedDB版本
    const { useUIStore } = await import('../stores/ui-store');
    const { usePopupStoreIndexedDB } = await import('../stores/popup-store-indexeddb');
    
    uiStore.value = useUIStore();
    popupStore.value = usePopupStoreIndexedDB();
    
  logger.info('Popup', 'Stores初始化完成');
    
    // 设置当前页面信息
    uiStore.value.setCurrentPage('popup', 'AcuityBookmarksPopup');
    
    // 测量启动时间
    // const startupTimer = performanceMonitor.measureStartupTime();
    
    // 初始化Popup状态 - 增强错误处理
  logger.info('Popup', '开始初始化PopupStore...');
    try {
      await popupStore.value.initialize();
  logger.info('Popup', 'PopupStore初始化成功');
      
      // 加载书签统计数据
      await loadBookmarkStats();
    } catch (initError) {
  logger.warn('Popup', 'PopupStore初始化失败，使用默认状态', initError);
      // 即使初始化失败，也要确保基本状态可用
      if (uiStore.value) {
        uiStore.value.showWarning('部分功能初始化失败，但基本功能仍可使用');
      }
    }
    
    // 结束启动时间测量
    // const startupTime = startupTimer.end();
    // console.log(`弹窗加载完成 (${startupTime.toFixed(0)}ms)`);
    
  } catch (error) {
  logger.error('Popup', 'Popup整体初始化失败', error);
    // 即使出错也要确保stores可用，让界面能显示
    if (uiStore.value) {
      uiStore.value.showError(`初始化失败: ${(error as Error).message}`);
    }
  }

  // 监听消息
  chrome.runtime.onMessage.addListener(() => {
    // 🎯 移除了侧边栏自动切换监听，现在使用统一的background逻辑
  });

  // 全局快捷键
  const globalHotkeyHandler = (event: KeyboardEvent) => {
    // 避免与输入类元素冲突
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // 兼容不同浏览器键位：优先匹配 code
      if (event.code === 'KeyT') {
        event.preventDefault();
        toggleSidePanel();
        return;
      }
      switch (key) {
        case 'm':
          event.preventDefault();
          openManualOrganizePage();
          return;
        case 'a':
          event.preventDefault();
  // AI整理入口已移除
          return;
        case 'c':
          event.preventDefault();
          clearCacheAndRestructure();
          return;
        case 't':
          event.preventDefault();
          toggleSidePanel();
          return;
      }
    }
  };

  window.addEventListener('keydown', globalHotkeyHandler);
  (window as any)._abGlobalHotkeyHandler = globalHotkeyHandler;

  // 监听侧边栏状态消息，同步图标状态
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'SIDE_PANEL_STATE_CHANGED') {
      isSidePanelOpen.value = !!message.isOpen;
    }
  });
});

onUnmounted(() => {
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

.top-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 8px 12px;
}

.top-left {
  display: flex;
  align-items: center;
}

.top-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.top-right {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: var(--spacing-sm);
}

.icon-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}

.promo-logo {
  height: 20px;
  width: auto;
  display: inline-block;
  object-fit: contain;
  user-select: none;
}

.promo-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  line-height: 20px;
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
  padding: 0 var(--spacing-lg) var(--spacing-lg);
}


.stats-section {
  margin-bottom: var(--spacing-lg);
  /* 两个统计卡片之间增加间距，且固定为一行两列 */
  gap: var(--spacing-md);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stats-card {
  text-align: center;
  /* 缩小卡片内边距以更精致紧凑 */
  padding: var(--spacing-md);
  transition: all var(--transition-base);
  /* 保持内部文本在单行显示的基础设置 */
  overflow: hidden;
  /* 进一步压缩整体高度并确保内容居中 */
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.stats-number {
  /* 缩小数字字号，避免容器过大 */
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  line-height: 1.2;
  white-space: nowrap;
  word-break: keep-all;
  overflow-wrap: normal;
  margin-bottom: var(--spacing-xs);
}

.stats-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  /* 不换行，防止中文逐字断行 */
  white-space: nowrap;
  word-break: keep-all;
  overflow-wrap: normal;
}

.primary-text {
  color: var(--color-primary);
}

.secondary-text {
  color: var(--color-secondary);
}


.action-buttons {
  margin-bottom: var(--spacing-lg);
  /* 现代浏览器使用 gap 控制列间距 */
  gap: var(--spacing-md);
}

/* 兼容旧布局：在不支持 gap 的环境下使用 margin 作为降级方案 */
@supports not (gap: 1rem) {
  .action-buttons > * {
    margin-right: var(--spacing-md);
  }
  .action-buttons > *:last-child {
    margin-right: 0;
  }
}

/* 兼容旧布局：在不支持 gap 的环境下为统计卡片容器添加降级间距，并保持一行布局 */
@supports not (gap: 1rem) {
  .stats-section {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--spacing-md);
  }
}

/* 兼容旧布局：在不支持 gap 的环境下为统计卡片容器添加降级间距 */
@supports not (gap: 1rem) {
  .stats-section > * {
    margin-right: var(--spacing-md);
  }
  .stats-section > *:last-child {
    margin-right: 0;
  }
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

/* 快捷键列表排列与设置入口 */
.shortcut-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.shortcut-bar .label { color: var(--color-text-secondary); }
.shortcut-list {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}
.shortcut-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
}
.shortcut-settings-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
}
.shortcut-settings-btn:hover { opacity: 0.8; }
.local-tip { color: var(--color-text-secondary); }

.shortcut-settings { margin-top: var(--spacing-md); }
.shortcut-btn { font-weight: var(--font-medium); }


:deep(mark) {
  background-color: var(--color-warning-alpha-20);
  color: var(--color-warning);
  padding: 0 2px;
  border-radius: var(--radius-sm);
}
</style>
