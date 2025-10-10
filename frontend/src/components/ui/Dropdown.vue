<template>
  <div ref="dropdownRef" class="acuity-dropdown">
    <div class="acuity-dropdown-trigger" @click="toggle">
      <slot name="trigger" :show="show" :toggle="toggle" />
    </div>

    <Transition name="dropdown">
      <div
        v-if="show"
        :class="dropdownContentClasses"
        @click="handleContentClick"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

export interface DropdownProps {
  modelValue?: boolean
  placement?:
    | 'bottom'
    | 'top'
    | 'left'
    | 'right'
    | 'bottom-start'
    | 'bottom-end'
  /** 使用设计系统的间距别名或数值（将映射为最近的别名） */
  offset?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  closeOnClickOutside?: boolean
  closeOnContentClick?: boolean
}

const props = withDefaults(defineProps<DropdownProps>(), {
  placement: 'bottom',
  offset: 'sm',
  closeOnClickOutside: true,
  closeOnContentClick: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>()

const show = ref(props.modelValue || false)
const dropdownRef = ref<HTMLElement>()

const dropdownContentClasses = computed(() => {
  const cls = [
    'acuity-dropdown-content',
    `acuity-dropdown-content--${props.placement}`
  ]
  // 将数值映射到最近的别名（4,8,16,24,32）
  const mapNumToToken = (n: number): 'xs' | 'sm' | 'md' | 'lg' | 'xl' => {
    if (n <= 6) return 'xs'
    if (n <= 12) return 'sm'
    if (n <= 20) return 'md'
    if (n <= 28) return 'lg'
    return 'xl'
  }
  const offsetToken =
    typeof props.offset === 'string'
      ? props.offset
      : mapNumToToken(props.offset || 8)
  cls.push(`offset-${offsetToken}`)
  return cls
})

const toggle = () => {
  show.value = !show.value
  emit('update:modelValue', show.value)

  if (show.value) {
    emit('open')
  } else {
    emit('close')
  }
}

const close = () => {
  if (show.value) {
    show.value = false
    emit('update:modelValue', false)
    emit('close')
  }
}

const handleContentClick = () => {
  if (props.closeOnContentClick) {
    close()
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (!props.closeOnClickOutside) return

  const target = event.target as Node
  if (dropdownRef.value && !dropdownRef.value.contains(target)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.acuity-dropdown {
  position: relative;
  display: inline-block;
}

.acuity-dropdown-trigger {
  cursor: pointer;
}

.acuity-dropdown-content {
  position: absolute;
  z-index: 1000;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  max-width: 320px;
  overflow: hidden;
}

/* Placement */
.acuity-dropdown-content--bottom {
  left: 0;
}

.acuity-dropdown-content--bottom-start {
  left: 0;
}

.acuity-dropdown-content--bottom-end {
  right: 0;
}

.acuity-dropdown-content--top {
  left: 0;
}

.acuity-dropdown-content--left {
  top: 0;
}

.acuity-dropdown-content--right {
  top: 0;
}

/* Offset classes (使用设计系统 spacing token) */
.acuity-dropdown-content.offset-xs.acuity-dropdown-content--bottom,
.acuity-dropdown-content.offset-xs.acuity-dropdown-content--bottom-start,
.acuity-dropdown-content.offset-xs.acuity-dropdown-content--bottom-end {
  top: calc(100% + var(--spacing-xs));
}
.acuity-dropdown-content.offset-sm.acuity-dropdown-content--bottom,
.acuity-dropdown-content.offset-sm.acuity-dropdown-content--bottom-start,
.acuity-dropdown-content.offset-sm.acuity-dropdown-content--bottom-end {
  top: calc(100% + var(--spacing-sm));
}
.acuity-dropdown-content.offset-md.acuity-dropdown-content--bottom,
.acuity-dropdown-content.offset-md.acuity-dropdown-content--bottom-start,
.acuity-dropdown-content.offset-md.acuity-dropdown-content--bottom-end {
  top: calc(100% + var(--spacing-md));
}
.acuity-dropdown-content.offset-lg.acuity-dropdown-content--bottom,
.acuity-dropdown-content.offset-lg.acuity-dropdown-content--bottom-start,
.acuity-dropdown-content.offset-lg.acuity-dropdown-content--bottom-end {
  top: calc(100% + var(--spacing-lg));
}
.acuity-dropdown-content.offset-xl.acuity-dropdown-content--bottom,
.acuity-dropdown-content.offset-xl.acuity-dropdown-content--bottom-start,
.acuity-dropdown-content.offset-xl.acuity-dropdown-content--bottom-end {
  top: calc(100% + var(--spacing-xl));
}

.acuity-dropdown-content.offset-xs.acuity-dropdown-content--top {
  bottom: calc(100% + var(--spacing-xs));
}
.acuity-dropdown-content.offset-sm.acuity-dropdown-content--top {
  bottom: calc(100% + var(--spacing-sm));
}
.acuity-dropdown-content.offset-md.acuity-dropdown-content--top {
  bottom: calc(100% + var(--spacing-md));
}
.acuity-dropdown-content.offset-lg.acuity-dropdown-content--top {
  bottom: calc(100% + var(--spacing-lg));
}
.acuity-dropdown-content.offset-xl.acuity-dropdown-content--top {
  bottom: calc(100% + var(--spacing-xl));
}

.acuity-dropdown-content.offset-xs.acuity-dropdown-content--left {
  right: calc(100% + var(--spacing-xs));
}
.acuity-dropdown-content.offset-sm.acuity-dropdown-content--left {
  right: calc(100% + var(--spacing-sm));
}
.acuity-dropdown-content.offset-md.acuity-dropdown-content--left {
  right: calc(100% + var(--spacing-md));
}
.acuity-dropdown-content.offset-lg.acuity-dropdown-content--left {
  right: calc(100% + var(--spacing-lg));
}
.acuity-dropdown-content.offset-xl.acuity-dropdown-content--left {
  right: calc(100% + var(--spacing-xl));
}

.acuity-dropdown-content.offset-xs.acuity-dropdown-content--right {
  left: calc(100% + var(--spacing-xs));
}
.acuity-dropdown-content.offset-sm.acuity-dropdown-content--right {
  left: calc(100% + var(--spacing-sm));
}
.acuity-dropdown-content.offset-md.acuity-dropdown-content--right {
  left: calc(100% + var(--spacing-md));
}
.acuity-dropdown-content.offset-lg.acuity-dropdown-content--right {
  left: calc(100% + var(--spacing-lg));
}
.acuity-dropdown-content.offset-xl.acuity-dropdown-content--right {
  left: calc(100% + var(--spacing-xl));
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all var(--md-sys-motion-duration-short4)
    var(--md-sys-motion-easing-standard);
  transform-origin: top;
}

.dropdown-enter-from {
  opacity: 0;
  transform: scaleY(0.8) translateY(var(--spacing-sm));
}

.dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.8) translateY(var(--spacing-sm));
}
</style>
