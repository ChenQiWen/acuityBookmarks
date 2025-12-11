<template>
  <header :class="headerClasses" aria-label="AcuityBookmarks">
    <div
      v-if="showSidePanelToggle"
      class="app-header__col app-header__col--left"
    >
      <Button
        class="app-header__action"
        variant="ghost"
        size="sm"
        borderless
        title="切换侧边栏"
        :aria-label="sidePanelTooltip"
        @click="handleToggleSidePanel"
      >
        <Icon name="icon-side-navigation" :size="20" />
      </Button>
    </div>

    <div class="app-header__col app-header__col--center">
      <img
        v-if="showLogo"
        :src="logoSrc"
        alt="AcuityBookmarks Logo"
        class="app-header__logo"
      />
      <span class="app-header__name">AcuityBookmarks</span>
    </div>

    <div class="app-header__col app-header__col--right">
      <ThemeToggle v-if="showTheme" />
      <Button
        v-if="showAccount"
        class="app-header__action"
        variant="ghost"
        size="sm"
        borderless
        :title="isLoggedIn ? '账号管理' : '登录 / 注册'"
        :aria-label="isLoggedIn ? '账号管理' : '登录 / 注册'"
        @click="handleAccountClick"
      >
        <Icon :name="isLoggedIn ? 'icon-account' : 'icon-login'" :size="18" />
      </Button>
      <Button
        v-if="showSettings"
        class="app-header__action"
        variant="ghost"
        size="sm"
        borderless
        title="打开设置"
        aria-label="打开设置"
        @click="handleOpenSettings"
      >
        <Icon name="icon-setting" :size="18" />
      </Button>
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import Icon from '@/components/base/Icon/Icon.vue'
import Button from '@/components/base/Button/Button.vue'
import ThemeToggle from '@/components/base/ThemeToggle/ThemeToggle.vue'
import { ref, computed, toRefs, onMounted, onUnmounted } from 'vue'
import { AB_EVENTS } from '@/constants/events'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { useSupabaseAuth } from '@/composables'
import { globalStateManager } from '@/infrastructure/global-state/global-state-manager'

const props = withDefaults(
  defineProps<{
    showSidePanelToggle?: boolean
    showLogo?: boolean
    showTheme?: boolean
    showSettings?: boolean
    showAccount?: boolean
  }>(),
  {
    showSidePanelToggle: true,
    showLogo: true,
    showTheme: true,
    showSettings: true,
    showAccount: true
  }
)

const { showSidePanelToggle, showLogo, showTheme, showSettings, showAccount } =
  toRefs(props)

// 使用 Supabase Auth 检查登录状态
const { isAuthenticated, initialize } = useSupabaseAuth()
const isLoggedIn = computed(() => isAuthenticated.value)

// 当前主题
const currentTheme = ref<'light' | 'dark'>('light')

// 根据主题动态切换 logo
const logoSrc = computed(() => {
  return currentTheme.value === 'dark' ? '/logo-dark.png' : '/logo.png'
})

/**
 * 检查登录状态 - 使用 Supabase Auth（响应式，自动更新）
 */
const checkAuthStatus = async () => {
  // 确保 Supabase Auth 已初始化
  await initialize()
  console.log('[AppHeader] 登录状态检查完成:', {
    isLoggedIn: isLoggedIn.value,
    isAuthenticated: isAuthenticated.value
  })
}

/**
 * 处理账号图标点击
 */
const handleAccountClick = async () => {
  try {
    // 先刷新登录状态
    await checkAuthStatus()

    if (isLoggedIn.value) {
      // 已登录：跳转到设置页面的账户标签
      const settingsUrl = chrome?.runtime?.getURL
        ? chrome.runtime.getURL('settings.html?tab=account')
        : '/settings.html?tab=account'

      if (chrome?.tabs?.create) {
        await chrome.tabs.create({ url: settingsUrl })
      } else {
        window.open(settingsUrl, '_blank')
      }
    } else {
      // 未登录：跳转到登录页面
      const authUrl = chrome?.runtime?.getURL
        ? chrome.runtime.getURL('auth.html')
        : '/auth.html'

      if (chrome?.tabs?.create) {
        await chrome.tabs.create({ url: authUrl })
      } else {
        window.open(authUrl, '_blank')
      }
    }
  } catch (error) {
    logger.error('AppHeader', '打开账号页面失败', error)
  }
}

/**
 * 头部样式类，根据是否展示左侧面板按钮动态调整列布局。
 */
const headerClasses = computed(() => [
  'app-header',
  {
    'app-header--no-left': !showSidePanelToggle.value
  }
])

// 固定提示文案
const sidePanelTooltip = '切换侧边栏'

