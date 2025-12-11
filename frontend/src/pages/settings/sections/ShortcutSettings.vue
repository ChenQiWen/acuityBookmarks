<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-keyboard" />
      <span>快捷键设置</span>
    </h3>

    <div class="shortcuts-container">
      <!-- 说明文字 -->
      <div class="shortcuts-description">
        <p>
          全局快捷键可以在任何页面使用。点击下方按钮打开 Chrome
          扩展快捷键设置页面进行配置。
        </p>
      </div>

      <!-- 快捷键列表 -->
      <div v-if="shortcutItems.length > 0" class="shortcuts-list">
        <h4 class="shortcuts-list-title">当前配置的快捷键</h4>
        <div class="shortcuts-grid">
          <div
            v-for="item in shortcutItems"
            :key="item.command"
            class="shortcut-item"
          >
            <div class="shortcut-label">{{ item.label }}</div>
            <div class="shortcut-keys">
              <kbd v-if="item.keys" class="shortcut-kbd">{{ item.keys }}</kbd>
              <span v-else class="shortcut-empty">未设置</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 未配置提示 -->
      <div v-else class="shortcuts-empty">
        <Icon name="icon-info" :size="24" />
        <p>暂无配置的快捷键</p>
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
            <Icon name="icon-setting" />
          </template>
          打开 Chrome 快捷键设置
        </Button>
      </div>

      <!-- 提示信息 -->
      <Card class="info-card" elevation="none" borderless>
        <div class="info-content">
          <div class="info-header">
            <Icon name="icon-info" />
            <strong>快捷键说明</strong>
          </div>
          <ul>
            <li>
              <strong>激活扩展/切换弹出页</strong>：快速打开或关闭扩展弹出窗口
            </li>
            <li><strong>整理页面</strong>：直接打开书签整理页面</li>
            <li><strong>打开设置</strong>：快速访问设置页面</li>
          </ul>
          <p class="info-note">
            注意：快捷键需要在 Chrome 扩展设置中配置，配置后会自动在此处显示。
          </p>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { Button, Card, Icon } from '@/components'
import { useCommandsShortcuts } from '@/composables/useCommandsShortcuts'
import { useUIStore } from '@/stores/ui-store'

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
  _execute_action: '激活扩展/切换弹出页',
  'open-management': '整理页面',
  'open-settings': '打开设置'
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
      '请在地址栏输入 chrome://extensions/shortcuts 进行快捷键设置'
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

.shortcuts-description {
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
}

.shortcuts-description p {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.shortcuts-list-title {
  margin: 0 0 var(--spacing-3) 0;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
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
  transition: all var(--transition-fast);
}

.shortcut-item:hover {
  border-color: var(--color-border);
  background: var(--color-surface-hover);
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

.info-card {
  border: 1px solid var(--color-primary-alpha-20);
  background-color: var(--color-primary-alpha-5);
}

.info-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
  font-size: var(--text-sm);
}

.info-content {
  font-size: var(--text-sm);
  line-height: 1.6;
}

.info-content ul {
  margin: 0 0 var(--spacing-3);
  padding-left: var(--spacing-5);
}

.info-content li {
  margin-bottom: var(--spacing-2);
}

.info-note {
  margin: 0;
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--color-text-tertiary);
}
</style>
