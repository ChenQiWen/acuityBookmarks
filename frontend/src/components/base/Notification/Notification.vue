<template>
  <teleport to="body">
    <div 
      v-for="placement in placements" 
      :key="placement"
      :class="['ab-notification-container', `ab-notification-${placement}`]"
    >
      <transition-group name="ab-notification" tag="div">
        <div
          v-for="item in getNotificationsByPlacement(placement)"
          :key="item.key || item.id"
          class="ab-notification"
          :class="[`ab-notification-${item.type}`]"
          @mouseenter="handleMouseEnter(item.id)"
          @mouseleave="handleMouseLeave(item.id)"
        >
          <div class="ab-notification-content">
            <div v-if="item.icon !== false" class="ab-notification-icon">
              <Icon :name="getIconName(item.type)" :size="24" />
            </div>
            <div class="ab-notification-message">
              <div v-if="item.message" class="ab-notification-title">
                {{ item.message }}
              </div>
              <div v-if="item.description" class="ab-notification-description">
                {{ item.description }}
              </div>
            </div>
            <button
              v-if="item.closable !== false"
              class="ab-notification-close"
              type="button"
              :aria-label="`关闭${item.message}通知`"
              @click="close(item.id)"
            >
              <Icon name="icon-cancel" :size="14" />
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import Icon from '@/components/base/Icon/Icon.vue'

type NotificationType = 'success' | 'info' | 'warning' | 'error'
type NotificationPlacement = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

interface NotificationItem {
  id: string
  key?: string
  type: NotificationType
  message?: string
  description?: string
  duration?: number
  closable?: boolean
  icon?: boolean
  placement: NotificationPlacement
  createdAt: number
  paused: boolean
  timer?: ReturnType<typeof setTimeout>
}

interface NotificationConfig {
  key?: string
  message?: string
  description?: string
  duration?: number
  closable?: boolean
  icon?: boolean
  placement?: NotificationPlacement
}

const state = reactive<{
  notifications: NotificationItem[]
  defaultPlacement: NotificationPlacement
  defaultDuration: number
}>({
  notifications: [],
  defaultPlacement: 'topRight',
  defaultDuration: 4.5
})

