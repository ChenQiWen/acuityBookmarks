<template>
  <Teleport to="body">
    <Transition name="overlay" appear>
      <div
        v-if="show"
        :class="overlayClasses"
        tabindex="-1"
        @click="handleBackdropClick"
        @keydown="handleKeydown"
      >
        <div class="acuity-overlay-content" @click.stop>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import type { OverlayProps } from './Overlay.d'

const props = withDefaults(defineProps<OverlayProps>(), {
  persistent: false,
  zIndex: 9999,
  opacity: 0.8,
  blur: false
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:modelValue': [value: boolean]
  close: []
}>()

const show = computed({
  get: () => (props.show !== undefined ? props.show : props.modelValue),
  set: value => {
    emit('update:modelValue', value)
    emit('update:show', value)
  }
})

const overlayClasses = computed(() => [
  'acuity-overlay',
  {
    'acuity-overlay--blur': props.blur
  }
])

const overlayStyle = computed(() => ({
  zIndex: props.zIndex,
  backgroundColor: `rgba(0, 0, 0, ${props.opacity})`
}))

const handleBackdropClick = () => {
  if (!props.persistent) {
    show.value = false
    emit('close')
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  // ESC键 - 关闭覆盖层
  if (event.key === 'Escape' && !props.persistent) {
    show.value = false
    emit('close')
    event.preventDefault()
  }
}

// 自动获得焦点以确保键盘事件能被捕获
watch(
  () => show.value,
  newShow => {
    if (newShow) {
      nextTick(() => {
        const overlay = document.querySelector('.acuity-overlay') as HTMLElement
        if (overlay) {
          overlay.focus()
        }
      })
    }
  }
)
</script>

<style scoped>
.acuity-overlay {
  position: fixed;
  inset: 0;
  z-index: v-bind('overlayStyle.zIndex');
  display: flex;
  justify-content: center;
  align-items: center;
  outline: none; /* 移除焦点轮廓 */
  background: v-bind('overlayStyle.backgroundColor');
}

.acuity-overlay--blur {
  backdrop-filter: blur(4px);
}

.acuity-overlay-content {
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}

/* Transitions */
.overlay-enter-active,
.overlay-leave-active {
  transition: all var(--md-sys-motion-duration-medium2)
    var(--md-sys-motion-easing-standard);
}

.overlay-enter-from {
  opacity: 0;
}

.overlay-leave-to {
  opacity: 0;
}

.overlay-enter-from .acuity-overlay-content {
  transform: scale(0.9) translateY(20px);
}

.overlay-leave-to .acuity-overlay-content {
  transform: scale(0.9) translateY(20px);
}
</style>
