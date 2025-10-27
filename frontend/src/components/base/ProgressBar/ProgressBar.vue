<template>
  <div class="acuity-progress-bar">
    <div
      class="acuity-progress-bar-track"
      :style="{ height: `${barHeight}px` }"
    >
      <div :class="progressClasses" :style="progressStyle"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProgressBarProps } from './ProgressBar.d'

const props = withDefaults(defineProps<ProgressBarProps>(), {
  min: 0,
  max: 100,
  showLabel: false,
  striped: false,
  animated: false,
  height: 6,
  color: 'primary'
})

const barHeight = computed(() => props.height ?? 6)

/**
 * 计算当前进度百分比
 */
const progressPercentage = computed(() => {
  if (props.indeterminate) {
    return 0
  }

  const sourceValue = props.value ?? props.modelValue ?? 0
  const clamped = Math.max(props.min, Math.min(props.max, sourceValue))
  const percentage =
    ((clamped - props.min) / (props.max - props.min || 1)) * 100
  return percentage
})

/**
 * 进度条是否已完成（100%）
 */
const isCompleted = computed(() => progressPercentage.value >= 100)

const progressClasses = computed(() => [
  'acuity-progress-bar-fill',
  `acuity-progress-bar-fill--${props.color}`,
  {
    'acuity-progress-bar-fill--indeterminate': props.indeterminate,
    'acuity-progress-bar-fill--striped': props.striped,
    // ✨ 进度到达 100% 时，不再显示流光动画
    'acuity-progress-bar-fill--animated': props.animated && !isCompleted.value
  }
])

const progressStyle = computed(() => {
  if (props.indeterminate) {
    return {}
  }

  return {
    width: `${progressPercentage.value}%`
  }
})
</script>

<style scoped>
.acuity-progress-bar {
  width: 100%;
}

.acuity-progress-bar-track {
  width: 100%;
  background: var(--color-surface-variant);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.acuity-progress-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}

/* Colors */
.acuity-progress-bar-fill--primary {
  background: var(--color-primary);
}

.acuity-progress-bar-fill--secondary {
  background: var(--color-secondary);
}

.acuity-progress-bar-fill--success {
  background: var(--color-success);
}

.acuity-progress-bar-fill--warning {
  background: var(--color-warning);
}

.acuity-progress-bar-fill--error {
  background: var(--color-error);
}

/* Striped pattern */
.acuity-progress-bar-fill--striped {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 20px 20px;
}

/* Animated stripes */
.acuity-progress-bar-fill--animated {
  position: relative;
  overflow: hidden;
}

.acuity-progress-bar-fill--animated::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s ease-in-out infinite;
}

.acuity-progress-bar-fill--striped.acuity-progress-bar-fill--animated {
  animation: stripes-move 1s linear infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

@keyframes stripes-move {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 20px 20px;
  }
}

/* Indeterminate animation */
.acuity-progress-bar-fill--indeterminate {
  width: 40% !important;
  animation: progress-indeterminate 2s ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(250%);
  }
  100% {
    transform: translateX(250%);
  }
}
</style>
