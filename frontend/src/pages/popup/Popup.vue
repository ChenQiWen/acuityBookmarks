<!--
  Popup 弹出页根组件
  - 提供常用操作入口：侧边栏开关、设置打开、搜索与快捷提示；
  - 通过组合式 API 管理状态，避免在模板内写复杂逻辑；
  - 遵循扩展 CSP：所有脚本为模块化引入，无内联脚本。
-->
<template>
  <!-- 📊 全局书签同步进度对话框 -->
  <GlobalSyncProgress />

  <!-- ⚡ 全局快速添加书签对话框 -->
  <GlobalQuickAddBookmark ref="quickAddRef" />

  <div class="popup-container">
    <AppHeader
      back-tooltip="展开侧边栏"
      @back="toggleSidePanel"
      @open-settings="openSettings"
    />
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
          <div class="summary-grid" role="group" aria-label="书签统计摘要">
            <Card
              class="summary-card summary-card--total"
              elevation="low"
              rounded
              borderless
              data-testid="card-bookmarks"
              aria-live="polite"
            >
              <div class="summary-card__header">
                <div class="summary-card__title">
                  <Icon name="icon-bookmark" :size="18" />
                  <span>书签总数</span>
                </div>
              </div>
              <div class="summary-card__value summary-card__value--primary">
                <AnimatedNumber :value="stats.bookmarks" />
              </div>
            </Card>

            <Card
              class="summary-card summary-card--progress"
              elevation="low"
              rounded
              borderless
              data-testid="card-health-progress"
              aria-live="polite"
            >
              <div class="summary-card__header">
                <div class="summary-card__title">
                  <Icon name="icon-heart" :size="18" />
                  <span>健康标签同步</span>
                </div>
              </div>
              <div class="summary-card__body">
                <div class="summary-card__status">
                  <span>{{ scanProgressText }}</span>
                  <span
                    class="summary-badge"
                    :class="
                      isScanComplete
                        ? 'summary-badge--success'
                        : 'summary-badge--muted'
                    "
                  >
                    {{ isScanComplete ? '完成' : '进行中' }}
                  </span>
                </div>
                <ProgressBar
                  :value="localScanProgress"
                  :max="Math.max(stats.bookmarks, 1)"
                  :height="6"
                  color="success"
                  :animated="true"
                  :striped="false"
                />
                <div class="summary-card__meta">
                  <span>已同步 {{ localScanProgress }}</span>
                </div>
              </div>
            </Card>

            <Card
              class="summary-card"
              elevation="low"
              rounded
              borderless
              clickable
              data-testid="card-duplicate"
              @click="openManagementWithFilter('duplicate')"
            >
              <div class="summary-card__header">
                <div class="summary-card__title">
                  <Icon name="icon-duplicate" :size="16" />
                  <span>重复书签</span>
                </div>
              </div>
              <div class="summary-card__value summary-card__value--warning">
                <Spinner v-if="isLoadingHealthOverview" size="sm" />
                <AnimatedNumber v-else :value="healthOverview.duplicateCount" />
              </div>
            </Card>

            <Card
              class="summary-card"
              elevation="low"
              rounded
              borderless
              clickable
              data-testid="card-dead"
              @click="openManagementWithFilter('dead')"
            >
              <div class="summary-card__header">
                <div class="summary-card__title">
                  <Icon name="icon-link-off" :size="16" />
                  <span>失效书签</span>
                </div>
              </div>
              <div class="summary-card__value summary-card__value--danger">
                <Spinner v-if="isLoadingHealthOverview" size="sm" />
                <AnimatedNumber v-else :value="healthOverview.dead" />
              </div>
            </Card>
          </div>
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
                <Icon name="icon-folder" />
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
                <Icon name="icon-setting" :size="20" aria-hidden="true" />
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
            <span class="local-tip"
              >弹出页内：Alt+T 切换侧边栏 | 或点击地址栏右侧的侧边栏图标</span
            >
          </div>
        </div>
      </Grid>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineOptions, onMounted, onUnmounted, ref } from 'vue'

