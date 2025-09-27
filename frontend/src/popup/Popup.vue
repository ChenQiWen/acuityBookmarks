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
          <Grid is="col" cols="3">
            <Button
              @click="toggleSidePanel"
              :color="sidePanelEnabled ? 'success' : 'info'"
              variant="outline"
              size="sm"
              block
              class="action-btn"
            >
              <template v-slot:prepend>
                <Icon :name="sidePanelEnabled ? 'mdi-dock-left' : 'mdi-dock-left-outline'" />
              </template>
              {{ sidePanelEnabled ? '关闭侧边栏' : '打开侧边栏' }}
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
          ⌨️ 全局快捷键: Alt+B 管理页面 | Alt+S AI整理 | Alt+F 搜索页面 | Alt+D 切换侧边栏
        </div>
      </Grid>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
// import { PERFORMANCE_CONFIG } from '../config/constants'; // 不再需要，已移除所有自动关闭popup的行为
import { performanceMonitor } from '../utils/performance-monitor';
import { popupAPI } from '../utils/unified-bookmark-api';

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

// 📊 统计信息计算属性
const stats = computed(() => safePopupStore.value.stats || { bookmarks: 0, folders: 0 });
const lastProcessedInfo = computed(() => safePopupStore.value.lastProcessedInfo || '准备就绪');


// 🔔 通知相关计算属性
const snackbar = computed(() => safeUIStore.value.snackbar || { show: false, text: '', color: 'info' });

// 本地UI状态
const popupCloseTimeout = ref<number | null>(null);
// 🎯 侧边栏状态管理
const sidePanelEnabled = ref(false); // 默认禁用，等待检查实际状态


// --- 工具函数 ---




// --- 侧边栏状态检查 ---
async function checkSidePanelInitialState(): Promise<void> {
  try {
    console.log('🔍 检查侧边栏初始状态...');
    
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (currentTab?.id) {
        try {
          const currentOptions = await chrome.sidePanel.getOptions({ tabId: currentTab.id });
          const actualEnabled = currentOptions.enabled ?? false;
          
          // 🎯 关键修复：让UI状态与实际API状态保持一致
          sidePanelEnabled.value = actualEnabled;
          
          console.log('✅ 侧边栏初始状态同步完成:', { 
            enabled: actualEnabled, 
            buttonText: actualEnabled ? '关闭侧边栏' : '打开侧边栏' 
          });
          
        } catch (optionError) {
          console.warn('⚠️ 获取侧边栏选项失败，使用默认状态:', optionError);
          sidePanelEnabled.value = false;
        }
      } else {
        console.warn('⚠️ 无法获取当前标签页，使用默认状态');
        sidePanelEnabled.value = false;
      }
    } else {
      console.warn('⚠️ chrome.sidePanel API不可用，使用默认状态');
      sidePanelEnabled.value = false;
    }
  } catch (error) {
    console.error('❌ 检查侧边栏初始状态失败:', error);
    // 确保默认为禁用状态
    sidePanelEnabled.value = false;
  }
}

