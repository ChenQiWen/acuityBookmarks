<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <LucideIcon name="settings" />
      <span>{{ t('settings_shortcut_title') }}</span>
    </h3>

    <div class="shortcuts-container">
      <!-- 快捷键列表 -->
      <div v-if="shortcutItems.length > 0" class="shortcuts-list">
        <div class="shortcuts-grid">
          <div
            v-for="item in shortcutItems"
            :key="item.command"
            class="shortcut-item"
          >
            <div class="shortcut-label">{{ item.label }}</div>
            <div class="shortcut-keys">
              <kbd v-if="item.keys" class="shortcut-kbd">{{ item.keys }}</kbd>
              <span v-else class="shortcut-empty">{{ t('settings_shortcut_not_set') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 未配置提示 -->
      <div v-else class="shortcuts-empty">
        <LucideIcon name="info" :size="24" />
        <p>{{ t('settings_shortcut_empty') }}</p>
      </div>

      <!-- 操作按钮 -->
      <div class="shortcuts-actions">
        <Button
          color="primary"
          variant="primary"
          size="md"
          @click="openChromeShortcutSettings"
        >
          <template #prepend>
            <LucideIcon name="settings" />
          </template>
          {{ t('settings_shortcut_open_chrome') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { Button, LucideIcon } from '@/components'
import { useCommandsShortcuts } from '@/composables/useCommandsShortcuts'
import { useUIStore } from '@/stores/ui-store'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'ShortcutSettings'
})

const uiStore = useUIStore()

/**
 * 全局命令快捷键工具集
 */
const { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh } =
  useCommandsShortcuts()

/**
 * 快捷键标签映射
 */
const labelMap: Record<string, string> = {
  _execute_action: t('settings_shortcut_label_execute_action'),
  'open-management': t('settings_shortcut_label_open_management'),
  'open-settings': t('settings_shortcut_label_open_settings'),
  'quick-add-bookmark': t('settings_shortcut_label_quick_add_bookmark')
}

/**
 * 格式化快捷键列表
 */
const shortcutItems = computed(() => {
  const items: Array<{ command: string; label: string; keys: string }> = []

  Object.keys(labelMap).forEach(cmd => {
    const keys = shortcuts.value[cmd]
    items.push({
      command: cmd,
      label: labelMap[cmd],
      keys: keys && keys.trim() ? keys : ''
    })
  })

  return items
})

/**
 * 打开 Chrome 快捷键设置页面
 */
function openChromeShortcutSettings(): void {
  try {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  } catch {
    uiStore.showInfo(
      t('settings_shortcut_chrome_url_hint')
    )
  }
}

onMounted(() => {
  loadShortcuts()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
}

.shortcuts-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.shortcut-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.shortcut-kbd {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-1) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  background: var(--color-background);
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

.shortcut-empty {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.shortcuts-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-6);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
}

.shortcuts-empty p {
  margin: 0;
  font-size: var(--text-sm);
}

.shortcuts-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: var(--spacing-2);
}
</style>
