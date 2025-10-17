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

const progressClasses = computed(() => [
  'acuity-progress-bar-fill',
  `acuity-progress-bar-fill--${props.color}`,
  {
    'acuity-progress-bar-fill--indeterminate': props.indeterminate
  }
])

const progressStyle = computed(() => {
  if (props.indeterminate) {
    return {}
  }

  const sourceValue = props.value ?? props.modelValue ?? 0
  const clamped = Math.max(props.min, Math.min(props.max, sourceValue))
  const percentage =
    ((clamped - props.min) / (props.max - props.min || 1)) * 100
  return {
    width: `${percentage}%`
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
