<template>
  <hr :class="dividerClasses" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DividerProps } from './Divider.d'

const props = withDefaults(defineProps<DividerProps>(), {
  orientation: 'horizontal',
  variant: 'solid',
  spacing: 'md',
  color: 'default',
  inset: false,
  length: 'auto'
})

const dividerClasses = computed(() => [
  'acuity-divider',
  `acuity-divider--${props.orientation}`,
  `acuity-divider--${props.variant}`,
  `acuity-divider--${props.spacing}`,
  `acuity-divider--${props.color}`
])
</script>

<style scoped>
.acuity-divider {
  border: none;
  background: none;
}

/* Horizontal */
.acuity-divider--horizontal {
  width: 100%;
  height: 1px;
  border-top: 1px solid var(--color-border);
}

.acuity-divider--horizontal.acuity-divider--sm {
  margin: var(--spacing-sm) 0;
}

.acuity-divider--horizontal.acuity-divider--md {
  margin: var(--spacing-md) 0;
}

.acuity-divider--horizontal.acuity-divider--lg {
  margin: var(--spacing-lg) 0;
}

/* Vertical */
.acuity-divider--vertical {
  display: inline-block;
  width: 1px;
  height: 100%;
  border-left: 1px solid var(--color-border);
  vertical-align: middle;
}

.acuity-divider--vertical.acuity-divider--sm {
  margin: 0 var(--spacing-sm);
}

.acuity-divider--vertical.acuity-divider--md {
  margin: 0 var(--spacing-md);
}

.acuity-divider--vertical.acuity-divider--lg {
  margin: 0 var(--spacing-lg);
}

/* Variants - 高特异性覆盖默认 border-style */
.acuity-divider.acuity-divider--dashed {
  border-style: dashed;
}

.acuity-divider.acuity-divider--dotted {
  border-style: dotted;
}

/* Colors */
.acuity-divider--default {
  border-color: var(--color-border);
}

.acuity-divider--muted {
  border-color: var(--color-border-muted);
}

.acuity-divider--subtle {
  border-color: var(--color-border-subtle);
}
</style>
