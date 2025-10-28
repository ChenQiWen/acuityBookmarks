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
        src="/logo.png"
        alt="AcuityBookmarks Logo"
        class="app-header__logo"
      />
      <span class="app-header__name">AcuityBookmarks</span>
    </div>

    <div class="app-header__col app-header__col--right">
      <ThemeToggle v-if="showTheme" />
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
import { ref, computed, toRefs } from 'vue'
import { AB_EVENTS } from '@/constants/events'
import { logger } from '@/infrastructure/logging/logger'

const props = withDefaults(
  defineProps<{
    showSidePanelToggle?: boolean
    showLogo?: boolean
    showTheme?: boolean
    showSettings?: boolean
  }>(),
  {
    showSidePanelToggle: true,
    showLogo: true,
    showTheme: true,
    showSettings: true
  }
)

const { showSidePanelToggle, showLogo, showTheme, showSettings } = toRefs(props)

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

// 简化设计：不再需要跨页面状态同步
// 图标永远显示"切换"，内部状态仅用于判断打开/关闭操作
</script>

<style scoped>
.app-header {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: center;
  padding: 0 var(--spacing-lg);
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-header--no-left {
  grid-template-columns: 1fr 1fr;
}

.app-header--no-left .app-header__col--center {
  justify-content: flex-start;
}

.app-header__col {
  display: flex;
  align-items: center;
  justify-content: center;
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
  border-radius: 8px;
}

.app-header__name {
  margin-left: var(--spacing-xs);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.app-header__action {
  color: var(--color-text-secondary);
}
</style>
