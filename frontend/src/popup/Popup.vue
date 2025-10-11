<!--
  Popup 弹出页根组件
  - 提供常用操作入口：侧边栏开关、设置打开、搜索与快捷提示；
  - 通过组合式 API 管理状态，避免在模板内写复杂逻辑；
  - 遵循扩展 CSP：所有脚本为模块化引入，无内联脚本。
-->
<template>
  <div class="popup-container">
    <!-- 顶部栏：左侧侧边栏开关，中间Logo+标题，右侧设置 -->
    <div class="top-bar">
      <div class="top-left">
        <button
          class="icon-toggle"
          role="button"
          :aria-label="toggleTooltipText"
          :title="toggleTooltipText"
          data-testid="btn-toggle-sidepanel"
          @click="toggleSidePanel"
        >
          <Icon :name="sidePanelIcon" />
        </button>
      </div>
      <div class="top-center">
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="promo-logo" />
        <div class="promo-title">AcuityBookmarks</div>
      </div>
      <div class="top-right">
        <Button
          variant="text"
          icon="mdi-cog"
          size="sm"
          title="打开设置"
          data-testid="btn-open-settings"
          @click="openSettings"
        />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="!isStoresReady" class="loading-container">
      <Spinner color="primary" size="lg" />
      <p class="loading-text" data-testid="popup-loading-text">正在初始化...</p>
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
        <!-- 统计信息（严格三列两行、间距8px、Head/Content结构） -->
        <div class="stats-section">
          <!-- 第一排：书签、文件夹、重复URL -->
          <div class="stats-item">
            <Card
              class="stats-card"
              elevation="medium"
              rounded
              data-testid="card-bookmarks"
              @click="openManagementWithFilter('bookmarks')"
            >
              <div
                class="stats-head"
                :title="`共有 ${stats.bookmarks} 条书签（点击查看）`"
                aria-label="书签统计信息"
              >
                <div class="stats-head-title">
                  <span>书签</span>
                  <Icon
                    name="mdi-information-outline"
                    :size="16"
                    class="stats-head-icon"
                    title="书签数量说明"
                  />
                </div>
              </div>
              <div class="stats-content">
                <AnimatedNumber
                  class="stats-number primary-text"
                  :value="stats.bookmarks"
                />
              </div>
            </Card>
          </div>
          <div class="stats-item">
            <Card
              class="stats-card"
              elevation="medium"
              rounded
              data-testid="card-folders"
              @click="openManagementWithFilter('folders')"
            >
              <div
                class="stats-head"
                :title="`共有 ${stats.folders} 个文件夹（点击查看）`"
                aria-label="文件夹统计信息"
              >
                <div class="stats-head-title">
                  <span>文件夹</span>
                  <Icon
                    name="mdi-information-outline"
                    :size="16"
                    class="stats-head-icon"
                    title="文件夹数量说明"
                  />
                </div>
              </div>
              <div class="stats-content">
                <AnimatedNumber
                  class="stats-number secondary-text"
                  :value="stats.folders"
                />
              </div>
            </Card>
          </div>
          <div class="stats-item">
            <Card
              class="stats-card"
              elevation="low"
              rounded
              data-testid="card-duplicate"
              @click="openManagementWithFilter('duplicate')"
            >
              <div
                class="stats-head"
                :title="`检测到 ${healthOverview.duplicateCount} 个重复 URL（点击进入清理）`"
                aria-label="重复URL统计信息"
              >
                <div class="stats-head-title">
                  <span>重复URL</span>
                  <Icon
                    name="mdi-information-outline"
                    :size="16"
                    class="stats-head-icon"
                    title="重复URL说明"
                  />
                </div>
              </div>
              <div class="stats-content">
                <AnimatedNumber
                  class="stats-number accent-text"
                  :value="healthOverview.duplicateCount"
                />
              </div>
            </Card>
          </div>

          <!-- 第二排：404、500、其他4xx -->
          <div class="stats-item">
            <Card
              class="stats-card"
              elevation="low"
              rounded
              data-testid="card-http404"
              @click="openManagementWithFilter('http404')"
            >
              <div
                class="stats-head"
                :title="`检测到 ${healthOverview.http404} 个 404 链接（点击筛选）`"
                aria-label="404统计信息"
              >
                <div class="stats-head-title">
                  <span>404书签</span>
                  <Icon
                    name="mdi-information-outline"
                    :size="16"
                    class="stats-head-icon"
                    title="404说明"
                  />
                </div>
              </div>
              <div class="stats-content">
                <AnimatedNumber
                  class="stats-number danger-text"
                  :value="healthOverview.http404"
                />
              </div>
            </Card>
          </div>
          <div class="stats-item">
            <Card
              class="stats-card"
              elevation="low"
              rounded
              data-testid="card-http500"
              @click="openManagementWithFilter('http500')"
            >
              <div
                class="stats-head"
                :title="`检测到 ${healthOverview.http500} 个 500 链接（点击筛选）`"
                aria-label="500统计信息"
              >
                <div class="stats-head-title">
                  <span>500书签</span>
                  <Icon
                    name="mdi-information-outline"
                    :size="16"
                    class="stats-head-icon"
                    title="500说明"
                  />
                </div>
              </div>
              <div class="stats-content">
                <AnimatedNumber
                  class="stats-number danger-text"
                  :value="healthOverview.http500"
                />
              </div>
            </Card>
          </div>
          <div class="stats-item">
            <Card
              class="stats-card"
              elevation="low"
              rounded
              data-testid="card-other4xx"
              @click="openManagementWithFilter('other4xx')"
            >
              <div
                class="stats-head"
                :title="`检测到 ${healthOverview.other4xx} 个 4xx 链接（不含404，点击筛选）`"
                aria-label="其他4xx统计信息"
              >
                <div class="stats-head-title">
                  <span>其他4xx</span>
                  <Icon
                    name="mdi-information-outline"
                    :size="16"
                    class="stats-head-icon"
                    title="其他4xx说明"
                  />
                </div>
              </div>
              <div class="stats-content">
                <AnimatedNumber
                  class="stats-number warning-text"
                  :value="healthOverview.other4xx"
                />
              </div>
            </Card>
          </div>
        </div>

        <!-- 操作按钮：管理 与 清除缓存 同排 var(--spacing-sm) 间距 -->
        <Grid is="row" class="action-buttons-row" gutter="md">
          <Grid is="col" cols="6">
            <Button
              color="secondary"
              variant="secondary"
              size="lg"
              block
              class="action-btn"
              data-testid="btn-open-management"
              @click="openManualOrganizePage"
            >
              <template #prepend>
                <Icon name="mdi-folder-edit" />
              </template>
              管理
            </Button>
          </Grid>
          <Grid is="col" cols="6">
            <Button
              color="warning"
              variant="outline"
              size="lg"
              block
              :loading="isClearingCache"
              data-testid="btn-clear-cache"
              @click="clearCacheAndRestructure"
            >
              <template #prepend>
                <Icon name="mdi-cached" />
              </template>
              <span v-if="!isClearingCache">清除缓存</span>
              <span v-else>清除中...</span>
            </Button>
          </Grid>
        </Grid>

        <!-- 快捷键提示（与manifest保持一致） -->
        <div class="hotkeys-hint">
          <div v-if="shortcutItems.length > 0" class="shortcut-bar">
            <h1 class="label">
              ⌨️ 全局快捷键
              <button
                class="shortcut-settings-link icon-only"
                aria-label="设置快捷键"
                title="设置快捷键"
                @click="openShortcutSettings"
              >
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.94-3.62a7.99 7.99 0 0 0 .06-1.76l2.02-1.57a.5.5 0 0 0 .12-.65l-1.91-3.31a.5.5 0 0 0-.6-.22l-2.37.96a8.07 8.07 0 0 0-1.52-.88l-.36-2.53A.5.5 0 0 0 14.9 0h-3.8a.5.5 0 0 0-.5.42l-.36 2.53c-.54.2-1.05.48-1.52.8l-2.37-.96a.5.5 0 0 0-.6.22L2.94 6.85a.5.5 0 0 0 .12.65l2.02 1.57c-.07.58-.08 1.18-.02 1.76L3.06 12.4a.5.5 0 0 0-.12.65l1.91 3.31c.13.22.39.31.6.22l2.37-.96c.48.34.99.62 1.52.82l.36 2.53c.05.25.26.42.5.42h3.8c.24 0 .45-.17.49-.42l.36-2.53c.54-.2 1.05-.48 1.52-.8l2.37.96c.22.09.47 0 .6-.22l1.91-3.31a.5.5 0 0 0-.12-.65l-2.02-1.57Z"
                  />
                </svg>
              </button>
            </h1>
            <ul class="shortcut-list">
              <li
                v-for="item in shortcutItems"
                :key="item"
                class="shortcut-item"
              >
                {{ item }}
              </li>
            </ul>
          </div>
          <!-- 弹出页内快捷键（非全局）独立展示，避免混淆 -->
          <div class="local-hotkey-tip">
            <span class="local-tip">弹出页内：Alt+T 切换侧边栏</span>
          </div>
        </div>
      </Grid>
    </div>
  </div>

  <!-- 搜索区：轻量输入 + 结果列表（最多 10 条） -->
  <div v-if="isStoresReady" class="search-section">
    <Input
      v-model="searchText"
      placeholder="搜索书签…"
      size="md"
      clearable
      :aria-label="'搜索书签'"
      data-testid="input-search"
    >
      <template #prepend>
        <Icon name="mdi-magnify" />
      </template>
    </Input>

    <div
      v-if="(popupStore?.searchResults?.length || 0) > 0"
      class="search-results"
    >
      <ul class="results-list" data-testid="list-search-results">
        <li
          v-for="item in popupStore!.searchResults.slice(0, 10)"
          :key="item.id"
          class="result-item"
          :title="item.pathString || item.title"
          data-testid="result-item"
          :data-id="item.id"
          @click="handleOpenResult(item)"
        >
          <span class="result-title">{{ item.title }}</span>
          <span v-if="item.domain" class="result-domain">{{
            item.domain
          }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCommandsShortcuts } from '../composables/useCommandsShortcuts'

const { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh } =
  useCommandsShortcuts()

// 将当前命令配置映射为展示文案，仅显示已配置的快捷键
const shortcutItems = computed(() => {
  const labelMap: Record<string, string> = {
    _execute_action: '激活扩展/切换弹出页',
    'open-side-panel': '切换侧边栏',
    'open-management': '管理页面',
    'open-settings': '打开设置',
    'search-bookmarks': '搜索书签'
    // 移除无效的侧边栏全局命令展示
  }
  const items: string[] = []
  Object.keys(labelMap).forEach(cmd => {
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
  // 监听同一快捷键以实现“再次按下收起”效果
  try {
    if (chrome?.commands?.onCommand) {
      chrome.commands.onCommand.addListener(handleTogglePopupCommand)
    }
  } catch {}
})

onUnmounted(() => {
  stopAutoRefresh()
  try {
    if (chrome?.commands?.onCommand && handleTogglePopupCommand) {
      chrome.commands.onCommand.removeListener(handleTogglePopupCommand)
    }
  } catch {}
})
// import { PERFORMANCE_CONFIG } from '../config/constants'; // 不再需要，已移除所有自动关闭popup的行为
// 统一API已迁移至 Pinia Store（usePopupStoreIndexedDB），不再直接依赖 popupAPI

import { logger } from '../utils/logger'

// 导入新的UI组件
import {
  Button,
  Card,
  Grid,
  Icon,
  Spinner,
  Toast,
  Input
} from '../components/ui'
import { AB_EVENTS } from '@/constants/events'

// 轻量数字动画组件（局部注册）
const AnimatedNumber = {
  name: 'AnimatedNumber',
  props: {
    value: { type: Number, required: true },
    duration: { type: Number, default: 600 }
  },
  setup(props: { value: number; duration: number }) {
    const display = ref(0)
    let startTime = 0
    let startVal = 0
    let raf: number | null = null

    const animate = (to: number) => {
      if (raf !== null) window.cancelAnimationFrame(raf)
      startTime = performance.now()
      startVal = display.value
      const delta = to - startVal

      const tick = () => {
        const p = Math.min(1, (performance.now() - startTime) / props.duration)
        // 使用 easeOutCubic
        const eased = 1 - Math.pow(1 - p, 3)
        display.value = Math.round(startVal + delta * eased)
        if (p < 1) raf = window.requestAnimationFrame(tick)
      }
      raf = window.requestAnimationFrame(tick)
    }

    onMounted(() => animate(props.value))

    // 监听外部数值变化
    watch(
      () => props.value,
      (nv: number) => animate(nv)
    )

    return () => h('span', display.value.toString())
  }
} as Record<string, unknown>

// Store实例 - 使用响应式引用以确保模板能正确更新

import { useUIStore } from '@/stores/ui-store'
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
type UIStore = ReturnType<typeof useUIStore>
type PopupStore = ReturnType<typeof usePopupStoreIndexedDB>
const uiStore = ref<UIStore | null>(null)
const popupStore = ref<PopupStore | null>(null)

// 🛡️ 安全访问计算属性 - 统一所有store访问
const isStoresReady = computed(() => !!uiStore.value && !!popupStore.value)

const safeUIStore = computed<UIStore>(
  () =>
    uiStore.value ||
    ({
      // 最小可用默认实现，避免模板访问时出错
      showSuccess: () => undefined,
      showError: () => undefined,
      showWarning: () => undefined,
      showInfo: () => undefined
    } as unknown as UIStore)
)
const safePopupStore = computed<PopupStore>(
  () =>
    popupStore.value ||
    ({
      isClearingCache: false,
      stats: { bookmarks: 0, folders: 0 },
      healthOverview: {
        totalScanned: 0,
        http404: 0,
        http500: 0,
        other4xx: 0,
        other5xx: 0,
        duplicateCount: 0
      }
    } as unknown as PopupStore)
)

const isClearingCache = computed(() => Boolean(safePopupStore.value.isLoading))
// 侧边栏本地状态（由于Chrome无直接查询接口，这里记录最近一次操作状态）
const isSidePanelOpen = ref<boolean | null>(null)
// 根据状态切换不同的图标
const sidePanelIcon = computed(() => {
  return isSidePanelOpen.value ? 'mdi-dock-right' : 'mdi-dock-left'
})
// 悬浮提示文案
const toggleTooltipText = computed(() =>
  isSidePanelOpen.value ? '收起侧边栏' : '展开侧边栏'
)

// 📊 统计信息计算属性
const stats = computed(
  () => safePopupStore.value.stats || { bookmarks: 0, folders: 0 }
)
const healthOverview = computed(
  () =>
    safePopupStore.value.healthOverview || {
      totalScanned: 0,
      http404: 0,
      http500: 0,
      other4xx: 0,
      other5xx: 0,
      duplicateCount: 0
    }
)

// 🔔 通知相关计算属性
const snackbar = computed(
  () => safeUIStore.value.snackbar || { show: false, text: '', color: 'info' }
)

// 本地UI状态
const popupCloseTimeout = ref<number | null>(null)
// 搜索本地状态与桥接
const searchText = ref('')
watch(
  searchText,
  (q: string) => {
    if (!popupStore.value) return
    // 将查询同步到 store，并触发 200ms 防抖搜索
    popupStore.value.searchQuery = q
    popupStore.value.performSearchDebounced(q, 200)
  },
  { flush: 'post' }
)

function handleOpenResult(item: {
  id: string
  url?: string
  domain?: string
  title: string
  path?: string[]
  pathString?: string
  matchScore?: number
  isFolder?: boolean
}) {
  try {
    // 规范为 store 的 SearchResult 结构
    const normalized = {
      id: item.id,
      title: item.title,
      url: item.url,
      domain: item.domain,
      path: item.path || [],
      pathString: item.pathString || '',
      matchScore: item.matchScore ?? 0,
      isFolder: item.isFolder ?? false
    }
    popupStore.value?.openBookmark(normalized, false)
  } catch {}
}
// --- 工具函数 ---

// --- 操作函数 ---
// 在弹出页中监听同一命令，收到时关闭自身，实现“切换展开收起”
function handleTogglePopupCommand(command: string) {
  if (command === 'open-popup' || command === '_execute_action') {
    try {
      window.close()
    } catch (e) {
      logger.warn('Popup', '尝试关闭弹出页失败', e)
    }
  }
}
async function toggleSidePanel(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (currentTab?.windowId) {
        // 根据本地状态执行打开或关闭，不显示提示
        const wantOpen = isSidePanelOpen.value !== true
        if (wantOpen) {
          // 打开侧边栏
          await chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            path: 'side-panel.html',
            enabled: true
          })
          await chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: false
          })
          await chrome.sidePanel.open({ windowId: currentTab.windowId })
          isSidePanelOpen.value = true
          // 广播状态同步
          try {
            chrome.runtime.sendMessage({
              type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
              isOpen: true
            })
          } catch {}
          logger.info('Popup', '侧边栏已打开')
        } else {
          // 关闭侧边栏
          await chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            enabled: false
          })
          isSidePanelOpen.value = false
          // 广播状态同步
          try {
            chrome.runtime.sendMessage({
              type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
              isOpen: false
            })
          } catch {}
          logger.info('Popup', '侧边栏已关闭')
        }
        return
      } else {
        throw new Error('无法获取当前窗口信息')
      }
    } else {
      throw new Error('chrome.sidePanel API 不可用')
    }
  } catch (error) {
    logger.error('Popup', '❌ 切换侧边栏失败', error)
  }
}

