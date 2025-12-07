<template>
  <span :class="indicatorClasses">
    <slot>{{ count }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'CountIndicator'
})

interface Props {
  /** 显示的数量 */
  count?: number | string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 变体样式 */
  variant?: 'default' | 'primary' | 'muted'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default'
})

const indicatorClasses = computed(() => [
  'count-indicator',
  `count-indicator--${props.size}`,
  `count-indicator--${props.variant}`
])
</script>

<style scoped>
.count-indicator {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  font-weight: 500;
  text-align: center;
}

/* Sizes - min-width = height，单位数时为圆形 */
.count-indicator--sm {
  min-width: 18px;
  height: 18px;
  padding: 0 var(--spacing-1);
  border-radius: var(--radius-full);
  font-size: var(--text-2xs);
}

.count-indicator--md {
  min-width: 22px;
  height: 22px;
  padding: 0 var(--spacing-1-5);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

.count-indicator--lg {
  min-width: 26px;
  height: 26px;
  padding: 0 var(--spacing-2);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
}

/* Variants */
.count-indicator--default {
  color: var(--color-text-tertiary);
  background: var(--color-surface-variant);
}

.count-indicator--primary {
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
}

.count-indicator--muted {
  color: var(--color-text-quaternary);
  background: var(--color-surface-subtle);
}
</style>