defineOptions({
  name: 'PopupPage'
})
import GlobalSyncProgress from '@/components/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/GlobalQuickAddBookmark.vue'
import { useCommandsShortcuts } from '@/composables/useCommandsShortcuts'
import { usePopupKeyboard } from '@/composables/usePopupKeyboard'
import { logger } from '@/infrastructure/logging/logger'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { useUIStore } from '@/stores/ui-store'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
import {
  Button,
  Card,
  Grid,
  Spinner,
  Toast,
  ProgressBar,
  AppHeader,
  AnimatedNumber
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
    'open-management': '管理页面',
    'open-settings': '打开设置'
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

  // ✅ 检查 URL 参数，如果是添加书签操作，自动触发对话框
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const action = urlParams.get('action')

    if (action === 'add-bookmark') {
      const title = urlParams.get('title') || ''
      const url = urlParams.get('url') || ''
      const favIconUrl = urlParams.get('favIconUrl') || ''

      logger.info('Popup', '通过 URL 参数触发添加书签', { title, url })

      // 延迟一下，确保组件已挂载
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'SHOW_ADD_BOOKMARK_DIALOG',
          data: { title, url, favIconUrl }
        })
      }, 100)
    }
  } catch (error) {
    logger.warn('Popup', '处理 URL 参数失败', error)
  }

  // 监听同一快捷键以实现"再次按下收起"效果
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
      },
      isLoadingHealthOverview: false
    } as unknown as PopupStore)
)
/**
 * 侧边栏本地状态（由于Chrome无直接查询接口，这里记录最近一次操作状态）
 * @description 侧边栏本地状态（由于Chrome无直接查询接口，这里记录最近一次操作状态）
 * @returns {boolean} 侧边栏本地状态
 */
const isSidePanelOpen = ref<boolean>(false)

/**
 * 切换侧边栏悬浮提示文案
 * @description 切换侧边栏悬浮提示文案
 * @returns {string} 切换侧边栏悬浮提示文案
 */

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

// 使用本地 ref 管理扫描进度，避免多层 computed 响应式失效
const localScanProgress = ref(0)

const healthOverview = computed(
  () =>
    safePopupStore.value.healthOverview || {
      totalScanned: 0,
      dead: 0,
      duplicateCount: 0
    }
)

const isLoadingHealthOverview = computed(
  () => safePopupStore.value.isLoadingHealthOverview || false
)

/**
 * 扫描进度文本
 * @description 扫描进度文本
 * @returns {string} 扫描进度文本
 */
const scanProgressText = computed(() => {
  const scanned = localScanProgress.value
  const total = stats.value.bookmarks
  if (!total) return '尚未扫描'
  if (scanned >= total) return `已扫描 ${total} 条`
  return `已扫描 ${scanned} / ${total}`
})
const isScanComplete = computed(() => {
  const total = stats.value.bookmarks
  if (!total) return false
  return localScanProgress.value >= total
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

          // 广播状态到其他页面（通过 Chrome 消息）
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

          // 2. 同步状态到当前页面内的组件（通过 mitt 事件总线）
          try {
            const { emitEvent } = await import(
              '@/infrastructure/events/event-bus'
            )
            emitEvent('sidepanel:state-changed', { isOpen: true })
          } catch {}

          logger.info('Popup', '侧边栏已打开')
        } else {
          // 关闭侧边栏
          await chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            enabled: false
          })
          isSidePanelOpen.value = false

          // 广播状态到其他页面（通过 Chrome 消息）
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

          // 2. 同步状态到当前页面内的组件（通过 mitt 事件总线）
          try {
            const { emitEvent } = await import(
              '@/infrastructure/events/event-bus'
            )
            emitEvent('sidepanel:state-changed', { isOpen: false })
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

// 从统计卡片跳转到管理页并带上搜索参数
function openManagementWithFilter(key: string): void {
  console.log('[Popup] openManagementWithFilter 被调用:', key)
  try {
    // 将展示层的指标映射到管理页可识别的搜索键
    // 管理页当前支持的过滤键：'duplicate' | 'invalid'
    const tags: string[] = []
    switch (key) {
      case 'duplicate':
        tags.push('duplicate')
        break
      case 'dead':
      case 'invalid':
        // "失效书签"（已合并404和URL格式错误）
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

    console.log('[Popup] 准备跳转到:', url)

    chrome.tabs.create({ url }).catch(err => {
      console.warn('[Popup] chrome.tabs.create 失败，使用 window.open:', err)
      window.open(url, '_blank')
    })
  } catch (err) {
    console.error('[Popup] openManagementWithFilter 错误:', err)
    // 兜底：无参数打开
    openManualOrganizePage()
  }
}

// --- 监听器 ---

// 🎹 注册全局快捷键（必须在 <script setup> 顶层调用，不能在 onMounted 异步回调中）
usePopupKeyboard({
  toggleSidePanel,
  openManagement: openManualOrganizePage
})

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
        popupStore.value.loadBookmarkHealthOverview().then(() => {
          // 初始化本地扫描进度
          localScanProgress.value = healthOverview.value.totalScanned
          logger.info(
            'Popup',
            `📊 初始化扫描进度: ${localScanProgress.value}/${stats.value.bookmarks}`
          )
        })
      }

      // 🔄 智能扫描策略：避免重复扫描
      // - 后台定时任务每 5 分钟自动扫描一次
      // - Popup 仅在从未扫描过时主动触发一次（首次使用体验）
      // - 其他情况只显示结果，由后台定时任务负责
      setTimeout(() => {
        const totalBookmarks = stats.value.bookmarks
        const scanned = localScanProgress.value

        logger.info(
          'Popup',
          `📊 当前健康数据：已扫描 ${scanned}/${totalBookmarks}`
        )

        // 仅在从未扫描过时（totalScanned === 0）主动触发一次
        if (scanned === 0 && totalBookmarks > 0) {
          logger.info('Popup', '🆕 首次使用，启动首次健康扫描...')

          import('@/stores/cleanup/cleanup-store')
            .then(({ useCleanupStore }) => {
              const cleanupStore = useCleanupStore()

              // 订阅 Worker 进度更新
              import('@/services/health-scan-worker-service')
                .then(({ healthScanWorkerService }) => {
                  const unsubscribe = healthScanWorkerService.onProgress(
                    progress => {
                      logger.info(
                        'Popup',
                        `📊 扫描进度: ${progress.current}/${progress.total} (${progress.percentage.toFixed(1)}%)`
                      )
                      localScanProgress.value = progress.current
                    }
                  )

                  // 启动首次扫描
                  cleanupStore
                    .startHealthScanWorker()
                    .then(() => {
                      logger.info(
                        'Popup',
                        `✅ 首次健康扫描完成 (${localScanProgress.value}/${stats.value.bookmarks})`
                      )
                      logger.info(
                        'Popup',
                        '💡 后续扫描将由后台定时任务自动执行（每 5 分钟）'
                      )

                      // 刷新健康统计数据
                      if (popupStore.value) {
                        popupStore.value
                          .loadBookmarkHealthOverview()
                          .catch((err: unknown) => {
                            logger.warn('Popup', '刷新健康统计失败', err)
                          })
                      }
                    })
                    .catch((error: unknown) => {
                      logger.error('Popup', '❌ 首次健康扫描失败', error)
                    })
                    .finally(() => {
                      unsubscribe()
                    })
                })
                .catch((error: unknown) => {
                  logger.error(
                    'Popup',
                    '❌ 导入 healthScanWorkerService 失败',
                    error
                  )
                })
            })
            .catch((error: unknown) => {
              logger.error('Popup', '❌ 动态导入 cleanupStore 失败', error)
            })
        } else if (scanned < totalBookmarks) {
          logger.info(
            'Popup',
            `⏳ 健康扫描进行中或未完成 (${scanned}/${totalBookmarks})`
          )
          logger.info('Popup', '💡 后台定时任务将自动完成扫描（每 5 分钟）')
        } else {
          logger.info(
            'Popup',
            `✅ 健康扫描已完成 (${scanned}/${totalBookmarks})`
          )
        }
      }, 2000) // 延迟 2 秒，避免影响 Popup 启动性能
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
  max-height: 600px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none; /* Firefox 隐藏滚动条，保留滚动能力 */
  background: var(--color-background);
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
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
}

