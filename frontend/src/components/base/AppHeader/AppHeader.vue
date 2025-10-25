<template>
  <header class="app-header" aria-label="AcuityBookmarks">
    <div class="app-header__col app-header__col--left">
      <Button
        v-if="showSidePanelToggle"
        class="app-header__action"
        variant="ghost"
        size="sm"
        borderless
        :title="sidePanelTooltip"
        :aria-label="sidePanelTooltip"
        @click="handleToggleSidePanel"
      >
        <Icon :name="sidePanelIcon" :size="20" />
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
        @click="emit('open-settings')"
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
import { ref, computed, onMounted, onUnmounted, toRefs } from 'vue'

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

const emit = defineEmits<{
  'open-settings': []
}>()

const { showSidePanelToggle, showLogo, showTheme, showSettings } = toRefs(props)

const isSidePanelOpen = ref(false)

const sidePanelIcon = computed(() =>
  isSidePanelOpen.value ? 'icon-sidePanel-expand' : 'icon-sidePanel-collapse'
)

const sidePanelTooltip = computed(() =>
  isSidePanelOpen.value ? '收起侧边栏' : '展开侧边栏'
)

const refreshSidePanelState = async () => {
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
    await chrome.sidePanel.getOptions({ tabId: currentTab.id }, options => {
      if (chrome?.runtime?.lastError) {
        isSidePanelOpen.value = false
        return
      }
      isSidePanelOpen.value = !!options?.enabled
    })
  } catch {
    isSidePanelOpen.value = false
  }
}

const handleToggleSidePanel = async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const currentTab = tabs[0]
    if (!currentTab?.id) return

    const wantOpen = !isSidePanelOpen.value

    await chrome.sidePanel.setOptions({
      tabId: currentTab.id,
      enabled: true,
      path: 'side-panel.html'
    })
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    await chrome.sidePanel.setOptions({
      tabId: currentTab.id,
      enabled: wantOpen
    })

    isSidePanelOpen.value = wantOpen
    chrome.runtime.sendMessage({
      type: 'acuity-sidepanel-state-changed',
      isOpen: wantOpen
    })
  } catch (error) {
    console.warn('[AppHeader] toggle side panel failed', error)
  }
}

const handleExternalStateMessage = (message: unknown) => {
  const payload = message as { type?: string; isOpen?: boolean }
  if (payload?.type === 'acuity-sidepanel-state-changed') {
    isSidePanelOpen.value = !!payload.isOpen
  }
}

onMounted(async () => {
  await refreshSidePanelState()
  chrome.runtime.onMessage.addListener(handleExternalStateMessage)
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleExternalStateMessage)
})
</script>

<style scoped>
.app-header {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: center;
  padding: 0 var(--spacing-lg);
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-subtle);
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
