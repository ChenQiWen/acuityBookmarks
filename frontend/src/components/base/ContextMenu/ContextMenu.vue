<!--
  📋 上下文菜单组件
  
  功能：
  1. 显示右键菜单
  2. 自动计算位置（防止超出视口）
  3. 点击外部自动关闭
  4. 支持图标、快捷键提示、分隔线
  5. 支持禁用状态和颜色主题
  6. 键盘导航（上下箭头、Enter、ESC）
-->

<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="show"
        ref="menuRef"
        class="context-menu"
        :style="menuStyle"
        tabindex="-1"
        @keydown="handleKeyDown"
      >
        <div
          v-for="(item, index) in visibleItems"
          :key="item.id"
          :ref="el => setItemRef(el as HTMLElement, index)"
          class="context-menu-item"
          :class="{
            'context-menu-item--disabled': item.disabled,
            'context-menu-item--focused': focusedIndex === index,
            [`context-menu-item--${item.color}`]: item.color && item.color !== 'default'
          }"
          @click="handleItemClick(item)"
          @mouseenter="focusedIndex = index"
        >
          <LucideIcon
            v-if="item.icon"
            :name="item.icon"
            :size="16"
            class="item-icon"
          />
          <span class="item-label">{{ item.label }}</span>
          <span v-if="item.shortcut" class="item-shortcut">{{
            item.shortcut
          }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { LucideIcon } from '@/components/base/LucideIcon'
import type { MenuItemConfig } from '@/domain/bookmark/context-menu-config'

defineOptions({ name: 'ContextMenu' })

interface Props {
  /** 是否显示菜单 */
  show: boolean
  /** 菜单项配置 */
  items: MenuItemConfig[]
  /** 菜单显示的 X 坐标 */
  x: number
  /** 菜单显示的 Y 坐标 */
  y: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 菜单项被点击 */
  'item-click': [item: MenuItemConfig]
  /** 关闭菜单 */
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(0)
const itemRefs = ref<Array<HTMLElement | null>>([])

// 设置菜单项引用
const setItemRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    itemRefs.value[index] = el
  }
}

// 过滤出可见的菜单项
const visibleItems = computed(() => {
  return props.items.filter(item => item.visible !== false)
})

// 计算菜单位置（防止超出视口）
const menuStyle = computed(() => {
  const style: Record<string, string> = {}

  // 初始位置
  if (!menuRef.value) {
    style.left = `${props.x}px`
    style.top = `${props.y}px`
    return style
  }

  const menuRect = menuRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // 水平方向：优先右侧，超出则左侧
  if (props.x + menuRect.width > viewportWidth) {
    style.right = `${viewportWidth - props.x}px`
  } else {
    style.left = `${props.x}px`
  }

  // 垂直方向：优先下方，超出则上方
  if (props.y + menuRect.height > viewportHeight) {
    style.bottom = `${viewportHeight - props.y}px`
  } else {
    style.top = `${props.y}px`
  }

  return style
})

/**
 * 处理键盘导航
 */
const handleKeyDown = (event: KeyboardEvent) => {
  const items = visibleItems.value

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault()
      // 向下移动，跳过禁用项
      let nextIndex = focusedIndex.value + 1
      while (nextIndex < items.length && items[nextIndex].disabled) {
        nextIndex++
      }
      // 循环到第一项
      if (nextIndex >= items.length) {
        nextIndex = 0
        while (nextIndex < items.length && items[nextIndex].disabled) {
          nextIndex++
        }
      }
      if (nextIndex < items.length) {
        focusedIndex.value = nextIndex
      }
      break
    }

    case 'ArrowUp': {
      event.preventDefault()
      // 向上移动，跳过禁用项
      let prevIndex = focusedIndex.value - 1
      while (prevIndex >= 0 && items[prevIndex].disabled) {
        prevIndex--
      }
      // 循环到最后一项
      if (prevIndex < 0) {
        prevIndex = items.length - 1
        while (prevIndex >= 0 && items[prevIndex].disabled) {
          prevIndex--
        }
      }
      if (prevIndex >= 0) {
        focusedIndex.value = prevIndex
      }
      break
    }

    case 'ArrowLeft': {
      // 左箭头键：关闭菜单
      event.preventDefault()
      emit('close')
      break
    }

    case 'Enter':
    case ' ': {
      event.preventDefault()
      const item = items[focusedIndex.value]
      if (item && !item.disabled) {
        handleItemClick(item)
      }
      break
    }

    case 'Escape': {
      event.preventDefault()
      emit('close')
      break
    }
  }
}

/**
 * 处理菜单项点击
 */
const handleItemClick = (item: MenuItemConfig) => {
  if (item.disabled) return
  emit('item-click', item)
  emit('close')
}

/**
 * 处理点击外部关闭
 */
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

// 监听显示状态，添加/移除事件监听器
watch(
  () => props.show,
  async (newShow) => {
    if (newShow) {
      // 重置焦点到第一个可用项
      focusedIndex.value = 0
      const items = visibleItems.value
      while (focusedIndex.value < items.length && items[focusedIndex.value].disabled) {
        focusedIndex.value++
      }

      // 等待 DOM 更新后聚焦
      await nextTick()
      
      // 聚焦到菜单容器，启用键盘导航
      if (menuRef.value) {
        menuRef.value.focus()
      }

      // 添加点击外部关闭的监听器
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
    } else {
      document.removeEventListener('click', handleClickOutside)
      itemRefs.value = []
    }
  }
)

// 组件卸载时清理事件监听器
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  max-width: 280px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  background: var(--color-surface);
  user-select: none;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.context-menu-item:last-child {
  border-bottom: none;
}

.context-menu-item:hover,
.context-menu-item--focused {
  background: var(--color-surface-variant);
}

.context-menu-item--disabled {
  color: var(--color-text-disabled);
  opacity: 0.5;
  cursor: not-allowed;
}

.context-menu-item--disabled:hover,
.context-menu-item--disabled.context-menu-item--focused {
  background: transparent;
}

.item-icon {
  flex-shrink: 0;
}

.item-label {
  flex: 1;
}

.item-shortcut {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.context-menu-item--error {
  color: var(--color-error);
}

.context-menu-item--error:hover,
.context-menu-item--error.context-menu-item--focused {
  color: var(--color-on-error, var(--color-surface));
  background: var(--color-error);
}

.context-menu-item--error:hover .item-icon,
.context-menu-item--error.context-menu-item--focused .item-icon {
  color: var(--color-on-error, var(--color-surface));
}

.context-menu-item--warning {
  color: var(--color-warning);
}

.context-menu-item--warning:hover,
.context-menu-item--warning.context-menu-item--focused {
  background: var(--color-warning-subtle);
}

.context-menu-item--success {
  color: var(--color-success);
}

.context-menu-item--success:hover,
.context-menu-item--success.context-menu-item--focused {
  background: var(--color-success-subtle);
}

.context-menu-item--primary {
  color: var(--color-primary);
}

.context-menu-item--primary:hover,
.context-menu-item--primary.context-menu-item--focused {
  background: var(--color-primary-subtle);
}

/* 动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  transition:
    opacity var(--md-sys-motion-duration-short2)
      var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short2)
      var(--md-sys-motion-easing-standard);
}

.context-menu-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
</style>
