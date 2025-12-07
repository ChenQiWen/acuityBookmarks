<template>
  <component
    :is="computedTag"
    :class="listClasses"
    :style="listStyle"
    @click="handleClick"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ListProps, ListEmits } from './List.d'

const props = withDefaults(defineProps<ListProps>(), {
  items: () => [],
  bordered: false,
  loading: false,
  emptyText: '暂无数据',
  selectable: false
})

const emit = defineEmits<ListEmits>()

const computedTag = computed(() => {
  if (props.is === 'list') return props.tag === 'div' ? 'div' : props.tag
  if (props.is === 'item') return 'div'
  if (props.is === 'group') return 'div'
  return 'div'
})

const listClasses = computed(() => [
  'acuity-list',
  `acuity-list--${props.is}`,
  `acuity-list--${props.variant}`,
  {
    'acuity-list--dense': props.dense,
    'acuity-list--disabled': props.disabled,
    'acuity-list--active': props.active,
    'acuity-list--expanded': props.expanded,
    'acuity-list--clickable': props.clickable || props.is === 'item'
  }
])

const listStyle = computed(() => ({}))

const handleClick = (event: MouseEvent) => {
  if (props.disabled) return

  emit('click', event)

  if (props.is === 'group') {
    emit('toggle', !props.expanded)
  }
}
</script>

<style scoped>
.acuity-list {
  position: relative;
}

/* List container */
.acuity-list--list {
  width: 100%;
}

.acuity-list--list.acuity-list--dense {
  padding: 0;
}

/* List item */
.acuity-list--item {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: default;
  transition: all var(--transition-base);
}

.acuity-list--item.acuity-list--dense {
  min-height: 40px;
  padding: var(--spacing-xs) var(--spacing-md);
}

.acuity-list--item.acuity-list--clickable {
  cursor: pointer;
}

/* 键盘焦点指示器 */
.acuity-list--item.acuity-list--clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.acuity-list--item.acuity-list--clickable:hover:not(.acuity-list--disabled) {
  background: var(--color-surface-hover);
}

/* 按下反馈 */
.acuity-list--item.acuity-list--clickable:active:not(.acuity-list--disabled) {
  background: var(--color-surface-pressed);
  opacity: 0.9;
}

.acuity-list--item.acuity-list--active {
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
}

.acuity-list--item.acuity-list--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* List group */
.acuity-list--group {
  width: 100%;
}

/* Variants */
.acuity-list--nav .acuity-list--item {
  margin: var(--spacing-xs) 0;
  border-radius: var(--radius-md);
}

.acuity-list--plain .acuity-list--item {
  padding: var(--spacing-sm) 0;
  background: transparent;
}

.acuity-list--plain .acuity-list--item:hover {
  color: var(--color-primary);
  background: transparent;
}
</style>
