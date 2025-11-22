<template>
  <span :class="computedClass">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger'
    size?: 'sm' | 'md'
    className?: string
  }>(),
  {
    variant: 'default',
    size: 'sm',
    className: ''
  }
)

const computedClass = computed(() => {
  const classes = [
    'badge',
    `badge-${props.variant}`,
    `badge-${props.size}`,
    props.className
  ]
  return classes.filter(Boolean).join(' ')
})
</script>

<style scoped>
/* 基础徽章样式 */
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--md-sys-shape-corner-full);
  font-weight: 500;
  transition: colors 0.2s ease;
}

/* 尺寸 */
.badge-sm {
  padding: 2px 10px;
  font-size: 12px;
}

.badge-md {
  padding: 4px 12px;
  font-size: 14px;
}

/* 变体 */
.badge-default {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  color: var(--md-sys-color-primary);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.badge-outline {
  background-color: transparent;
  border: 1px solid var(--color-border-default);
  color: var(--color-text-secondary);
}

.badge-success {
  background-color: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.badge-warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.badge-danger {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
</style>
