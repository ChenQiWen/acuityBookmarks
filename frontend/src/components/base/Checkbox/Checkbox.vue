<template>
  <label
    :class="wrapperClasses"
    :aria-checked="ariaChecked"
    @click.stop.prevent="handleLabelClick"
  >
    <input
      ref="inputRef"
      type="checkbox"
      class="checkbox-input"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
      @keydown.space.prevent="toggle"
    />

    <!-- 图标复选框 -->
    <span class="checkbox-icon-variant" aria-hidden="true">
      <Icon :name="iconName" :size="iconSize" :color="iconColor" />
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

// 图标变体的图标名称（圆形风格）
const iconName = computed(() => {
  if (props.indeterminate) return 'icon-circle-minus' // 半选中
  return props.modelValue ? 'icon-success' : 'icon-circle-outline' // 选中 / 未选中
})

// 图标变体的图标大小
const iconSize = computed(() => {
  const sizeMap = { sm: 16, md: 20, lg: 24 }
  return sizeMap[props.size] || 20
})

// 图标变体的图标颜色
const iconColor = computed(() => {
  if (props.disabled) return 'disabled'
  return props.modelValue || props.indeterminate ? 'primary' : 'secondary'
})

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

const handleLabelClick = () => {
  if (props.disabled) return
  // 手动切换状态
  toggle()
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
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.checkbox-label {
  font-size: var(--text-base);
  color: var(--color-text-primary);
}

/* 图标复选框样式 */
.checkbox-icon-variant {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-1);
  border-radius: 50%; /* 圆形背景 */
  transition: background var(--transition-fast);
}

.cbx:not(.cbx--disabled):hover .checkbox-icon-variant {
  background: var(--color-surface-variant);
}

.cbx:not(.cbx--disabled):active .checkbox-icon-variant {
  background: var(--color-surface-active);
}
</style>
