<template>
  <span :class="badgeClasses">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface BadgeProps {
  variant?: 'filled' | 'outlined' | 'soft'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<BadgeProps>(), {
  variant: 'filled',
  color: 'primary',
  size: 'md'
})

const badgeClasses = computed(() => [
  'acuity-badge',
  `acuity-badge--${props.variant}`,
  `acuity-badge--${props.color}`,
  `acuity-badge--${props.size}`
])
</script>

<style scoped>
.acuity-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  white-space: nowrap;
  vertical-align: baseline;
}

/* Sizes */
.acuity-badge--sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--text-xs);
  min-height: 20px;
}

.acuity-badge--md {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--text-sm);
  min-height: 24px;
}

.acuity-badge--lg {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-base);
  min-height: 32px;
}

/* Filled variant */
.acuity-badge--filled.acuity-badge--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.acuity-badge--filled.acuity-badge--secondary {
  background: var(--color-secondary);
  color: var(--color-secondary-foreground);
}

.acuity-badge--filled.acuity-badge--success {
  background: var(--color-success);
  color: var(--color-success-foreground);
}

.acuity-badge--filled.acuity-badge--warning {
  background: var(--color-warning);
  color: var(--color-warning-foreground);
}

.acuity-badge--filled.acuity-badge--error {
  background: var(--color-error);
  color: var(--color-error-foreground);
}

.acuity-badge--filled.acuity-badge--info {
  background: var(--color-info);
  color: var(--color-info-foreground);
}

/* Outlined variant */
.acuity-badge--outlined {
  background: transparent;
  border: 1px solid currentColor;
}

.acuity-badge--outlined.acuity-badge--primary {
  color: var(--color-primary);
}

.acuity-badge--outlined.acuity-badge--secondary {
  color: var(--color-secondary);
}

.acuity-badge--outlined.acuity-badge--success {
  color: var(--color-success);
}

.acuity-badge--outlined.acuity-badge--warning {
  color: var(--color-warning);
}

.acuity-badge--outlined.acuity-badge--error {
  color: var(--color-error);
}

.acuity-badge--outlined.acuity-badge--info {
  color: var(--color-info);
}

/* Soft variant */
.acuity-badge--soft.acuity-badge--primary {
  background: var(--color-primary-alpha-10);
  color: var(--color-primary);
}

.acuity-badge--soft.acuity-badge--secondary {
  background: var(--color-secondary-alpha-10);
  color: var(--color-secondary);
}

.acuity-badge--soft.acuity-badge--success {
  background: var(--color-success-alpha-10);
  color: var(--color-success);
}

.acuity-badge--soft.acuity-badge--warning {
  background: var(--color-warning-alpha-10);
  color: var(--color-warning);
}

.acuity-badge--soft.acuity-badge--error {
  background: var(--color-error-alpha-10);
  color: var(--color-error);
}

.acuity-badge--soft.acuity-badge--info {
  background: var(--color-info-alpha-10);
  color: var(--color-info);
}
</style>