// AI 整理入口已移除

function openManualOrganizePage(): void {
  chrome.runtime.sendMessage({ type: 'OPEN_MANAGEMENT_PAGE' }, response => {
    if (chrome.runtime.lastError) {
      logger.error(
        'Popup',
        '❌ 发送消息失败',
        chrome.runtime.lastError?.message
      )
      // 降级方案：直接打开管理页面
      chrome.tabs.create({ url: chrome.runtime.getURL('management.html') })
    } else if (!response?.success) {
      logger.error('Popup', '❌ 打开管理页面失败', response?.error)
      // 降级方案：直接打开管理页面
      chrome.tabs.create({ url: chrome.runtime.getURL('management.html') })
    }
    // 🎯 保持popup开启，方便用户在管理页面和popup间切换
    // setTimeout(() => window.close(), PERFORMANCE_CONFIG.PAGE_CLOSE_DELAY);
  })
}

async function clearCacheAndRestructure(): Promise<void> {
  if (!popupStore.value || !uiStore.value) return

  try {
    await popupStore.value.clearCache()
    uiStore.value.showSuccess('缓存已成功清除！')
    // 🎯 清除缓存后保持popup开启，让用户看到成功消息并继续使用
    // setTimeout(() => window.close(), 2000);
  } catch (error) {
    uiStore.value.showError(`清除失败: ${(error as Error).message}`)
  }
}

