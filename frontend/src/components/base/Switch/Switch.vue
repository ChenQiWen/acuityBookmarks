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
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary);
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
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 12px;
}

.acuity-switch .track {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: var(--sw-track-h);
  width: var(--sw-track-w);
  border-radius: 999px;
  background: var(--color-border);
  border: 1px solid color-mix(in srgb, var(--color-outline) 10%, transparent);
  transition:
    background var(--transition-base, 0.2s ease),
    border-color var(--transition-base, 0.2s ease);
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-xs);
  box-sizing: border-box;
}

.acuity-switch .knob {
  position: absolute;
  height: var(--sw-knob);
  width: var(--sw-knob);
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transform: translate(2px, -50%);
  top: 50%;
  transition:
    transform var(--transition-fast, 0.2s ease),
    background-color var(--transition-fast, 0.2s ease),
    box-shadow var(--transition-fast, 0.2s ease);
  will-change: transform;
}

.acuity-switch--on .track {
  background: var(--color-primary);
  border-color: transparent;
}

.acuity-switch--on .knob {
  transform: translate(calc(var(--sw-track-w) - var(--sw-knob) - 2px), -50%);
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
.acuity-switch .track {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}
.acuity-switch .knob {
  left: 0;
}
.acuity-switch--on .knob {
  left: 0;
}
</style>