// --- 操作函数 ---
async function toggleSidePanel(): Promise<void> {
  try {
    console.log('🚀 切换侧边栏状态...', { 
      currentUIState: sidePanelEnabled.value, 
      buttonText: sidePanelEnabled.value ? '关闭侧边栏' : '打开侧边栏'
    });
    
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (currentTab?.windowId) {
        
        // 🎯 关键修复：基于UI状态执行操作，确保按钮文本和操作一致
        if (sidePanelEnabled.value) {
          // 🎯 当前启用 → 禁用侧边栏
          await chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            enabled: false
          });
          
          // 更新本地状态
          sidePanelEnabled.value = false;
          
          console.log('✅ 侧边栏已禁用');
          
          if (uiStore.value) {
            uiStore.value.showInfo('📋 侧边栏已关闭');
          }
          
        } else {
          // 🎯 当前禁用 → 启用并打开侧边栏
          await chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            path: 'side-panel.html',
            enabled: true
          });
          
          // 设置点击行为
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
          
          // 直接打开侧边栏
          await chrome.sidePanel.open({ windowId: currentTab.windowId });
          
          // 更新本地状态
          sidePanelEnabled.value = true;
          
          console.log('✅ 侧边栏已启用并打开');
          
          if (uiStore.value) {
            uiStore.value.showSuccess('🎉 侧边栏已打开！');
          }
        }
        
        return;
      } else {
        throw new Error('无法获取当前窗口信息');
      }
    } else {
      throw new Error('chrome.sidePanel API 不可用');
    }
  } catch (error) {
    console.error('切换侧边栏失败:', error);
    
    // 如果API操作失败，根据当前状态提供备用方案
    if (!sidePanelEnabled.value) {
      // 如果是要打开侧边栏但失败了，使用新标签页方案
      console.log('🔄 使用新标签页备用方案...');
      try {
        const sidePanelUrl = chrome.runtime.getURL('side-panel.html');
        await chrome.tabs.create({
          url: sidePanelUrl,
          active: true
        });
        
        // 更新状态（虽然不是真正的侧边栏，但逻辑上已经"打开"了）
        sidePanelEnabled.value = true;
        
        if (uiStore.value) {
          uiStore.value.showInfo('💡 已在新标签页中打开书签管理页面');
        }
      } catch (fallbackError) {
        console.error('备用方案也失败:', fallbackError);
        if (uiStore.value) {
          uiStore.value.showError(`操作失败: ${(error as Error).message}`);
        }
      }
    } else {
      // 如果是要关闭侧边栏但失败了，显示错误信息
      if (uiStore.value) {
        uiStore.value.showError(`关闭侧边栏失败: ${(error as Error).message}`);
      }
    }
  }
}

function openAiOrganizePage(): void {
  chrome.runtime.sendMessage({ type: 'SHOW_MANAGEMENT_PAGE_AND_ORGANIZE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ 发送消息失败:', chrome.runtime.lastError.message);
      // 降级方案：直接打开管理页面
      chrome.tabs.create({ url: chrome.runtime.getURL('management.html') });
    } else if (!response?.success) {
      console.error('❌ 打开AI整理页面失败:', response?.error);
      // 降级方案：直接打开管理页面
      chrome.tabs.create({ url: chrome.runtime.getURL('management.html') });
    }
    // 🎯 保持popup开启，让用户可以查看AI整理进度或继续其他操作
    // setTimeout(() => window.close(), PERFORMANCE_CONFIG.AI_PAGE_CLOSE_DELAY);
  });
}

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ type: 'OPEN_MANAGEMENT_PAGE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ 发送消息失败:', chrome.runtime.lastError.message);
      // 降级方案：直接打开管理页面
      chrome.tabs.create({ url: chrome.runtime.getURL('management.html') });
    } else if (!response?.success) {
      console.error('❌ 打开管理页面失败:', response?.error);
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


// --- 监听器 ---

// 加载书签统计数据
const loadBookmarkStats = async () => {
  try {
    console.log('🚀 开始加载书签统计数据...');
    const globalStats = await popupAPI.getQuickStats();
    
    if (globalStats && popupStore.value) {
      // 更新store中的统计数据
      popupStore.value.stats.bookmarks = globalStats.totalBookmarks || 0;
      popupStore.value.stats.folders = globalStats.totalFolders || 0;
      
      console.log('✅ 书签统计数据加载完成:', globalStats);
    }
  } catch (error) {
    console.error('❌ 加载书签统计数据失败:', error);
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
    console.log('开始动态导入stores...');
    
    // 🎯 检查侧边栏初始状态
    await checkSidePanelInitialState();
    
    // 🎯 点击图标永远显示popup，不需要状态查询
    console.log('📋 Popup启动，点击图标永远显示popup页面');
    
    // 动态导入stores - 使用IndexedDB版本
    const { useUIStore } = await import('../stores/ui-store');
    const { usePopupStoreIndexedDB } = await import('../stores/popup-store-indexeddb');
    
    uiStore.value = useUIStore();
    popupStore.value = usePopupStoreIndexedDB();
    
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
      
      // 加载书签统计数据
      await loadBookmarkStats();
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
  chrome.runtime.onMessage.addListener(() => {
    // 🎯 移除了侧边栏自动切换监听，现在使用统一的background逻辑
  });

  // 全局快捷键
  const globalHotkeyHandler = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
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


:deep(mark) {
  background-color: var(--color-warning-alpha-20);
  color: var(--color-warning);
  padding: 0 2px;
  border-radius: var(--radius-sm);
}
</style>