const placements: NotificationPlacement[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

function getNotificationsByPlacement(placement: NotificationPlacement) {
  return state.notifications.filter(n => n.placement === placement)
}

function getIconName(type: NotificationType): string {
  const iconMap: Record<NotificationType, string> = {
    success: 'icon-success',
    info: 'icon-info',
    warning: 'icon-warning',
    error: 'icon-error'
  }
  return iconMap[type]
}

function generateId(): string {
  return `notification_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function open(config: NotificationConfig & { type: NotificationType }) {
  const { key, type, message, description, duration, closable, icon, placement } = config

  // 🎯 Ant Design 核心特性：通过 key 判断是更新还是新建
  if (key) {
    const existing = state.notifications.find(n => n.key === key)
    if (existing) {
      // 更新现有通知
      existing.type = type
      existing.message = message
      existing.description = description
      existing.duration = duration ?? state.defaultDuration
      existing.closable = closable ?? true
      existing.icon = icon ?? true
      existing.paused = false
      
      // 清除旧定时器
      if (existing.timer) {
        clearTimeout(existing.timer)
      }
      
      // 重新设置定时器
      if (existing.duration > 0) {
        existing.timer = setTimeout(() => {
          close(existing.id)
        }, existing.duration * 1000)
      }
      
      console.log('[Notification] 更新通知', { key, id: existing.id })
      return
    }
  }

  // 创建新通知
  const id = generateId()
  const item: NotificationItem = {
    id,
    key,
    type,
    message,
    description,
    duration: duration ?? state.defaultDuration,
    closable: closable ?? true,
    icon: icon ?? true,
    placement: placement ?? state.defaultPlacement,
    createdAt: Date.now(),
    paused: false
  }

  state.notifications.push(item)

  // 自动关闭
  if (item.duration && item.duration > 0) {
    item.timer = setTimeout(() => {
      close(id)
    }, item.duration * 1000)
  }

  console.log('[Notification] 创建通知', { key, id })
}

function close(id: string) {
  const index = state.notifications.findIndex(n => n.id === id)
  if (index === -1) return

  const item = state.notifications[index]
  
  // 清除定时器
  if (item.timer) {
    clearTimeout(item.timer)
  }

  // 移除通知
  state.notifications.splice(index, 1)
  
  console.log('[Notification] 关闭通知', { id })
}

function destroy(key?: string) {
  if (key) {
    const item = state.notifications.find(n => n.key === key)
    if (item) {
      close(item.id)
    }
  } else {
    // 清除所有通知
    state.notifications.forEach(n => {
      if (n.timer) {
        clearTimeout(n.timer)
      }
    })
    state.notifications = []
  }
}

function handleMouseEnter(id: string) {
  const item = state.notifications.find(n => n.id === id)
  if (!item) return

  item.paused = true
  if (item.timer) {
    clearTimeout(item.timer)
    item.timer = undefined
  }
}

function handleMouseLeave(id: string) {
  const item = state.notifications.find(n => n.id === id)
  if (!item) return

  item.paused = false
  
  // 恢复自动关闭
  if (item.duration && item.duration > 0) {
    const elapsed = (Date.now() - item.createdAt) / 1000
    const remaining = item.duration - elapsed
    
    if (remaining > 0) {
      item.timer = setTimeout(() => {
        close(item.id)
      }, remaining * 1000)
    } else {
      close(item.id)
    }
  }
}

// 导出方法供外部调用
defineExpose({
  open,
  success: (config: NotificationConfig) => open({ ...config, type: 'success' }),
  error: (config: NotificationConfig) => open({ ...config, type: 'error' }),
  info: (config: NotificationConfig) => open({ ...config, type: 'info' }),
  warning: (config: NotificationConfig) => open({ ...config, type: 'warning' }),
  destroy,
  config: (cfg: { placement?: NotificationPlacement; duration?: number }) => {
    if (cfg.placement) state.defaultPlacement = cfg.placement
    if (cfg.duration !== undefined) state.defaultDuration = cfg.duration
  }
})
</script>

<style scoped>


@keyframes notification-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes notification-slide-out {
  from {
    max-height: 150px;
    margin-bottom: 16px;
    opacity: 1;
  }

  to {
    max-height: 0;
    margin-bottom: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
  }
}

.ab-notification-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
}

.ab-notification-container > div {
  pointer-events: none;
}

.ab-notification {
  width: 384px;
  max-width: calc(100vw - 32px);
  margin-bottom: 16px;
  padding: 16px 24px;
  border-radius: 8px;
  background: white;
  pointer-events: auto;
  box-shadow: 0 6px 16px 0 rgb(0 0 0 / 8%),
              0 3px 6px -4px rgb(0 0 0 / 12%),
              0 9px 28px 8px rgb(0 0 0 / 5%);
}

.ab-notification-topLeft,
.ab-notification-topRight {
  top: 24px;
}

.ab-notification-bottomLeft,
.ab-notification-bottomRight {
  bottom: 24px;
}

.ab-notification-topLeft,
.ab-notification-bottomLeft {
  left: 24px;
}

.ab-notification-topRight,
.ab-notification-bottomRight {
  right: 24px;
}

.ab-notification-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ab-notification-icon {
  flex-shrink: 0;
  line-height: 1;
}

.ab-notification-success .ab-notification-icon {
  color: #52c41a;
}

.ab-notification-info .ab-notification-icon {
  color: #1677ff;
}

.ab-notification-warning .ab-notification-icon {
  color: #faad14;
}

.ab-notification-error .ab-notification-icon {
  color: #ff4d4f;
}

.ab-notification-message {
  flex: 1;
  min-width: 0;
}

.ab-notification-title {
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: rgb(0 0 0 / 88%);
}

.ab-notification-description {
  font-size: 14px;
  line-height: 22px;
  color: rgb(0 0 0 / 65%);
}

.ab-notification-close {
  flex-shrink: 0;
  padding: 0;
  border: none;
  outline: none;
  line-height: 1;
  color: rgb(0 0 0 / 45%);
  background: none;
  cursor: pointer;
  transition: color 0.2s;
}

.ab-notification-close:hover {
  color: rgb(0 0 0 / 88%);
}

/* 动画 */
.ab-notification-enter-active {
  animation: notification-slide-in 0.24s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.ab-notification-leave-active {
  animation: notification-slide-out 0.24s cubic-bezier(0.645, 0.045, 0.355, 1);
}
</style>
