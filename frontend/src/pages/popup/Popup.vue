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
      back-tooltip="打开侧边栏"
      :show-settings-button="false"
      @back="openSidePanel"
    />
    <!-- 加载状态 -->
    <div v-if="!isStoresReady" class="loading-container">
      <Spinner color="primary" size="lg" />
      <p class="loading-text" data-testid="popup-loading-text">正在初始化...</p>
    </div>
    <!-- 主内容 - 只有当stores都存在时才显示 -->
    <div v-else class="main-container">
      <!-- 📊 书签概览 -->
      <section class="overview-section">
        <h2 class="section-title">
          <Icon name="icon-bookmark" :size="16" />
          <span>书签概览</span>
        </h2>
        <div class="overview-grid">
          <div class="stat-card">
            <div class="stat-label">总数</div>
            <div class="stat-value stat-value--primary">
              <AnimatedNumber :value="stats.bookmarks" />
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">今日新增</div>
            <div class="stat-value stat-value--secondary">
              <AnimatedNumber :value="stats.todayAdded" />
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">本周访问</div>
            <div class="stat-value stat-value--secondary">
              <AnimatedNumber :value="stats.weeklyVisited" />
            </div>
          </div>
        </div>
      </section>

      <!-- ⚠️ 需要关注 -->
      <section class="issues-section">
        <h2 class="section-title">
          <Icon name="icon-alert" :size="16" />
          <span>需要关注</span>
        </h2>
        <div class="issues-grid">
          <Card
            class="issue-card issue-card--warning"
            elevation="none"
            rounded
            clickable
            @click="openManagementWithFilter('duplicate')"
          >
            <div class="issue-header">
              <Icon name="icon-duplicate" :size="20" />
              <span class="issue-label">重复书签</span>
            </div>
            <div class="issue-value">
              <Spinner v-if="isLoadingHealthOverview" size="sm" />
              <AnimatedNumber v-else :value="healthOverview.duplicateCount" />
            </div>
          </Card>

          <Card
            class="issue-card issue-card--danger"
            elevation="none"
            rounded
            clickable
            @click="openManagementWithFilter('dead')"
          >
            <div class="issue-header">
              <Icon name="icon-link-off" :size="20" />
              <span class="issue-label">失效书签</span>
            </div>
            <div class="issue-value">
              <Spinner v-if="isLoadingHealthOverview" size="sm" />
              <AnimatedNumber v-else :value="healthOverview.dead" />
            </div>
          </Card>
        </div>
      </section>

      <!-- ⚡ 快速操作 -->
      <section class="actions-section">
        <h2 class="section-title">
          <Icon name="icon-flash" :size="16" />
          <span>快速操作</span>
        </h2>
        <div class="actions-grid">
          <button class="action-button" @click="openManualOrganizePage">
            <Icon name="icon-folder" :size="20" />
            <span>整理</span>
          </button>
          <button class="action-button" @click="openSettings">
            <Icon name="icon-setting" :size="20" />
            <span>设置</span>
          </button>
        </div>
      </section>

      <!-- 💡 健康扫描状态 -->
      <section v-if="!isScanComplete" class="scan-section">
        <div class="scan-status">
          <Icon name="icon-heart" :size="14" />
          <span class="scan-text">健康扫描: {{ scanProgressText }}</span>
          <span
            class="scan-badge"
            :class="isScanComplete ? 'scan-badge--success' : 'scan-badge--muted'"
          >
            {{ isScanComplete ? '完成' : '进行中' }}
          </span>
        </div>
        <ProgressBar
          :value="localScanProgress"
          :max="Math.max(stats.bookmarks, 1)"
          :height="4"
          color="primary"
          :animated="true"
          :striped="false"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GlobalSyncProgress from '@/components/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/GlobalQuickAddBookmark.vue'
import { useThemeSync } from '@/composables/useThemeSync'
import { logger } from '@/infrastructure/logging/logger'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { useUIStore } from '@/stores/ui-store'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
import {
  Card,
  Spinner,
  ProgressBar,
  AppHeader,
  AnimatedNumber
} from '@/components'
import { AB_EVENTS } from '@/constants/events'
import Icon from '@/components/base/Icon/Icon.vue'

// import { useQuery } from '@tanstack/vue-query'
// import { trpc } from '../../services/trpc'

/*
const {
  data: helloData,
  isLoading: isHelloLoading,
  error: helloError
} = useQuery({
  queryKey: ['helloTRPC'],
  queryFn: () => trpc.example.hello.query({ text: 'World' })
})
*/

defineOptions({
  name: 'PopupPage'
})

// 启用主题同步
useThemeSync('Popup')

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

