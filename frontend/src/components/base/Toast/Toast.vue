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
          <Icon name="icon-cancel" :size="16" />
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
      return 'icon-check-circle'
    case 'warning':
      return 'icon-alert'
    case 'error':
      return 'icon-alert-circle'
    default:
      return 'icon-information'
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

// ✅ Toast 在页面内正常显示，不自动转发为系统通知
// 如需系统通知，请直接调用 notificationService
onMounted(() => {
  // ✅ 仅在有超时时间时设置自动关闭
  if (props.show && props.timeout > 0) {
    timeoutId = window.setTimeout(() => {
      close()
    }, props.timeout)
  }
})

// ✅ 监听 show 变化，重新设置超时
watch(
  () => props.show,
  (val, oldVal) => {
    // 清除旧的定时器
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    // 如果新显示且有超时，设置新定时器
    if (val && !oldVal && props.timeout > 0) {
      timeoutId = window.setTimeout(() => {
        close()
      }, props.timeout)
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
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 200px;
  max-width: 400px;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  box-shadow: var(--shadow-lg);
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
  right: var(--spacing-lg);
  bottom: var(--spacing-lg);
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
  line-height: 1.4;
  color: var(--color-text-primary);
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
