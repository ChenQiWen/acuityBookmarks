<template>
  <button
    :class="classes"
    role="switch"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : 'false'"
    :disabled="disabled"
    type="button"
    @click="onToggle"
    @keydown.space.prevent.stop="onToggle"
    @keydown.enter.prevent.stop="onToggle"
  >
    <span class="knob" />
    <span v-if="label" class="label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface SwitchProps {
  modelValue?: boolean
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<SwitchProps>(), {
  modelValue: false,
  disabled: false,
  label: '',
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

const classes = computed(() => [
  'acuity-switch',
  `acuity-switch--${props.size}`,
  {
    'acuity-switch--on': !!props.modelValue,
    'acuity-switch--disabled': !!props.disabled
  }
])

function onToggle() {
  if (props.disabled) return
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<style scoped>
.acuity-switch {
  --sw-track-h: 20px;
  --sw-track-w: 36px;
  --sw-knob: 16px;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary, #111827);
}

.acuity-switch--sm {
  --sw-track-h: 18px;
  --sw-track-w: 32px;
  --sw-knob: 14px;
}
.acuity-switch--md {
  --sw-track-h: 20px;
  --sw-track-w: 36px;
  --sw-knob: 16px;
}

.acuity-switch:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
  border-radius: 12px;
}

.acuity-switch::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: var(--sw-track-h);
  width: var(--sw-track-w);
  border-radius: 999px;
  background: var(--color-border, #e5e7eb);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition:
    background var(--transition-base, 0.2s ease),
    border-color var(--transition-base, 0.2s ease);
}

.acuity-switch .knob {
  position: absolute;
  height: var(--sw-knob);
  width: var(--sw-knob);
  border-radius: 50%;
  background: var(--color-surface, #ffffff);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.15));
  transition: transform var(--transition-base);
}

.acuity-switch--on::before {
  background: var(--color-primary, #1a73e8);
  border-color: transparent;
}

.acuity-switch--on .knob {
  transform: translateX(calc(var(--sw-track-w) - var(--sw-knob)));
}

.acuity-switch--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.label {
  color: var(--color-text-secondary);
  font-size: 0.92rem;
}

/* 保持按钮尺寸：使用相对定位在轨道上放置圆点 */
.acuity-switch {
  position: relative;
  padding-left: calc(var(--sw-track-w) + var(--spacing-sm));
  min-height: var(--sw-track-h);
}
.acuity-switch .knob {
  left: 2px;
  top: 50%;
  transform: translate(0, -50%);
}
.acuity-switch--on .knob {
  transform: translate(calc(var(--sw-track-w) - var(--sw-knob) - 2px), -50%);
}
</style>
