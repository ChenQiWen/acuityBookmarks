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

export interface ListProps {
  is?: 'list' | 'item' | 'group'
  dense?: boolean
  variant?: 'default' | 'nav' | 'plain'
  disabled?: boolean
  active?: boolean
  expanded?: boolean
  clickable?: boolean
  tag?: string
}

const props = withDefaults(defineProps<ListProps>(), {
  is: 'list',
  dense: false,
  variant: 'default',
  disabled: false,
  active: false,
  expanded: false,
  clickable: false,
  tag: 'div'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
  toggle: [expanded: boolean]
}>()

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
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: var(--spacing-sm) var(--spacing-md);
  transition: all var(--transition-base);
  cursor: default;
  position: relative;
  border-radius: var(--radius-sm);
}

.acuity-list--item.acuity-list--dense {
  min-height: 40px;
  padding: var(--spacing-xs) var(--spacing-md);
}

.acuity-list--item.acuity-list--clickable {
  cursor: pointer;
}

.acuity-list--item.acuity-list--clickable:hover:not(.acuity-list--disabled) {
  background: var(--color-surface-hover);
}

.acuity-list--item.acuity-list--active {
  background: var(--color-primary-alpha-10);
  color: var(--color-primary);
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
  border-radius: var(--radius-md);
  margin: var(--spacing-xs) 0;
}

.acuity-list--plain .acuity-list--item {
  padding: var(--spacing-sm) 0;
  background: transparent;
}

.acuity-list--plain .acuity-list--item:hover {
  background: transparent;
  color: var(--color-primary);
}
</style>