onMounted(() => {

  // 检查 URL 参数，如果是添加书签操作，自动触发对话框
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const action = urlParams.get('action')

    if (action === 'add-bookmark') {
      const title = urlParams.get('title') || ''
      const url = urlParams.get('url') || ''
      const favIconUrl = urlParams.get('favIconUrl') || ''

      logger.info('Popup', '通过 URL 参数触发添加书签', { title, url })

      // 延迟确保组件已挂载
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
 * 提供安全的 PopupStore 访问对象，保证模板引用时有兜底数据
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
 * 侧边栏本地状态
 * 由于 Chrome 无直接查询接口，这里记录最近一次操作状态
 */
const isSidePanelOpen = ref<boolean>(false)

/**
 * 刷新侧边栏状态
 * 从 chrome.storage.session 读取真实状态
 */
async function refreshSidePanelState(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome?.storage?.session) {
      isSidePanelOpen.value = false
      return
    }

    // 从 session storage 读取 sidepanel 状态
    const result = await chrome.storage.session.get('sidePanelOpen')
    isSidePanelOpen.value = result.sidePanelOpen === true

    logger.debug('Popup', '侧边栏状态已刷新:', isSidePanelOpen.value)
  } catch (error) {
    logger.warn('Popup', '刷新侧边栏状态失败', error)
    isSidePanelOpen.value = false
  }
}

// 📊 统计信息计算属性
const stats = computed(
  () =>
    safePopupStore.value.stats || {
      bookmarks: 0,
      todayAdded: 0,
      weeklyVisited: 0
    }
)

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
 * 打开侧边栏
 * 注意：此函数只负责打开 side-panel，不再处理关闭逻辑
 * side-panel 有自己的关闭按钮
 */
async function openSidePanel(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (currentTab?.windowId) {
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

        // 持久化状态到 session storage
        await chrome.storage.session.set({ sidePanelOpen: true })

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

        // 同步状态到当前页面内的组件（通过 mitt 事件总线）
        try {
          const { emitEvent } = await import(
            '@/infrastructure/events/event-bus'
          )
          emitEvent('sidepanel:state-changed', { isOpen: true })
        } catch {}

        logger.info('Popup', '侧边栏已打开')

        // 自动关闭 popup 窗口，避免遮挡 side-panel
        try {
          window.close()
          logger.info('Popup', 'Popup 窗口已自动关闭')
        } catch (error) {
          logger.warn('Popup', '关闭 popup 窗口失败', error)
        }
      } else {
        throw new Error('无法获取当前窗口信息')
      }
    } else {
      throw new Error('chrome.sidePanel API 不可用')
    }
  } catch (error) {
    logger.error('Popup', '❌ 打开侧边栏失败', error)
  }
}

/**
 * 打开手动整理页面
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
      logger.error('Component', 'Popup', '❌ 打开整理页面失败', response?.error)
      fallback()
    }
    // 保持 popup 开启，方便用户在整理页面和 popup 间切换
  })
}

/**
 * 打开设置页面
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

// 从统计卡片跳转到整理页并带上搜索参数
async function openManagementWithFilter(key: string): Promise<void> {
  logger.info('Popup', 'openManagementWithFilter 被调用:', key)
  try {
    // 将展示层的指标映射到整理页可识别的搜索键
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
      case 'internal':
        tags.push('internal')
        break
      default:
        break
    }

    if (tags.length === 0) {
      openManualOrganizePage()
      return
    }

    // 1. 先将筛选状态保存到 session storage
    await chrome.storage.session.set({
      managementInitialFilter: {
        tags,
        timestamp: Date.now()
      }
    })

    logger.info('Popup', '筛选状态已保存到 session storage:', tags)

    // 2. 打开 Management 页面（干净的 URL）
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('management.html')
      : '/management.html'

    chrome.tabs.create({ url }).catch(err => {
      logger.warn('Popup', 'chrome.tabs.create 失败，使用 window.open:', err)
      window.open(url, '_blank')
    })
  } catch (err) {
    logger.error('Popup', 'openManagementWithFilter 错误:', err)
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

    // 点击图标永远显示 popup，不需要状态查询
    logger.info('Popup', 'Popup 启动，点击图标永远显示 popup 页面')

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
      // 非阻塞地触发所有初始化和数据加载
      popupStore.value.initialize()
      logger.info('Popup', 'PopupStore 初始化已触发')

      // 加载书签统计数据
      loadBookmarkStats()
      // 加载健康度概览
      if (popupStore.value && popupStore.value.loadBookmarkHealthOverview) {
        popupStore.value.loadBookmarkHealthOverview().then(() => {
          // 初始化本地扫描进度
          localScanProgress.value = healthOverview.value.totalScanned
          logger.info(
            'Popup',
            `初始化扫描进度: ${localScanProgress.value}/${stats.value.bookmarks}`
          )
        })
      }

      // 智能扫描策略：避免重复扫描
      // - 后台定时任务每 5 分钟自动扫描一次
      // - Popup 仅在从未扫描过时主动触发一次（首次使用体验）
      // - 其他情况只显示结果，由后台定时任务负责
      setTimeout(() => {
        const totalBookmarks = stats.value.bookmarks
        const scanned = localScanProgress.value

        logger.info(
          'Popup',
          `当前健康数据：已扫描 ${scanned}/${totalBookmarks}`
        )

        // 仅在从未扫描过时（totalScanned === 0）主动触发一次
        if (scanned === 0 && totalBookmarks > 0) {
          logger.info('Popup', '首次使用，启动首次健康扫描...')

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
                        `扫描进度: ${progress.current}/${progress.total} (${progress.percentage.toFixed(1)}%)`
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
                        `首次健康扫描完成 (${localScanProgress.value}/${stats.value.bookmarks})`
                      )
                      logger.info(
                        'Popup',
                        '后续扫描将由后台定时任务自动执行（每 5 分钟）'
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
            `健康扫描进行中或未完成 (${scanned}/${totalBookmarks})`
          )
          logger.info('Popup', '后台定时任务将自动完成扫描（每 5 分钟）')
        } else {
          logger.info(
            'Popup',
            `健康扫描已完成 (${scanned}/${totalBookmarks})`
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
  display: none;
  width: 0;
  height: 0;
}
</style>

<style scoped>
html,
body {
  width: 420px;
}

/* stylelint-disable-next-line selector-max-specificity */
#app {
  width: 420px;
  min-width: 420px;
  max-width: 420px;
  margin: 0;
  padding: 0;
}

