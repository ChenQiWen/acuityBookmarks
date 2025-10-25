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
          class="sidepanel-toggle"
          type="button"
          :aria-label="toggleTooltipText"
          :title="toggleTooltipText"
          data-testid="icon-toggle-sidepanel"
          @click="toggleSidePanel"
        >
          <Icon :name="sidePanelIcon" :size="28" />
        </button>
      </div>
      <div class="top-center">
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="promo-logo" />
        <div class="promo-title">AcuityBookmarks</div>
      </div>
      <div class="top-right">
        <ThemeToggle />
        <Button
          size="sm"
          variant="outline"
          class="ml-2"
          borderless
          @click="openSettings"
        >
          <Icon name="icon-setting" :size="24" />
        </Button>
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
        <!-- 统计信息与健康概览 -->
        <section class="stats-overview">
          <header class="overview-header" aria-label="书签总览">
            <div class="overview-title">
              <Icon name="icon-info" :size="20" class="overview-icon" />
              <div>
                <h1>书签总览</h1>
                <p v-if="stats.bookmarks === 0" class="hint">
                  尚未同步任何书签，点击下方管理按钮进行导入或同步。
                </p>
                <p v-else class="hint">下方显示健康扫描进度及问题统计。</p>
              </div>
            </div>
          </header>

          <div class="overview-grid" role="group" aria-label="书签总体状态">
            <Card
              class="stats-card stats-card--large"
              elevation="medium"
              rounded
              data-testid="card-bookmarks"
              aria-live="polite"
            >
              <div class="stats-head" aria-label="书签总数">
                <div class="stats-head-title">
                  <span>书签总数</span>
                  <Icon
                    name="icon-bookmark"
                    :size="18"
                    class="stats-head-icon"
                  />
                </div>
              </div>
              <div class="stats-content stats-content--center">
                <AnimatedNumber
                  class="stats-number primary-text stats-number--large"
                  :value="stats.bookmarks"
                />
              </div>
            </Card>

            <Card
              class="stats-card stats-card--progress"
              elevation="low"
              rounded
              data-testid="card-health-progress"
              aria-live="polite"
            >
              <div class="stats-head" aria-label="健康扫描进度">
                <div class="stats-head-title">
                  <span>健康扫描</span>
                  <Icon
                    name="icon-heart-pulse"
                    :size="18"
                    class="stats-head-icon"
                  />
                </div>
                <div class="progress-summary">
                  <span>{{ scanProgressText }}</span>
                  <span v-if="isScanComplete" class="badge badge--success"
                    >已完成</span
                  >
                  <span v-else class="badge badge--muted">进行中</span>
                </div>
              </div>
              <div class="stats-content">
                <ProgressBar
                  :value="healthOverview.totalScanned"
                  :max="Math.max(stats.bookmarks, 1)"
                  :height="8"
                  color="secondary"
                />
                <p class="progress-hint">
                  <span>已扫描 {{ healthOverview.totalScanned }}</span>
                  <span> / </span>
                  <span>{{ stats.bookmarks }}</span>
                </p>
              </div>
            </Card>
          </div>

          <section
            class="health-metrics"
            role="region"
            aria-label="书签健康指标"
          >
            <header class="metrics-header">
              <h2>健康指标</h2>
              <p v-if="!isScanComplete" class="metrics-sub">
                扫描进行中，数据将持续更新。
              </p>
              <p v-else class="metrics-sub metrics-sub--done">
                扫描完成，可随时点击指标进行清理。
              </p>
            </header>

            <div class="metrics-grid" role="group" aria-label="健康指标列表">
              <Card
                class="stats-card"
                elevation="low"
                rounded
                data-testid="card-duplicate"
                @click="openManagementWithFilter('duplicate')"
              >
                <div class="stats-head" aria-label="重复 URL 数量">
                  <div class="stats-head-title">
                    <span>重复 URL</span>
                    <Icon
                      name="icon-content-copy"
                      :size="16"
                      class="stats-head-icon"
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

              <Card
                class="stats-card"
                elevation="low"
                rounded
                data-testid="card-dead"
                @click="openManagementWithFilter('dead')"
              >
                <div class="stats-head" aria-label="失效书签数量">
                  <div class="stats-head-title">
                    <span>失效书签</span>
                    <Icon
                      name="icon-link-off"
                      :size="16"
                      class="stats-head-icon"
                    />
                  </div>
                </div>
                <div class="stats-content">
                  <AnimatedNumber
                    class="stats-number danger-text"
                    :value="healthOverview.dead"
                  />
                </div>
              </Card>
            </div>
          </section>
        </section>

        <!-- 操作按钮：管理 -->
        <Grid is="row" class="action-buttons-row" gutter="md">
          <Grid is="col" :cols="24">
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
                <Icon name="icon-folder-edit" />
              </template>
              管理
            </Button>
          </Grid>
        </Grid>

        <!-- 快捷键提示（与manifest保持一致） -->
        <div class="hotkeys-hint">
          <div v-if="shortcutItems.length > 0" class="shortcut-bar">
            <h1 class="label">
              全局快捷键
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
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCommandsShortcuts } from '@/composables/useCommandsShortcuts'
import { logger } from '@/infrastructure/logging/logger'
import { useUIStore } from '@/stores/ui-store'
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
import {
  Button,
  Card,
  Grid,
  Spinner,
  Toast,
  ThemeToggle,
  ProgressBar
} from '@/components'
import { AB_EVENTS } from '@/constants/events'
import Icon from '@/components/base/Icon/Icon.vue'
/**
 * 全局命令快捷键工具集，提供加载与自动刷新能力。
 */
const { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh } =
  useCommandsShortcuts()

/**
 * 统一管理需要在组件销毁时执行的清理逻辑。
 */
const cleanupCallbacks: Array<() => void> = []

/**
 * 注册一个清理回调，组件卸载时会批量执行。
 */
function registerCleanup(callback: () => void): void {
  cleanupCallbacks.push(callback)
}

/**
 * 将当前命令配置映射为展示文案，仅显示已配置的快捷键。
 */
const shortcutItems = computed(() => {
  const labelMap: Record<string, string> = {
    _execute_action: '激活扩展/切换弹出页',
    'open-side-panel': '切换侧边栏',
    'open-management': '管理页面',
    'open-settings': '打开设置'
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
      registerCleanup(() => {
        try {
          chrome.commands.onCommand.removeListener(handleTogglePopupCommand)
        } catch (error) {
          logger.warn('Popup', '移除命令快捷键监听失败', error)
        }
      })
    }
  } catch (error) {
    logger.warn('Popup', '注册命令快捷键监听失败', error)
  }
})

/**
 * 轻量数字动画组件（局部注册），用于数值平滑滚动展示。
 */
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

/** Store 实例 - 使用响应式引用以确保模板能正确更新。 */
type UIStore = ReturnType<typeof useUIStore>
type PopupStore = ReturnType<typeof usePopupStoreIndexedDB>
const uiStore = ref<UIStore | null>(null)
const popupStore = ref<PopupStore | null>(null)

/**
 * 判断 store 是否已完整初始化。
 */
const isStoresReady = computed(() => !!uiStore.value && !!popupStore.value)

/**
 * 提供安全的 UIStore 访问对象，即使尚未初始化也不会抛错。
 */
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
/**
 * 提供安全的 PopupStore 访问对象，保证模板引用时有兜底数据。
 */
const safePopupStore = computed<PopupStore>(
  () =>
    popupStore.value ||
    ({
      stats: { bookmarks: 0 },
      healthOverview: {
        totalScanned: 0,
        dead: 0,
        duplicateCount: 0
      }
    } as unknown as PopupStore)
)
/**
 * 侧边栏本地状态（由于Chrome无直接查询接口，这里记录最近一次操作状态）
 * @description 侧边栏本地状态（由于Chrome无直接查询接口，这里记录最近一次操作状态）
 * @returns {boolean} 侧边栏本地状态
 */
const isSidePanelOpen = ref<boolean>(false)
/**
 * 根据状态切换不同的图标
 * @description 根据状态切换不同的图标
 * @returns {string} 不同的图标
 */
