<template>
  <Dialog
    :show="show"
    :title="title"
    :persistent="false"
    @update:show="emit('update:show', $event)"
  >
    <div class="keyboard-shortcuts-help">
      <div v-if="shortcuts.length === 0" class="empty-state">
        <Icon name="icon-keyboard" :size="48" color="muted" />
        <p>暂无可用快捷键</p>
      </div>

      <div v-else class="shortcuts-list">
        <div
          v-for="(group, groupName) in groupedShortcuts"
          :key="groupName"
          class="shortcuts-group"
        >
          <h3 v-if="groupName !== 'default'" class="group-title">
            {{ groupName }}
          </h3>

          <div class="shortcuts-items">
            <div
              v-for="(shortcut, index) in group"
              :key="index"
              class="shortcut-item"
            >
              <div class="shortcut-keys">
                <kbd
                  v-for="(key, i) in parseShortcut(shortcut.shortcut)"
                  :key="i"
                  class="key"
                >
                  {{ key }}
                </kbd>
              </div>
              <div class="shortcut-description">
                {{ shortcut.description || '无描述' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="shortcuts-footer">
        <Button variant="ghost" @click="emit('update:show', false)">
          <Icon name="icon-cancel" :size="16" />
          关闭
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, defineOptions } from 'vue'
import Dialog from '../Dialog/Dialog.vue'
import Button from '../Button/Button.vue'
import Icon from '../Icon/Icon.vue'

defineOptions({
  name: 'KeyboardShortcutsHelp'
})

/**
 * 快捷键信息
 */
export interface ShortcutInfo {
  /** 快捷键字符串（如 'Ctrl + S'） */
  shortcut: string
  /** 描述 */
  description?: string
  /** 分组名称 */
  group?: string
}

interface Props {
  /** 是否显示 */
  show: boolean
  /** 标题 */
  title?: string
  /** 快捷键列表 */
  shortcuts: ShortcutInfo[]
}

const props = withDefaults(defineProps<Props>(), {
  title: '⌨️ 键盘快捷键',
  shortcuts: () => []
})

interface Emits {
  (e: 'update:show', value: boolean): void
}

const emit = defineEmits<Emits>()

/**
 * 解析快捷键字符串为按键数组
 */
function parseShortcut(shortcut: string): string[] {
  return shortcut
    .split('+')
    .map(key => key.trim())
    .map(key => {
      // 规范化按键名称
      const keyMap: Record<string, string> = {
        ctrl: '⌃ Ctrl',
        cmd: '⌘ Cmd',
        meta: '⌘',
        alt: '⌥ Alt',
        shift: '⇧ Shift',
        enter: '↵ Enter',
        escape: 'Esc',
        delete: '⌫ Del',
        backspace: '⌫',
        tab: '⇥ Tab',
        space: '␣ Space',
        arrowup: '↑',
        arrowdown: '↓',
        arrowleft: '←',
        arrowright: '→',
        home: '⇱ Home',
        end: '⇲ End'
      }

      return keyMap[key.toLowerCase()] || key.toUpperCase()
    })
}

/**
 * 按分组整理快捷键
 */
const groupedShortcuts = computed(() => {
  const groups: Record<string, ShortcutInfo[]> = {}

  props.shortcuts.forEach(shortcut => {
    const groupName = shortcut.group || 'default'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(shortcut)
  })

  return groups
})
</script>

<style scoped>
/* 深色模式优化 */
@media (prefers-color-scheme: dark) {
  .key {
    background: var(--color-surface);
    box-shadow:
      0 1px 0 0 rgb(255 255 255 / 10%),
      0 0 0 1px var(--color-surface);
  }
}

.keyboard-shortcuts-help {
  min-height: 300px;
  max-height: 70vh;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-12) var(--spacing-6);
  color: var(--color-text-tertiary);
}

.shortcuts-list {
  padding: var(--spacing-2) 0;
}

.shortcuts-group {
  margin-bottom: var(--spacing-8);
}

.shortcuts-group:last-child {
  margin-bottom: 0;
}

.group-title {
  margin: 0 0 var(--spacing-3);
  padding: 0 var(--spacing-4);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.shortcuts-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-6);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.shortcut-item:hover {
  background-color: var(--color-surface-container);
}

.shortcut-keys {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--spacing-1);
}

.key {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: var(--spacing-8);
  height: var(--spacing-7);
  padding: 0 var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-family-monospace);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-surface-container);
  box-shadow:
    0 1px 0 0 var(--color-border),
    0 0 0 1px var(--color-surface-container);
}

.shortcut-description {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.shortcuts-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
  margin-top: var(--spacing-4);
  padding: var(--spacing-4) var(--spacing-4) var(--spacing-2);
  border-top: 1px solid var(--color-border);
}
</style>
