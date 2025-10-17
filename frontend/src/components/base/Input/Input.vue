<template>
  <div class="acuity-input-wrapper">
    <label v-if="label" :for="inputId" class="acuity-input-label">
      {{ label }}
    </label>
    <div class="acuity-input-container" :class="inputContainerClasses">
      <div v-if="$slots.prepend" class="acuity-input-prepend">
        <slot name="prepend"></slot>
      </div>
      <input
        :id="inputId"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :class="inputClasses"
        class="acuity-input"
        v-bind="$attrs"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <div v-if="loading" class="acuity-input-loading">
        <div class="acuity-spinner-small"></div>
      </div>
      <div
        v-if="clearable && modelValue"
        class="acuity-input-clear"
        @click="clearInput"
      >
        <Icon name="mdi-close" :size="16" />
      </div>
      <div v-if="$slots.append" class="acuity-input-append">
        <slot name="append"></slot>
      </div>
    </div>
    <div
      v-if="hint || errorMessage"
      class="acuity-input-hint"
      :class="{ error: !!errorMessage }"
    >
      {{ errorMessage || hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@/components'
import type { InputProps, InputEmits } from './Input.d'

const props = withDefaults(defineProps<InputProps>(), {
  label: '',
  variant: 'outlined',
  density: 'default',
  autocomplete: 'off',
  placeholder: '',
  disabled: false,
  readonly: false,
  clearable: false,
  maxlength: undefined,
  hint: '',
  error: false,
  errorMessage: ''
})

declare const __ACUITY_INPUT_INTERNAL__: unique symbol

const emit = defineEmits<InputEmits>()

const isFocused = ref(false)
const inputId = `acuity-input-${Math.random().toString(36).substr(2, 9)}`

const inputContainerClasses = computed(() => [
  `acuity-input-container--${props.variant}`,
  `acuity-input-container--${props.size}`,
  `acuity-input-container--${props.density}`,
  {
    'acuity-input-container--focused': isFocused.value,
    'acuity-input-container--disabled': props.disabled,
    'acuity-input-container--error': props.error || props.errorMessage,
    'acuity-input-container--loading': props.loading
  }
])

const inputClasses = computed(() => [
  `acuity-input--${props.size}`,
  {
    'acuity-input--disabled': props.disabled,
    'acuity-input--readonly': props.readonly
  }
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emit('input', target.value)
}

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

const handleKeydown = (event: KeyboardEvent) => {
  emit('keydown', event)
}

const clearInput = () => {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.acuity-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.acuity-input-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.acuity-input-container {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  background: var(--color-surface);
}

/* Variant styles */
.acuity-input-container--outlined {
  border: 1px solid var(--color-border);
}
.acuity-input-container--outlined:hover {
  border-color: var(--color-border-hover);
}
.acuity-input-container--outlined.acuity-input-container--focused {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-alpha-10);
}
.acuity-input-container--filled {
  background: var(--color-surface-variant);
  border: 1px solid transparent;
  border-bottom: 2px solid var(--color-border);
}
.acuity-input-container--filled.acuity-input-container--focused {
  border-bottom-color: var(--color-primary);
}

/* Size styles */
.acuity-input-container--sm {
  min-height: 32px;
}
.acuity-input-container--md {
  min-height: 40px;
}
.acuity-input-container--lg {
  min-height: 48px;
}

/* Density styles */
.acuity-input-container--comfortable {
  padding-top: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
}
.acuity-input-container--compact {
  padding-top: var(--spacing-xs);
  padding-bottom: var(--spacing-xs);
}

/* State styles */
.acuity-input-container--error {
  border-color: var(--color-error) !important;
}
.acuity-input-container--disabled {
  background: var(--color-surface-disabled);
  border-color: var(--color-border-disabled);
  cursor: not-allowed;
}

.acuity-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--text-base);
  color: var(--color-text-primary);
  padding: 0;
}
.acuity-input::placeholder {
  color: var(--color-text-tertiary);
}
.acuity-input--disabled {
  cursor: not-allowed;
  color: var(--color-text-disabled);
}

.acuity-input-prepend,
.acuity-input-append {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
}
.acuity-input-prepend {
  margin-right: var(--spacing-1-5);
}
.acuity-input-append {
  margin-left: var(--spacing-sm);
}

.acuity-input-loading {
  margin-left: var(--spacing-sm);
}
.acuity-input-clear {
  margin-left: var(--spacing-sm);
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: color var(--transition-base);
}
.acuity-input-clear:hover {
  color: var(--color-text-secondary);
}

.acuity-input-hint {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}
.acuity-input-hint.error {
  color: var(--color-error);
}

.acuity-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
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
