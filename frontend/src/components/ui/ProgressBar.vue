<template>
  <div class="acuity-progress-bar">
    <div
      class="acuity-progress-bar-track"
      :style="{ height: `${height}px` }"
    >
      <div
        :class="progressClasses"
        :style="progressStyle"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ProgressBarProps {
  modelValue?: number
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  height?: number
  indeterminate?: boolean
}

const props = withDefaults(defineProps<ProgressBarProps>(), {
  modelValue: 0,
  color: 'primary',
  height: 4,
  indeterminate: false
})

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
  
  const value = Math.max(0, Math.min(100, props.modelValue))
  return {
    width: `${value}%`
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