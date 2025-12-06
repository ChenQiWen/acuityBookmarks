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
    <span class="track">
      <span class="knob" />
    </span>
    <span v-if="label" class="label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SwitchProps, SwitchEmits } from './Switch.d'

const props = withDefaults(defineProps<SwitchProps>(), {
  modelValue: false,
  disabled: false,
  label: '',
  size: 'md',
  inline: false,
  color: 'primary'
})

const emit = defineEmits<SwitchEmits>()

const classes = computed(() => [
  'acuity-switch',
  `acuity-switch--${props.size}`,
  `acuity-switch--color-${props.color}`,
  {
    'acuity-switch--on': !!props.modelValue,
    'acuity-switch--disabled': !!props.disabled,
    'acuity-switch--inline': props.inline
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

  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--sw-track-h);
  padding-left: calc(var(--sw-track-w) + var(--spacing-sm));
  border: none;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
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
  border-radius: var(--radius-lg);
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.acuity-switch--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.acuity-switch .track {
  position: absolute;
  top: 50%;
  left: 0;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: var(--sw-track-w);
  height: var(--sw-track-h);
  padding: 0 var(--spacing-xs);
  border: 1px solid color-mix(in srgb, var(--color-outline) 10%, transparent);
  border-radius: var(--radius-full);
  background: var(--color-border);
  transform: translateY(-50%);
  transition:
    background var(--transition-base, 0.2s ease),
    border-color var(--transition-base, 0.2s ease);
}

.acuity-switch .knob {
  position: absolute;
  top: 50%;
  left: 0;
  width: var(--sw-knob);
  height: var(--sw-knob);
  border-radius: 50%;
  background: var(--color-surface);
  transform: translate(2px, -50%);
  transition:
    transform var(--transition-fast, 0.2s ease),
    background-color var(--transition-fast, 0.2s ease),
    box-shadow var(--transition-fast, 0.2s ease);
  box-shadow: var(--shadow-sm);
  will-change: transform;
}

.acuity-switch--on .track {
  border-color: transparent;
  background: var(--color-primary);
}

.acuity-switch--on .knob {
  left: 0;
  transform: translate(calc(var(--sw-track-w) - var(--sw-knob) - 2px), -50%);
}

.label {
  font-size: 0.92rem;
  color: var(--color-text-secondary);
}
</style>