function openShortcutSettings(): void {
  try {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  } catch {
    try {
      uiStore.value?.showInfo(
        '请在地址栏输入 chrome://extensions/shortcuts 进行快捷键设置'
      )
    } catch {}
  }
}

function openSettings(): void {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('settings.html')
      : '/settings.html'
    window.open(url, '_blank')
  } catch {
    window.open('/settings.html', '_blank')
  }
}

// 从统计卡片跳转到管理页并带上筛选参数
function openManagementWithFilter(key: string): void {
  try {
    // 将展示层的指标映射到管理页可识别的筛选键
    // 管理页当前支持的过滤键：'404' | 'duplicate' | 'empty' | 'invalid'
    let filter: string | null = null
    switch (key) {
      case 'duplicate':
        filter = 'duplicate'
        break
      case 'http404':
      case 'http500':
      case 'other4xx':
        // 统一归入 HTTP 错误检测，由 404 扫描承担
        filter = '404'
        break
      default:
        filter = null
    }

    const base = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('management.html')
      : '/management.html'
    const url = filter ? `${base}?filter=${encodeURIComponent(filter)}` : base
    // 直接使用 window.open，确保在无 tabs 权限或某些环境下也能可靠打开
    window.open(url, '_blank')
  } catch {
    // 兜底：无参数打开
    openManualOrganizePage()
  }
}