const sidePanelIcon = computed(() => {
  if (isSidePanelOpen.value) {
    return 'icon-sidePanel-expand'
  }
  return 'icon-sidePanel-collapse'
})
/**
 * 切换侧边栏悬浮提示文案
 * @description 切换侧边栏悬浮提示文案
 * @returns {string} 切换侧边栏悬浮提示文案
 */
const toggleTooltipText = computed(() =>
  isSidePanelOpen.value ? '收起侧边栏' : '展开侧边栏'
)

/**
 * 刷新侧边栏状态
 * @description 刷新侧边栏状态
 * @returns {Promise<void>} 刷新侧边栏状态
 * @throws {Error} 刷新侧边栏状态失败
 */
async function refreshSidePanelState(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome?.sidePanel?.getOptions) {
      isSidePanelOpen.value = false
      return
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const currentTab = tabs[0]
    if (!currentTab?.id) {
      isSidePanelOpen.value = false
      return
    }
    await new Promise<void>(resolve => {
      try {
        chrome.sidePanel.getOptions({ tabId: currentTab.id }, options => {
          if (chrome?.runtime?.lastError) {
            logger.debug(
              'Popup',
              'getOptions lastError',
              chrome.runtime.lastError?.message
            )
            isSidePanelOpen.value = false
            resolve()
            return
          }
          isSidePanelOpen.value = !!options?.enabled
          resolve()
        })
      } catch (error) {
        logger.warn('Popup', '获取侧边栏状态失败', error)
        isSidePanelOpen.value = false
        resolve()
      }
    })
  } catch (error) {
    logger.warn('Popup', '刷新侧边栏状态失败', error)
    isSidePanelOpen.value = false
  }
}

// 📊 统计信息计算属性
const stats = computed(() => safePopupStore.value.stats || { bookmarks: 0 })
const healthOverview = computed(
  () =>
    safePopupStore.value.healthOverview || {
      totalScanned: 0,
      dead: 0,
      duplicateCount: 0
    }
)

/**
 * 扫描进度文本
 * @description 扫描进度文本
 * @returns {string} 扫描进度文本
 */
const scanProgressText = computed(() => {
  const scanned = healthOverview.value.totalScanned
  const total = stats.value.bookmarks
  if (!total) return '尚未扫描'
  if (scanned >= total) return `已扫描 ${total} 条`
  return `已扫描 ${scanned} / ${total}`
})
const isScanComplete = computed(() => {
  const total = stats.value.bookmarks
  if (!total) return false
  return healthOverview.value.totalScanned >= total
})

// 🔔 通知相关计算属性
const snackbar = computed(
  () => safeUIStore.value.snackbar || { show: false, text: '', color: 'info' }
)

// 本地UI状态
const popupCloseTimeout = ref<number | null>(null)

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
/**
 * 切换侧边栏
 * @description 切换侧边栏
 * @returns {Promise<void>} 切换侧边栏
 * @throws {Error} 切换侧边栏失败
 */
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
            chrome.runtime.sendMessage(
              {
                type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
                isOpen: true
              },
              () => {
                try {
                  if (chrome?.runtime?.lastError) {
                    logger.debug(
                      'Popup',
                      'SIDE_PANEL_STATE_CHANGED lastError:',
                      chrome.runtime.lastError?.message
                    )
                  }
                } catch {}
              }
            )
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
            chrome.runtime.sendMessage(
              {
                type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
                isOpen: false
              },
              () => {
                try {
                  if (chrome?.runtime?.lastError) {
                    logger.debug(
                      'Popup',
                      'SIDE_PANEL_STATE_CHANGED lastError:',
                      chrome.runtime.lastError?.message
                    )
                  }
                } catch {}
              }
            )
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

/**
 * 打开手动整理页面
 * @description 打开手动整理页面
 * @returns {void} 打开手动整理页面
 * @throws {Error} 打开手动整理页面失败
 */
