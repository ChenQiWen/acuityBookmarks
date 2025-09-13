<template>
  <hr :class="dividerClasses" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  variant?: 'solid' | 'dashed' | 'dotted'
  spacing?: 'sm' | 'md' | 'lg'
  color?: 'default' | 'muted' | 'subtle'
}

const props = withDefaults(defineProps<DividerProps>(), {
  orientation: 'horizontal',
  variant: 'solid',
  spacing: 'md',
  color: 'default'
});

const dividerClasses = computed(() => [
  'acuity-divider',
  `acuity-divider--${props.orientation}`,
  `acuity-divider--${props.variant}`,
  `acuity-divider--${props.spacing}`,
  `acuity-divider--${props.color}`
]);
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
  width: 1px;
  height: 100%;
  border-left: 1px solid var(--color-border);
  display: inline-block;
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

/* Variants */
.acuity-divider--dashed {
  border-style: dashed !important;
}

.acuity-divider--dotted {
  border-style: dotted !important;
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
