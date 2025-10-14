<template>
  <div
    class="panel-search-inline"
    :class="open ? 'is-open' : 'is-closed'"
    :style="{ '--inline-search-width': `${minWidth}px` }"
  >
    <Input
      ref="inputRef"
      v-model="innerValue"
      :placeholder="placeholder"
      :density="density"
      :variant="variant"
      :readonly="!open"
      @keydown.enter="onEnter"
      @keydown.esc="onEsc"
      @blur="onBlur"
    >
      <template #prepend>
        <Icon
          class="search-prepend"
          name="mdi-magnify"
          :size="16"
          :title="buttonTitle"
          role="button"
          tabindex="0"
          :aria-expanded="open ? 'true' : 'false'"
          @click.stop="toggleOpen"
          @keydown.stop="onPrefixKeydown"
        />
      </template>
    </Input>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Icon, Input } from '@/components'

interface Props {
  modelValue: string
  open: boolean
  placeholder?: string
  density?: 'comfortable' | 'compact' | 'default'
  variant?: 'outlined' | 'filled' | 'underlined'
  minWidth?: number
  buttonTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  open: false,
  placeholder: '筛选此面板...',
  density: 'compact',
  variant: 'underlined',
  minWidth: 140,
  buttonTitle: '搜索当前面板'
})

const emit = defineEmits<{
  'update:modelValue': [val: string]
  'update:open': [val: boolean]
  enter: []
  esc: []
  blur: [e: FocusEvent]
}>()

const inputRef = ref<{ $el?: HTMLElement } | null>(null)
const innerValue = ref(props.modelValue)
const open = ref<boolean>(props.open)

watch(
  () => props.modelValue,
  (v: string) => {
    if (v !== innerValue.value) innerValue.value = v
  }
)
watch(innerValue, (v: string) => emit('update:modelValue', v))
watch(
  () => props.open,
  (v: boolean) => {
    if (v !== open.value) open.value = v
  }
)
watch(open, async (v: boolean) => {
  emit('update:open', v)
  if (v) {
    await nextTick()
    try {
      const root = inputRef.value?.$el as HTMLElement | undefined
      const input = root?.querySelector('input') as HTMLInputElement | null
      input?.focus()
      input?.select?.()
    } catch {}
  }
})

function toggleOpen() {
  open.value = !open.value
}
function onPrefixKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleOpen()
  }
}
function onEnter() {
  emit('enter')
}
function onEsc() {
  emit('esc')
}
function onBlur(e: FocusEvent) {
  emit('blur', e)
}
</script>

<style scoped>
.search-inline-group {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
}
.panel-search-inline {
  position: relative;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  z-index: 3;
  /* 容器本身不做宽度动画，动画作用在内部 input 元素上 */
}

/* 通过穿透修改内部 input 宽度与伸缩行为，保证图标始终可见、文本区宽度从 0 → 目标宽度 */
.panel-search-inline :deep(.acuity-input) {
  transition: width var(--md-sys-motion-duration-medium2)
    var(--md-sys-motion-easing-standard);
  width: 0; /* 基线为 0，避免首次切换“跳变” */
}
.panel-search-inline.is-open :deep(.acuity-input) {
  width: var(--inline-search-width);
  pointer-events: auto;
}
.panel-search-inline.is-closed :deep(.acuity-input) {
  width: 0;
  pointer-events: none;
}
.panel-search-inline.is-closed :deep(.acuity-input-clear),
.panel-search-inline.is-closed :deep(.acuity-input-loading),
.panel-search-inline.is-closed :deep(.acuity-input-append) {
  display: none;
}
.search-prepend {
  cursor: pointer;
  color: var(--color-text-secondary);
}
.search-prepend:hover {
  color: var(--color-primary-hover);
}
</style>