function openManualOrganizePage(): void {
  const fallback = () => {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('management.html')
      : '/management.html'
    chrome.tabs.create({ url }).catch(() => {
      window.open(url, '_blank')
    })
  }

  chrome.runtime.sendMessage({ type: 'OPEN_MANAGEMENT_PAGE' }, response => {
    if (chrome.runtime.lastError) {
      logger.error(
        'Component',
        'Popup',
        '❌ 发送消息失败',
        chrome.runtime.lastError?.message
      )
      fallback()
    } else if (!response?.success) {
      logger.error('Component', 'Popup', '❌ 打开管理页面失败', response?.error)
      fallback()
    }
    // 🎯 保持popup开启，方便用户在管理页面和popup间切换
    // setTimeout(() => window.close(), PERFORMANCE_CONFIG.PAGE_CLOSE_DELAY);
  })
}

/**
 * 打开快捷键设置页面
 * @description 打开快捷键设置页面
 * @returns {void} 打开快捷键设置页面
 * @throws {Error} 打开快捷键设置页面失败
 */
function openShortcutSettings(): void {
  try {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  } catch {
    try {
      uiStore.value?.showInfo(
        '请在地址栏输入 chrome://extensions/shortcuts 进行快捷键设置'
      )
    } catch (error) {
      logger.error('Popup', '打开快捷键设置页面失败', error)
    }
  }
}
/**
 * 打开设置页面
 * @description 打开设置页面
 */
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
    const tags: string[] = []
    switch (key) {
      case 'duplicate':
        tags.push('duplicate')
        break
      case 'dead':
        // 统一归入 HTTP 错误检测，由 404 扫描承担
        tags.push('404')
        break
      case 'empty':
        tags.push('empty')
        break
      case 'invalid':
        tags.push('invalid')
        break
      default:
        break
    }

    const base = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('management.html')
      : '/management.html'
    const url =
      tags.length > 0
        ? `${base}?tags=${encodeURIComponent(tags.join(','))}`
        : base

    chrome.tabs.create({ url }).catch(() => {
      window.open(url, '_blank')
    })
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
    logger.error('Component', 'Popup', '❌ 加载书签统计失败', error)
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
    const { useUIStore } = await import('@/stores/ui-store')
    const { usePopupStoreIndexedDB } = await import(
      '@/stores/popup-store-indexeddb'
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

    await refreshSidePanelState()

    const messageListener = (message: unknown) => {
      const payload = message as { type?: string; isOpen?: boolean }
      if (payload?.type === AB_EVENTS.SIDE_PANEL_STATE_CHANGED) {
        isSidePanelOpen.value = !!payload.isOpen
      }
    }
    chrome.runtime.onMessage.addListener(messageListener)
    registerCleanup(() => {
      try {
        chrome.runtime.onMessage.removeListener(messageListener)
      } catch (error) {
        logger.warn('Popup', '移除初始消息监听器失败', error)
      }
    })
  } catch (error) {
    logger.error('Component', 'Popup', 'Popup整体初始化失败', error)
    // 即使出错也要确保stores可用，让界面能显示
    if (uiStore.value) {
      uiStore.value.showError(`初始化失败: ${(error as Error).message}`)
    }
  }

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
          // 清除缓存功能已移动到设置页面
          event.preventDefault()
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
  registerCleanup(() => {
    const globalWindow = window as unknown as {
      _abGlobalHotkeyHandler?: (event: KeyboardEvent) => void
    }
    if (globalWindow._abGlobalHotkeyHandler) {
      window.removeEventListener('keydown', globalWindow._abGlobalHotkeyHandler)
      globalWindow._abGlobalHotkeyHandler = undefined
    }
  })

  // 监听侧边栏状态消息，同步图标状态
  const sidePanelStateListener = (message: unknown) => {
    const payload = message as { type?: string; isOpen?: boolean }
    if (payload?.type === 'SIDE_PANEL_STATE_CHANGED') {
      isSidePanelOpen.value = !!payload.isOpen
    }
  }
  chrome.runtime.onMessage.addListener(sidePanelStateListener)
  registerCleanup(() => {
    try {
      chrome.runtime.onMessage.removeListener(sidePanelStateListener)
    } catch (error) {
      logger.warn('Popup', '移除侧边栏状态监听器失败', error)
    }
  })

  try {
    await refreshSidePanelState()
  } catch (error) {
    logger.warn('Popup', '初始化侧边栏状态时出现问题', error)
  }
})

