<template>
  <Teleport to="body">
    <Transition name="toast" appear>
      <div v-if="show" :class="toastClasses" @click="handleClick">
        <Icon v-if="iconName" :name="iconName" class="acuity-toast-icon" />
        <div class="acuity-toast-content">
          <template v-if="$slots.default">
            <slot />
          </template>
          <div v-else class="acuity-toast-text">{{ text }}</div>
        </div>
        <Button
          v-if="!hideCloseButton"
          variant="ghost"
          size="sm"
          icon
          class="acuity-toast-close"
          @click="close"
        >
          <Icon name="mdi-close" :size="16" />
        </Button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { Icon, Button } from '@/components'
import type { ToastProps } from './Toast.d'

const props = withDefaults(defineProps<ToastProps>(), {
  color: 'info',
  timeout: 2000,
  location: 'top'
})

const emit = defineEmits<{ 'update:show': [value: boolean]; close: [] }>()

let timeoutId: number | null = null

const toastClasses = computed(() => [
  'acuity-toast',
  `acuity-toast--${props.color}`,
  `acuity-toast--${props.location}`
])

const iconName = computed(() => {
  switch (props.color) {
    case 'success':
      return 'mdi-check-circle'
    case 'warning':
      return 'mdi-alert'
    case 'error':
      return 'mdi-alert-circle'
    default:
      return 'mdi-information'
  }
})

const close = () => {
  emit('update:show', false)
  emit('close')
}

const handleClick = () => {
  if (!props.hideCloseButton) {
    close()
  }
}

// 透明代理到 chrome.notifications
import { notify } from '@/application/notification/notification-service'

function forwardToSystemNotification() {
  const text = typeof props.text === 'string' ? props.text : ''
  const level =
    props.color === 'success' ||
    props.color === 'warning' ||
    props.color === 'error'
      ? props.color
      : 'info'
  notify(text || ' ', { level, timeoutMs: props.timeout })
}

onMounted(() => {
  if (props.show) {
    forwardToSystemNotification()
    close()
  }
  if (props.timeout > 0) {
    timeoutId = window.setTimeout(() => {
      close()
    }, props.timeout)
  }
})

// 监听 show 变化，确保后续触发也转发为系统通知
watch(
  () => props.show,
  val => {
    if (val) {
      forwardToSystemNotification()
      // 立即关闭，避免自定义 Toast 可见
      close()
    }
  }
)

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }
})
</script>

<style scoped>
.acuity-toast {
  position: fixed;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: 400px;
  min-width: 200px;
  z-index: 9999;
  cursor: pointer;
}

/* Positions */
.acuity-toast--top {
  top: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
}

.acuity-toast--bottom {
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
}

.acuity-toast--top-right {
  top: var(--spacing-lg);
  right: var(--spacing-lg);
}

.acuity-toast--top-left {
  top: var(--spacing-lg);
  left: var(--spacing-lg);
}

.acuity-toast--bottom-right {
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
}

.acuity-toast--bottom-left {
  bottom: var(--spacing-lg);
  left: var(--spacing-lg);
}

/* Colors */
.acuity-toast--info {
  border-left: 4px solid var(--color-primary);
}

.acuity-toast--success {
  border-left: 4px solid var(--color-success);
}

.acuity-toast--warning {
  border-left: 4px solid var(--color-warning);
}

.acuity-toast--error {
  border-left: 4px solid var(--color-error);
}

.acuity-toast--info .acuity-toast-icon {
  color: var(--color-primary);
}

.acuity-toast--success .acuity-toast-icon {
  color: var(--color-success);
}

.acuity-toast--warning .acuity-toast-icon {
  color: var(--color-warning);
}

.acuity-toast--error .acuity-toast-icon {
  color: var(--color-error);
}

.acuity-toast-content {
  flex: 1;
  min-width: 0;
}

.acuity-toast-text {
  font-size: var(--text-base);
  color: var(--color-text-primary);
  line-height: 1.4;
}

.acuity-toast-close {
  flex-shrink: 0;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.acuity-toast--top-right.toast-enter-from,
.acuity-toast--bottom-right.toast-enter-from {
  transform: translateX(20px);
}

.acuity-toast--top-right.toast-leave-to,
.acuity-toast--bottom-right.toast-leave-to {
  transform: translateX(20px);
}

.acuity-toast--top-left.toast-enter-from,
.acuity-toast--bottom-left.toast-enter-from {
  transform: translateX(-20px);
}

.acuity-toast--top-left.toast-leave-to,
.acuity-toast--bottom-left.toast-leave-to {
  transform: translateX(-20px);
}
</style>