.stats-overview {
  margin-bottom: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
  max-width: 100%;
}

.summary-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  min-height: 88px;
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--color-border-subtle);
}

.summary-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-alpha-20);
}

/* 第一个卡片（书签总数）占据整行 */
.summary-card--total {
  grid-column: 1 / -1;
}

/* 第二个卡片（健康标签同步）占据整行 */
.summary-card--progress {
  grid-column: 1 / -1;
}

.summary-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.summary-card__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: var(--font-semibold);
}

.summary-card__value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: var(--font-bold);
  line-height: 1;
}

.summary-card__value--primary {
  color: var(--color-primary);
}

.summary-card__value--warning {
  color: var(--color-warning);
}

.summary-card__value--danger {
  color: var(--color-error);
}

.summary-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.summary-card__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.summary-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.summary-badge--success {
  color: var(--color-success);
  background: var(--color-success-alpha-10);
}

.summary-badge--muted {
  color: var(--color-text-secondary);
  background: var(--color-border-subtle);
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

/* 操作按钮区域 */
.action-buttons-row {
  margin-top: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.action-btn {
  font-weight: var(--font-semibold);
  height: 42px;
}

/* 快捷键提示区域 */
.hotkeys-hint {
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
}

.shortcut-bar {
  margin-bottom: var(--spacing-sm);
}

.shortcut-bar .label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.shortcut-settings-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.shortcut-settings-link:hover {
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
}

.shortcut-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.shortcut-item {
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 4px var(--spacing-sm);
  background: var(--color-background);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  line-height: 1.3;
  white-space: nowrap;
}

.local-hotkey-tip {
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-subtle);
  margin-top: var(--spacing-sm);
}

.local-tip {
  font-size: 11px;
  color: var(--color-text-tertiary);
  display: block;
  line-height: 1.3;
  margin: 0;
}
</style>