// 内部状态，仅用于判断打开还是关闭（不对外暴露）
const isSidePanelOpen = ref(false)

/**
 * 切换侧边栏
 */
const handleToggleSidePanel = async () => {
  try {
    if (!chrome?.sidePanel) {
      logger.warn('AppHeader', '浏览器不支持侧边栏功能')
      return
    }

    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (!currentTab?.id || !currentTab?.windowId) {
      logger.error('AppHeader', '无法获取当前标签页信息')
      return
    }

    const wantOpen = !isSidePanelOpen.value

    if (wantOpen) {
      // 打开侧边栏
      await chrome.sidePanel.setOptions({
        tabId: currentTab.id,
        path: 'side-panel.html',
        enabled: true
      })

      if (chrome.sidePanel.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({
          openPanelOnActionClick: false
        })
      }

      await chrome.sidePanel.open({ windowId: currentTab.windowId })
      isSidePanelOpen.value = true
      logger.info('AppHeader', '✅ 侧边栏已打开')
    } else {
      // 关闭侧边栏
      await chrome.sidePanel.setOptions({
        tabId: currentTab.id,
        enabled: false
      })
      isSidePanelOpen.value = false
      logger.info('AppHeader', '✅ 侧边栏已关闭')
    }

    // 广播状态变更（用于同一页面内的其他组件）
    try {
      chrome.runtime.sendMessage(
        {
          type: AB_EVENTS.SIDE_PANEL_STATE_CHANGED,
          isOpen: isSidePanelOpen.value
        },
        () => {
          if (chrome?.runtime?.lastError) {
            logger.debug('AppHeader', '广播状态失败（可忽略）')
          }
        }
      )
    } catch {}
  } catch (error) {
    logger.error('AppHeader', '❌ 切换侧边栏失败', error)
  }
}

/**
 * 打开设置页面
 * 智能行为：
 * - 如果 settings 页面已打开，则切换到该标签页
 * - 如果未打开，则打开新标签页
 *
 * 通过 background script 处理，确保有足够的权限访问所有标签页
 */
const handleOpenSettings = async () => {
  try {
    // 通过消息机制调用 background script 的智能打开功能
    if (chrome?.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'OPEN_SETTINGS_PAGE'
      })
    } else {
      // 降级方案：直接打开新标签页
      const settingsUrl = chrome?.runtime?.getURL
        ? chrome.runtime.getURL('settings.html')
        : '/settings.html'
      window.open(settingsUrl, '_blank')
    }
  } catch (error) {
    // 降级方案：直接打开新标签页
    console.warn('[AppHeader] Failed to open settings via background:', error)
    const fallbackUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('settings.html')
      : '/settings.html'
    window.open(fallbackUrl, '_blank')
  }
}

// 初始化主题
const initTheme = async () => {
  try {
    await globalStateManager.initialize()
    currentTheme.value = globalStateManager.getTheme()
  } catch (error) {
    logger.error('AppHeader', '初始化主题失败', error)
  }
}

// 组件挂载时检查登录状态和主题
onMounted(() => {
  checkAuthStatus()
  initTheme()

  // 监听登录/退出事件，实时更新状态
  const unsubscribeLogin = onEvent('auth:logged-in', () => {
    checkAuthStatus()
  })

  const unsubscribeLogout = onEvent('auth:logged-out', () => {
    checkAuthStatus()
  })

  // 监听主题切换事件
  const unsubscribeTheme = onEvent('theme:changed', (data: { theme: 'light' | 'dark' }) => {
    currentTheme.value = data.theme
  })

  // 监听页面可见性变化（当从其他页面返回时刷新状态）
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      checkAuthStatus()
      initTheme()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 清理函数
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    unsubscribeLogin()
    unsubscribeLogout()
    unsubscribeTheme()
  })
})

// 简化设计：不再需要跨页面状态同步
// 图标永远显示"切换"，内部状态仅用于判断打开/关闭操作
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  align-items: center;
  grid-template-columns: repeat(3, 1fr);
  height: 56px;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app-header--no-left {
  grid-template-columns: 1fr 1fr;
}

.app-header--no-left .app-header__col--center {
  justify-content: flex-start;
}

.app-header__col {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
}

.app-header__col--left {
  justify-content: flex-start;
}

.app-header__col--right {
  justify-content: flex-end;
  gap: var(--spacing-xs);
}

.app-header__logo {
  width: 28px;
  height: 28px;
}

.app-header__name {
  margin-left: var(--spacing-xs);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  white-space: nowrap;
  color: var(--color-text-primary);
}

.app-header__action {
  color: var(--color-text-secondary);
}
</style>
