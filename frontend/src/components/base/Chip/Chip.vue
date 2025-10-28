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
        <Icon name="icon-cancel" :size="12" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Icon } from '@/components'
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
  transition: all var(--transition-base);
}

/* Sizes */
.acuity-chip--sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--text-xs);
  min-height: 20px;
}

.acuity-chip--md {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--text-sm);
  min-height: 24px;
}

.acuity-chip--lg {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-base);
  min-height: 32px;
}

/* Filled variant */
.acuity-chip--filled.acuity-chip--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.acuity-chip--filled.acuity-chip--secondary {
  background: var(--color-secondary);
  color: var(--color-secondary-foreground);
}

.acuity-chip--filled.acuity-chip--success {
  background: var(--color-success);
  color: var(--color-success-foreground);
}

.acuity-chip--filled.acuity-chip--warning {
  background: var(--color-warning);
  color: var(--color-warning-foreground);
}

.acuity-chip--filled.acuity-chip--error {
  background: var(--color-error);
  color: var(--color-error-foreground);
}

.acuity-chip--filled.acuity-chip--info {
  background: var(--color-info);
  color: var(--color-info-foreground);
}

.acuity-chip--filled.acuity-chip--default {
  background: var(--color-surface-variant);
  color: var(--color-text-primary);
}

/* Outlined variant */
.acuity-chip--outlined {
  background: transparent;
  border: 1px solid currentColor;
}

.acuity-chip--outlined.acuity-chip--primary {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.acuity-chip--outlined.acuity-chip--secondary {
  color: var(--color-secondary);
  border-color: var(--color-secondary);
}

.acuity-chip--outlined.acuity-chip--success {
  color: var(--color-success);
  border-color: var(--color-success);
}

.acuity-chip--outlined.acuity-chip--warning {
  color: var(--color-warning);
  border-color: var(--color-warning);
}

.acuity-chip--outlined.acuity-chip--error {
  color: var(--color-error);
  border-color: var(--color-error);
}

.acuity-chip--outlined.acuity-chip--info {
  color: var(--color-info);
  border-color: var(--color-info);
}

.acuity-chip--outlined.acuity-chip--default {
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}

/* Soft variant */
.acuity-chip--soft.acuity-chip--primary {
  background: var(--color-primary-alpha-10);
  color: var(--color-primary);
}

.acuity-chip--soft.acuity-chip--secondary {
  background: var(--color-secondary-alpha-10);
  color: var(--color-secondary);
}

.acuity-chip--soft.acuity-chip--success {
  background: var(--color-success-alpha-10);
  color: var(--color-success);
}

.acuity-chip--soft.acuity-chip--warning {
  background: var(--color-warning-alpha-10);
  color: var(--color-warning);
}

.acuity-chip--soft.acuity-chip--error {
  background: var(--color-error-alpha-10);
  color: var(--color-error);
}

.acuity-chip--soft.acuity-chip--info {
  background: var(--color-info-alpha-10);
  color: var(--color-info);
}

.acuity-chip--soft.acuity-chip--default {
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

/* States */
.acuity-chip--clickable {
  cursor: pointer;
}

.acuity-chip--clickable:hover {
  /* 无几何位移，阴影/亮度反馈 */
  box-shadow: var(--shadow-md);
  opacity: 0.98;
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
