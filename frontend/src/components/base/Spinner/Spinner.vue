<template>
  <div :class="spinnerClasses">
    <div class="acuity-spinner-circle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpinnerProps } from './Spinner.d'

const props = withDefaults(defineProps<SpinnerProps>(), {
  size: 'md',
  color: 'primary',
  indeterminate: true
})

const spinnerClasses = computed(() => [
  'acuity-spinner',
  `acuity-spinner--${props.size}`,
  `acuity-spinner--${props.color}`,
  {
    'acuity-spinner--indeterminate': props.indeterminate
  }
])
</script>

<style scoped>
.acuity-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.acuity-spinner-circle {
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: currentColor;
  animation: spin 1s linear infinite;
}

/* Sizes */
.acuity-spinner--sm .acuity-spinner-circle {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.acuity-spinner--md .acuity-spinner-circle {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

.acuity-spinner--lg .acuity-spinner-circle {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.acuity-spinner--xl .acuity-spinner-circle {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

/* Colors */
.acuity-spinner--primary {
  color: var(--color-primary);
}

.acuity-spinner--secondary {
  color: var(--color-secondary);
}

.acuity-spinner--success {
  color: var(--color-success);
}

.acuity-spinner--warning {
  color: var(--color-warning);
}

.acuity-spinner--error {
  color: var(--color-error);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
