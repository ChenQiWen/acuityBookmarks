<template>
  <label :class="wrapperClasses" :aria-checked="ariaChecked" @click.stop>
    <input
      ref="inputRef"
      type="checkbox"
      class="checkbox-input"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
      @keydown.space.prevent="toggle"
    />
    <span class="checkbox-box" aria-hidden="true">
      <span v-if="modelValue && !indeterminate" class="checkbox-icon">
        <!-- 使用内置 Icon，避免外层尺寸跳动 -->
        <Icon name="icon-check-outline" :size="12" />
      </span>
      <span v-else-if="indeterminate" class="checkbox-icon">
        <Icon name="icon-check" :size="12" />
      </span>
    </span>
    <span v-if="$slots.default" class="checkbox-label">
      <slot />
    </span>
  </label>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@/components'

interface Props {
  modelValue: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  indeterminate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
  indeterminate: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const wrapperClasses = computed(() => [
  'cbx',
  `cbx--${props.size}`,
  { 'cbx--disabled': props.disabled }
])

const ariaChecked = computed(() =>
  props.indeterminate ? 'mixed' : props.modelValue ? 'true' : 'false'
)

// 同步 indeterminate 到原生 input 属性
watch(
  () => props.indeterminate,
  val => {
    if (inputRef.value) inputRef.value.indeterminate = !!val
  },
  { immediate: true }
)

const toggle = () => {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue)
}

const onChange = (e: Event) => {
  if (props.disabled) return
  const el = e.target as HTMLInputElement
  emit('update:modelValue', !!el.checked)
  emit('change', !!el.checked)
}
</script>

<style scoped>
.cbx {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1-5);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cbx--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.checkbox-input {
  /* 隐藏原生框但保留可访问性与键盘交互 */
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.checkbox-box {
  --size-sm: 14px;
  --size-md: 16px;
  --size-lg: 18px;
  width: var(--size-md);
  height: var(--size-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-sm);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: inset 0 0 0 0 rgba(0, 0, 0, 0);
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--md-sys-motion-duration-short2)
      var(--md-sys-motion-easing-standard);
}

.cbx--sm .checkbox-box {
  width: var(--size-sm);
  height: var(--size-sm);
}
.cbx--lg .checkbox-box {
  width: var(--size-lg);
  height: var(--size-lg);
}

/* 选中态视觉反馈（不引起布局跳动） */
.cbx :deep(.checkbox-icon) {
  color: var(--color-primary);
}

/* hover/active 态（仅容器，不改几何） */
.cbx:not(.cbx--disabled):hover .checkbox-box {
  border-color: var(--color-border-hover);
  background: var(--color-surface-hover);
}

.cbx:not(.cbx--disabled):active .checkbox-box {
  background: var(--color-surface-active);
}

/* 选中时的描边与内阴影 */
.cbx:not(.cbx--disabled) .checkbox-input:checked + .checkbox-box {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 2px
    color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.checkbox-label {
  font-size: var(--text-base);
  color: var(--color-text-primary);
}
</style>