// --- 监听器 ---

// 加载书签统计数据
const loadBookmarkStats = async () => {
  try {
    logger.info('Popup', '🚀 从 Pinia Store 加载书签统计数据...')
    // 统计由 Store 内部通过 bookmarkAppService 计算
    await popupStore.value?.loadBookmarkStats?.()
  } catch (error) {
    logger.error('Popup', '❌ 加载书签统计失败', error)
  }
}

// --- 生命周期钩子 ---
onMounted(async () => {
  // 延迟动态导入stores避免初始化顺序问题
  try {
    logger.info('Popup', '开始动态导入stores...')

    // 🎯 点击图标永远显示popup，不需要状态查询
    logger.info('Popup', '📋 Popup启动，点击图标永远显示popup页面')

    // 动态导入stores - 使用IndexedDB版本
    const { useUIStore } = await import('../stores/ui-store')
    const { usePopupStoreIndexedDB } = await import(
      '../stores/popup-store-indexeddb'
    )

    uiStore.value = useUIStore()
    popupStore.value = usePopupStoreIndexedDB()

    logger.info('Popup', 'Stores初始化完成')

    // 设置当前页面信息
    uiStore.value.setCurrentPage('popup', 'AcuityBookmarksPopup')

    // 测量启动时间
    // const startupTimer = performanceMonitor.measureStartupTime();

    // 初始化Popup状态 - 增强错误处理
    logger.info('Popup', '开始初始化PopupStore...')
    try {
      // 🚀 非阻塞地触发所有初始化和数据加载
      popupStore.value.initialize()
      logger.info('Popup', 'PopupStore初始化已触发')

      // 加载书签统计数据
      loadBookmarkStats()
      // 加载健康度概览
      if (popupStore.value && popupStore.value.loadBookmarkHealthOverview) {
        popupStore.value.loadBookmarkHealthOverview()
      }
    } catch (initError) {
      logger.warn('Popup', 'PopupStore初始化失败，使用默认状态', initError)
      // 即使初始化失败，也要确保基本状态可用
      if (uiStore.value) {
        uiStore.value.showWarning('部分功能初始化失败，但基本功能仍可使用')
      }
    }

    // 结束启动时间测量
    // const startupTime = startupTimer.end();
    // console.log(`弹窗加载完成 (${startupTime.toFixed(0)}ms)`);
  } catch (error) {
    logger.error('Popup', 'Popup整体初始化失败', error)
    // 即使出错也要确保stores可用，让界面能显示
    if (uiStore.value) {
      uiStore.value.showError(`初始化失败: ${(error as Error).message}`)
    }
  }

  // 监听消息
  chrome.runtime.onMessage.addListener(() => {
    // 🎯 移除了侧边栏自动切换监听，现在使用统一的background逻辑
  })

  // 全局快捷键
  const globalHotkeyHandler = (event: KeyboardEvent) => {
    // 避免与输入类元素冲突
    const target = event.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return
    }
    const key = event.key.toLowerCase()
    if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // 兼容不同浏览器键位：优先匹配 code
      if (event.code === 'KeyT') {
        event.preventDefault()
        toggleSidePanel()
        return
      }
      switch (key) {
        case 'm':
          event.preventDefault()
          openManualOrganizePage()
          return
        case 'a':
          event.preventDefault()
          // AI整理入口已移除
          return
        case 'c':
          event.preventDefault()
          clearCacheAndRestructure()
          return
        case 't':
          event.preventDefault()
          toggleSidePanel()
          return
      }
    }
  }

  window.addEventListener('keydown', globalHotkeyHandler)
  ;(
    window as unknown as {
      _abGlobalHotkeyHandler?: (event: KeyboardEvent) => void
    }
  )._abGlobalHotkeyHandler = globalHotkeyHandler

  // 监听侧边栏状态消息，同步图标状态
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'SIDE_PANEL_STATE_CHANGED') {
      isSidePanelOpen.value = !!message.isOpen
    }
  })
})

