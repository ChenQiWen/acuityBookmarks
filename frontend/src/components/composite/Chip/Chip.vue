<template>
  <div :class="chipClasses" @click="handleClick">
    <div v-if="$slots.prepend" class="acuity-chip-prepend">
      <slot name="prepend" />
    </div>

    <div class="acuity-chip-content">
      <slot>{{ text }}</slot>
    </div>

    <div v-if="$slots.append || closable" class="acuity-chip-append">
      <slot name="append" />
      <Button
        v-if="closable"
        variant="ghost"
        size="sm"
        icon
        class="acuity-chip-close"
        @click.stop="handleClose"
      >
        <LucideIcon name="x" :size="16" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, LucideIcon } from '@/components'
import type { ChipProps, ChipEmits } from './Chip.d'

const props = withDefaults(defineProps<ChipProps>(), {
  variant: 'outlined',
  color: 'default',
  size: 'md',
  closable: false,
  clickable: false,
  disabled: false
})

const emit = defineEmits<ChipEmits>()

const chipClasses = computed(() => [
  'acuity-chip',
  `acuity-chip--${props.variant}`,
  `acuity-chip--${props.color}`,
  `acuity-chip--${props.size}`,
  {
    'acuity-chip--clickable': props.clickable && !props.disabled,
    'acuity-chip--disabled': props.disabled
  }
])

const handleClick = (event: MouseEvent) => {
  if (props.disabled) return
  if (props.clickable) {
    emit('click', event)
  }
}

const handleClose = (event: Event) => {
  emit('close', event as MouseEvent)
}
</script>

<style scoped>
.acuity-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
  white-space: nowrap;
  vertical-align: middle;
  transition: all var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

/* Sizes */
.acuity-chip--sm {
  min-height: 20px;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--text-xs);
}

.acuity-chip--md {
  min-height: 24px;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--text-sm);
}

.acuity-chip--lg {
  min-height: 32px;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-base);
}

/* Filled variant */
.acuity-chip--filled.acuity-chip--primary {
  color: var(--color-primary-foreground);
  background: var(--color-primary);
}

.acuity-chip--filled.acuity-chip--secondary {
  color: var(--color-secondary-foreground);
  background: var(--color-secondary);
}

.acuity-chip--filled.acuity-chip--success {
  color: var(--color-success-foreground);
  background: var(--color-success);
}

.acuity-chip--filled.acuity-chip--warning {
  color: var(--color-warning-foreground);
  background: var(--color-warning);
}

.acuity-chip--filled.acuity-chip--error {
  color: var(--color-error-foreground);
  background: var(--color-error);
}

.acuity-chip--filled.acuity-chip--info {
  color: var(--color-info-foreground);
  background: var(--color-info);
}

.acuity-chip--filled.acuity-chip--default {
  color: var(--color-text-primary);
  background: var(--color-surface-variant);
}

/* Outlined variant */
.acuity-chip--outlined {
  border: 1px solid currentColor;
  background: transparent;
}

.acuity-chip--outlined.acuity-chip--primary {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.acuity-chip--outlined.acuity-chip--secondary {
  border-color: var(--color-secondary);
  color: var(--color-secondary);
}

.acuity-chip--outlined.acuity-chip--success {
  border-color: var(--color-success);
  color: var(--color-success);
}

.acuity-chip--outlined.acuity-chip--warning {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.acuity-chip--outlined.acuity-chip--error {
  border-color: var(--color-error);
  color: var(--color-error);
}

.acuity-chip--outlined.acuity-chip--info {
  border-color: var(--color-info);
  color: var(--color-info);
}

.acuity-chip--outlined.acuity-chip--default {
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

/* Soft variant */
.acuity-chip--soft.acuity-chip--primary {
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
}

.acuity-chip--soft.acuity-chip--secondary {
  color: var(--color-secondary);
  background: var(--color-secondary-alpha-10);
}

.acuity-chip--soft.acuity-chip--success {
  color: var(--color-success);
  background: var(--color-success-alpha-10);
}

.acuity-chip--soft.acuity-chip--warning {
  color: var(--color-warning);
  background: var(--color-warning-alpha-10);
}

.acuity-chip--soft.acuity-chip--error {
  color: var(--color-error);
  background: var(--color-error-alpha-10);
}

.acuity-chip--soft.acuity-chip--info {
  color: var(--color-info);
  background: var(--color-info-alpha-10);
}

.acuity-chip--soft.acuity-chip--default {
  color: var(--color-text-secondary);
  background: var(--color-surface-variant);
}

/* States */
.acuity-chip--clickable {
  cursor: pointer;
}

.acuity-chip--clickable:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%), 0 1px 4px rgb(0 0 0 / 8%);
  opacity: 0.9;
}

.acuity-chip--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.acuity-chip-prepend,
.acuity-chip-append {
  display: flex;
  align-items: center;
}

.acuity-chip-content {
  flex: 1;
  min-width: 0;
}

.acuity-chip-close {
  margin-left: var(--spacing-xs);
}
</style>
