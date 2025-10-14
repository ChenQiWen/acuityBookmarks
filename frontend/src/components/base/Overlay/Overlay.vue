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

export interface OverlayProps {
  show: boolean
  persistent?: boolean
  zIndex?: number
  opacity?: number
  blur?: boolean
}

const props = withDefaults(defineProps<OverlayProps>(), {
  persistent: false,
  zIndex: 9999,
  opacity: 0.8,
  blur: false
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
}>()

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
    emit('update:show', false)
    emit('close')
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  // ESC键 - 关闭覆盖层
  if (event.key === 'Escape' && !props.persistent) {
    emit('update:show', false)
    emit('close')
    event.preventDefault()
  }
}

// 自动获得焦点以确保键盘事件能被捕获
watch(
  () => props.show,
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: v-bind('overlayStyle.backgroundColor');
  z-index: v-bind('overlayStyle.zIndex');
  outline: none; /* 移除焦点轮廓 */
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