onUnmounted(() => {
  if (popupCloseTimeout.value) clearTimeout(popupCloseTimeout.value)

  const globalWindow = window as unknown as {
    _abGlobalHotkeyHandler?: (event: KeyboardEvent) => void
  }
  if (globalWindow._abGlobalHotkeyHandler) {
    window.removeEventListener('keydown', globalWindow._abGlobalHotkeyHandler)
    globalWindow._abGlobalHotkeyHandler = undefined
  }
})
</script>

<style>
/* 全局样式 - 重置和设置popup容器 */
html,
body {
  margin: 0;
  padding: 0;
  width: 560px;
  min-width: 560px;
  max-width: 560px;
  overflow-x: hidden;
  overflow-y: hidden;
}

#app {
  width: 560px;
  min-width: 560px;
  max-width: 560px;
  margin: 0;
  padding: 0;
}
</style>

<style scoped>
.popup-container {
  width: 560px;
  min-height: 520px;
  max-height: 650px;
  overflow-y: auto;
  overflow-x: hidden;
}

.top-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: var(--spacing-sm) 12px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border-subtle);
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

.search-section {
  padding: 0 var(--spacing-lg) var(--spacing-sm);
}
.search-results {
  margin-top: 6px;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.results-list {
  list-style: none;
  padding: 4px 0;
  margin: 0;
}
.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  font-size: var(--text-sm);
}
.result-item:hover {
  background: var(--color-surface-variant);
}
.result-title {
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-domain {
  color: var(--color-text-tertiary);
  margin-left: 8px;
  font-size: 12px;
}

.icon-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
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
  /* 严格三列，间距8px */
  gap: var(--spacing-sm);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stats-item {
  min-width: 0;
}

.stats-card {
  text-align: center;
  transition: all var(--transition-base);
  /* 保持内部文本在单行显示的基础设置 */
  overflow: hidden;
  /* 固定整体高度并确保内容居中 */
  height: 128px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.stats-card:hover {
  /* 避免几何位移：仅使用阴影与颜色反馈 */
  box-shadow: var(--shadow-lg);
  opacity: 0.98;
}

.stats-number {
  /* 数字更醒目但不占满空间 */
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  line-height: 1.2;
  white-space: nowrap;
  word-break: keep-all;
  overflow-wrap: normal;
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

/* Head/Content 布局 */
.stats-head {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  padding-left: var(--spacing-sm);
  height: 40px;
  display: flex;
  align-items: center;
  background-color: var(--color-surface-variant);
  text-align: left;
}
.stats-head-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.stats-content {
  height: 100%;
  flex: 1;
  padding: var(--spacing-sm) 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 次要链接样式已移除：统计卡片整卡点击即可跳转 */

.primary-text {
  color: var(--color-primary);
}

.secondary-text {
  color: var(--color-secondary);
}

.warning-text {
  color: var(--color-warning);
}

.danger-text {
  color: var(--color-error);
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    column-gap: var(--spacing-sm);
  }
}

/* 兼容旧布局：在不支持 gap 的环境下为统计卡片容器添加降级间距 */
@supports not (gap: 1rem) {
  .stats-section > * {
    margin-right: var(--spacing-sm);
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

/* 按钮行：两列且间距严格为 var(--spacing-sm)，不换行 */
.action-buttons-row {
  display: flex;
  gap: var(--spacing-sm); /* 现代浏览器使用 gap 实现 var(--spacing-sm) 间距 */
}
.action-buttons-row > .acuity-col {
  /* 两列同时存在 gap 时，需要收窄每列宽度各 4px，避免换行 */
  flex: 0 0 calc(50% - 4px);
  max-width: calc(50% - 4px);
}

/* 兼容不支持 flex-gap 的环境：使用 margin-left 降级并保持宽度 */
@supports not (gap: 1rem) {
  .action-buttons-row {
    display: flex;
  }
  .action-buttons-row > .acuity-col + .acuity-col {
    margin-left: var(--spacing-sm);
  }
  .action-buttons-row > .acuity-col {
    flex: 0 0 calc(50% - 4px);
    max-width: calc(50% - 4px);
  }
}

.hotkeys-hint {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-lg);
}

/* 快捷键列表排列与设置入口 */
.shortcut-bar .label {
  display: flex;
  align-items: center;
  font-weight: var(--font-bold);
  color: var(--color-text-secondary);
  font-size: var(--text-lg);
}
.shortcut-list {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  list-style: none;
  padding: 0;
  margin: 0;
  flex-wrap: wrap; /* 自动换行，避免横向溢出 */
}
.shortcut-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2px var(--spacing-sm);
  font-size: 12px;
  white-space: nowrap; /* 文案不换行 */
  margin-bottom: 4px; /* 换行后行间距更舒适 */
}
.local-tip {
  color: var(--color-text-secondary);
}

/* 弹出页内快捷键独立展示样式 */
.local-hotkey-tip {
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.shortcut-settings-link {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 6px;
}
.shortcut-settings-link .icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
  display: block;
}
.shortcut-settings-link:hover {
  color: var(--color-primary);
}

:deep(mark) {
  background-color: var(--color-warning-alpha-20);
  color: var(--color-warning);
  padding: 0 2px;
  border-radius: var(--radius-sm);
}
</style>