onUnmounted(() => {
  try {
    stopAutoRefresh()
  } catch (error) {
    logger.warn('Popup', '停止快捷键自动刷新失败', error)
  }

  if (popupCloseTimeout.value) clearTimeout(popupCloseTimeout.value)

  while (cleanupCallbacks.length) {
    const callback = cleanupCallbacks.pop()
    if (!callback) continue
    try {
      callback()
    } catch (error) {
      logger.warn('Popup', '执行清理回调失败', error)
    }
  }
})
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  overflow: hidden; /* 隐藏根级滚动条，但保留内部容器滚动 */
}

body::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
</style>

<style scoped>
html,
body {
  width: 560px;
}
#app {
  width: 560px;
  min-width: 560px;
  max-width: 560px;
  margin: 0;
  padding: 0;
}
.popup-container {
  width: 560px;
  min-height: 520px;
  max-height: 650px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none; /* Firefox 隐藏滚动条，保留滚动能力 */
}

:deep(.popup-container::-webkit-scrollbar) {
  width: 0;
  height: 0;
  display: none; /* WebKit 浏览器隐藏滚动条 */
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

.overview-icon {
  color: var(--color-primary);
}

.sidepanel-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  padding: 0;
}

.sidepanel-toggle:hover {
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
}

.sidepanel-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.sidepanel-toggle > .acuity-icon {
  font-size: 28px;
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

.stats-overview {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-subtle);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.overview-title {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.overview-icon {
  color: var(--color-primary);
}

.overview-header h1 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.hint {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.stats-card {
  text-align: center;
  transition: all var(--transition-base);
  overflow: hidden;
  height: 128px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.stats-card:hover {
  box-shadow: var(--shadow-lg);
  opacity: 0.98;
}

.stats-card--large {
  grid-column: span 1;
}

.stats-card--progress {
  grid-column: span 1;
}

.stats-number {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  line-height: 1.2;
  white-space: nowrap;
  word-break: keep-all;
  overflow-wrap: normal;
}

.stats-number--large {
  font-size: var(--text-4xl);
}

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

.stats-head-icon {
  color: var(--color-text-secondary);
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

.stats-content--center {
  justify-content: center;
}

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

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.badge--success {
  color: var(--color-success);
  background: var(--color-success-alpha-10);
}

.badge--muted {
  color: var(--color-text-secondary);
  background: var(--color-border-subtle);
}

.progress-summary {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.progress-hint {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.health-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.metrics-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metrics-header h2 {
  margin: 0;
  font-size: var(--text-lg);
  color: var(--color-text-primary);
}

.metrics-sub {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin: 0;
}

.metrics-sub--done {
  color: var(--color-success);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-sm);
}

.metrics-grid .stats-card {
  height: 120px;
}

/* 兼容旧布局 - 无 gap 支持时的降级 */
@supports not (gap: 1rem) {
  .overview-grid,
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--spacing-sm);
    row-gap: var(--spacing-sm);
  }
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

/* 兼容不支持 flex-gap 的环境：使用 margin-left 降级并保持宽度 */
@supports not (gap: 1rem) {
  .action-buttons-row {
    display: flex;
  }
  .action-buttons-row > .acuity-col + .acuity-col {
    margin-left: var(--spacing-sm);
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
  align-items: baseline;
  font-weight: var(--font-bold);
  color: var(--color-text-secondary);
  font-size: var(--text-lg);
  gap: var(--spacing-xs);
}

/* 修复键盘图标对齐 */
.shortcut-bar .label::before {
  content: '⌨️';
  font-size: 1.1em;
  line-height: 1;
  vertical-align: baseline;
  margin-right: var(--spacing-xs);
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

.progress-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.badge {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 2px 6px;
  border-radius: 8px;
  white-space: nowrap;
}

.badge--success {
  background-color: var(--color-success-alpha-10);
  color: var(--color-success);
}

.badge--muted {
  background-color: var(--color-muted-alpha-10);
  color: var(--color-muted);
}

.progress-hint {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.health-metrics {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-subtle);
}

.metrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.metrics-header h2 {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.metrics-sub {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.metrics-sub--done {
  color: var(--color-success);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-sm);
}
</style>
