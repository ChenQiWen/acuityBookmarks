<template>
  <span :class="indicatorClasses">
    <slot>
      <AnimatedNumber v-if="isNumber" :value="numericCount" :duration="duration" />
      <template v-else>{{ count }}</template>
    </slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AnimatedNumber from '../AnimatedNumber/AnimatedNumber.vue'

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
  /** 动画时长（毫秒），默认 600ms */
  duration?: number
  /** 是否禁用动画 */
  disableAnimation?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default',
  duration: 600,
  disableAnimation: false
})

const indicatorClasses = computed(() => [
  'count-indicator',
  `count-indicator--${props.size}`,
  `count-indicator--${props.variant}`
])

// 判断 count 是否为数字类型
const isNumber = computed(() => {
  if (props.disableAnimation) return false
  return typeof props.count === 'number'
})

// 获取数字值
const numericCount = computed(() => {
  return typeof props.count === 'number' ? props.count : 0
})
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