.popup-container {
  width: 420px;
  min-height: 450px;
  max-height: 550px;
  border-radius: var(--radius-lg);
  background: var(--color-background);
  overflow: hidden auto;
  scrollbar-width: none; /* Firefox 隐藏滚动条，保留滚动能力 */
}

:deep(.popup-container::-webkit-scrollbar) {
  display: none; /* WebKit 浏览器隐藏滚动条 */
  width: 0;
  height: 0;
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto 1fr;
  padding: var(--spacing-sm) 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-background);
}

.top-left {
  display: flex;
  align-items: center;
}

.top-center {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
}

.top-right {
  display: flex;
  justify-content: end;
  align-items: center;
  gap: var(--spacing-sm);
}

.sidepanel-toggle {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-base);
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
  font-size: var(--text-3xl);
}

.promo-logo {
  display: inline-block;
  width: auto;
  height: 20px;
  user-select: none;
  object-fit: contain;
}

.promo-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 20px;
  color: var(--color-primary);
}

.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md);
  height: 200px;
  text-align: center;
}

.loading-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 主容器 */
.main-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

/* 区块标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

/* 📊 书签概览 */
.overview-section {
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-subtle);
}

.overview-grid {
  display: grid;
  gap: var(--spacing-sm);
  grid-template-columns: repeat(3, 1fr);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: all var(--transition-fast);
}

.stat-card:hover {
  border-color: var(--color-border);
  background: var(--color-surface-hover);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  line-height: 1;
}

.stat-value--primary {
  color: var(--color-primary);
}

.stat-value--secondary {
  color: var(--color-text-secondary);
}

/* ⚠️ 需要关注 */
.issues-section {
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-subtle);
}

.issues-grid {
  display: grid;
  gap: var(--spacing-sm);
  grid-template-columns: repeat(2, 1fr);
}

.issue-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.issue-card--warning {
  border-color: var(--color-warning-alpha-30);
  background: var(--color-warning-alpha-5);
}

.issue-card--warning:hover {
  border-color: var(--color-warning);
  background: var(--color-warning-alpha-10);
  box-shadow: 0 2px 8px var(--color-warning-alpha-20);
}

.issue-card--warning:active {
  box-shadow: 0 1px 4px var(--color-warning-alpha-20);
}

.issue-card--danger {
  border-color: var(--color-error-alpha-30);
  background: var(--color-error-alpha-5);
}

.issue-card--danger:hover {
  border-color: var(--color-error);
  background: var(--color-error-alpha-10);
  box-shadow: 0 2px 8px var(--color-error-alpha-20);
}

.issue-card--danger:active {
  box-shadow: 0 1px 4px var(--color-error-alpha-20);
}

.issue-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.issue-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.issue-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: 1;
  text-align: center;
}

.issue-card--warning .issue-value {
  color: var(--color-warning);
}

.issue-card--danger .issue-value {
  color: var(--color-error);
}

/* ⚡ 快速操作 */
.actions-section {
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-subtle);
}

.actions-grid {
  display: grid;
  gap: var(--spacing-sm);
  grid-template-columns: repeat(2, 1fr);
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-md) var(--spacing-sm);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  background: var(--color-surface);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-alpha-5);
  box-shadow: 0 2px 8px var(--color-primary-alpha-20);
}

.action-button:active {
  opacity: 0.8;
}

.action-button span {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

/* 💡 健康扫描状态 */
.scan-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.scan-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-xs);
}

.scan-text {
  flex: 1;
  color: var(--color-text-secondary);
}

.scan-badge {
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.scan-badge--success {
  color: var(--color-success);
  background: var(--color-success-alpha-10);
}

.scan-badge--muted {
  color: var(--color-text-tertiary);
  background: var(--color-border-subtle);
}


</style>
