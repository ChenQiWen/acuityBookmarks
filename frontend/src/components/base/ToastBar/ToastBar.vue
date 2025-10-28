<template>
  <teleport to="body">
    <div
      class="ab-toastbar"
      :class="positionClass"
      :style="containerStyle"
      aria-live="polite"
      aria-atomic="true"
    >
      <transition-group name="ab-toast" tag="div" move-class="ab-toast-move">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="ab-toast"
          :class="[t.level, { paused: !!t.paused }]"
          :style="{ '--ab-toast-duration': t.timeoutMs + 'ms' }"
          @mouseenter="pause(t.id)"
          @mouseleave="resume(t.id)"
        >
          <div class="ab-toast__icon" aria-hidden="true">
            <svg
              v-if="t.level === 'success'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
              />
            </svg>
            <svg
              v-else-if="t.level === 'info'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
              />
            </svg>
            <svg
              v-else-if="t.level === 'warning'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z"
              />
            </svg>
            <svg
              v-else-if="t.level === 'error'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
              />
            </svg>
          </div>
          <div class="ab-toast__content">
            <div v-if="t.title" class="ab-toast__title">{{ t.title }}</div>
            <div class="ab-toast__message">{{ t.message }}</div>
          </div>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive } from 'vue'

type Level = 'info' | 'success' | 'warning' | 'error'

interface ToastItem {
  id: string
  title?: string
  message: string
  level: Level
  timeoutMs: number
  paused?: boolean
  startedAt?: number
  remaining?: number
}

const props = defineProps<{
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
  /** 顶部偏移（像素），用于避免遮挡右上角按钮 */
  offsetTop?: number
  /** 安全关闭的最大生命周期（毫秒）；到时即使悬停也会关闭 */
  maxLifetimeMs?: number
}>()

const state = reactive({
  toasts: [] as ToastItem[]
})

function getToastById(id: string) {
  return state.toasts.find(x => x.id === id) as
    | (ToastItem & {
        __timer?: ReturnType<typeof setTimeout>
        __safetyTimer?: ReturnType<typeof setTimeout>
      })
    | undefined
}

const toasts = computed(() => state.toasts)

function close(id: string) {
  const t = state.toasts.find(x => x.id === id) as
    | (ToastItem & {
        __timer?: ReturnType<typeof setTimeout>
        __safetyTimer?: ReturnType<typeof setTimeout>
      })
    | undefined
  if (t?.__timer)
    try {
      clearTimeout(t.__timer)
    } catch {}
  if (t?.__safetyTimer)
    try {
      clearTimeout(t.__safetyTimer)
    } catch {}
  state.toasts = state.toasts.filter(t => t.id !== id)
}

function pause(id: string) {
  const t = getToastById(id)
  if (!t || t.paused) return
  const now = Date.now()
  const elapsed = now - (t.startedAt || now)
  t.remaining = Math.max(0, (t.remaining ?? t.timeoutMs) - elapsed)
  // 取消当前倒计时，等待恢复时重新计时
  try {
    if (t.__timer) clearTimeout(t.__timer)
  } catch {}
  t.paused = true
}

function resume(id: string) {
  const t = getToastById(id)
  if (!t || !t.paused) return
  t.paused = false
  t.startedAt = Date.now()
  scheduleAutoClose(t)
}

function showToast(
  message: string,
  opts?: { title?: string; level?: Level; timeoutMs?: number }
) {
  const id = Math.random().toString(36).slice(2)
  const level: Level = opts?.level || 'info'
  const timeoutMs = Math.max(0, opts?.timeoutMs ?? 2500)
  const item: ToastItem = {
    id,
    message,
    title: opts?.title,
    level,
    timeoutMs,
    startedAt: Date.now(),
    remaining: timeoutMs
  }
  state.toasts.push(item)
  if (timeoutMs > 0) scheduleAutoClose(item)
  return id
}

function scheduleAutoClose(t: ToastItem) {
  const tt = t as ToastItem & {
    __timer?: ReturnType<typeof setTimeout>
    __safetyTimer?: ReturnType<typeof setTimeout>
  }
  const ms = tt.remaining ?? tt.timeoutMs
  if (ms <= 0) return close(tt.id)
  try {
    if (tt.__timer) clearTimeout(tt.__timer)
  } catch {}
  const handle = setTimeout(() => {
    // Look up live toast at execution time to avoid stale closure on paused flag
    const live = getToastById(tt.id)
    if (!live) return
    if (!live.paused) close(live.id)
  }, ms)
  ;(tt as ToastItem & { __timer?: ReturnType<typeof setTimeout> }).__timer =
    handle
  // 安全关闭：到达最大生命周期后强制关闭（忽略悬停）
  const baseStart = tt.startedAt || Date.now()
  const maxMs = Math.max(tt.timeoutMs, props.maxLifetimeMs ?? 6000)
  const remainingToMax = Math.max(0, baseStart + maxMs - Date.now())
  if (remainingToMax > 0) {
    try {
      if (tt.__safetyTimer) clearTimeout(tt.__safetyTimer)
    } catch {}
    const safety = setTimeout(() => close(tt.id), remainingToMax)
    ;(
      tt as ToastItem & { __safetyTimer?: ReturnType<typeof setTimeout> }
    ).__safetyTimer = safety
  }
}

onBeforeUnmount(() => {
  for (const t of state.toasts) {
    const h = (t as ToastItem & { __timer?: ReturnType<typeof setTimeout> })
      .__timer
    if (h)
      try {
        clearTimeout(h)
      } catch {}
    const s = (
      t as ToastItem & { __safetyTimer?: ReturnType<typeof setTimeout> }
    ).__safetyTimer
    if (s)
      try {
        clearTimeout(s)
      } catch {}
  }
})

const positionClass = computed(() => props.position ?? 'top-right')
const containerStyle = computed(() => {
  // 仅对 top-* 应用偏移
  const top =
    (props.position?.startsWith('top-') ?? true)
      ? (props.offsetTop ?? 56)
      : undefined
  return top !== undefined
    ? ({ '--ab-toast-offset-top': `${top}px` } as Record<string, string>)
    : undefined
})

// 暴露方法供管理器调用
defineExpose({ showToast, close })
</script>

<style scoped>
.ab-toastbar {
  position: fixed;
  z-index: 2147483000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ab-toastbar.top-right {
  top: var(--ab-toast-offset-top, 16px);
  right: 16px;
}

.ab-toastbar.bottom-right {
  bottom: 16px;
  right: 16px;
}

.ab-toastbar.top-left {
  top: var(--ab-toast-offset-top, 16px);
  left: 16px;
}

.ab-toastbar.bottom-left {
  bottom: 16px;
  left: 16px;
}

/* 动画 - 参考 Ant Design */
.ab-toast-enter-active {
  animation: ab-toast-slide-in 0.24s cubic-bezier(0.23, 1, 0.32, 1);
}

.ab-toast-leave-active {
  animation: ab-toast-slide-out 0.2s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes ab-toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes ab-toast-slide-out {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(100%) scale(0.95);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ab-toast-enter-active,
  .ab-toast-leave-active {
    animation: none;
    transition: opacity 0.2s;
  }
}

/* Toast 卡片样式 - 参考 Ant Design Alert */
.ab-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 320px;
  max-width: 480px;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow:
    0 6px 16px 0 rgba(0, 0, 0, 0.08),
    0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.05);
  font-size: 14px;
  line-height: 1.5715;
  word-wrap: break-word;
  /* 只过渡 box-shadow，避免和 Vue 动画冲突 */
  transition: box-shadow 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.ab-toast:hover {
  box-shadow:
    0 8px 20px 0 rgba(0, 0, 0, 0.1),
    0 4px 8px -4px rgba(0, 0, 0, 0.14),
    0 12px 32px 8px rgba(0, 0, 0, 0.06);
}

/* 禁用移动动画，避免闪烁 */
.ab-toast-move {
  transition: none !important;
}

/* 图标容器 */
.ab-toast__icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-top: 1px;
}

.ab-toast__icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* 内容区域 */
.ab-toast__content {
  flex: 1;
  min-width: 0;
}

.ab-toast__title {
  font-weight: 600;
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 4px;
  color: rgba(0, 0, 0, 0.88);
}

.ab-toast__message {
  font-size: 14px;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.88);
}

/* Success 样式 */
.ab-toast.success {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.ab-toast.success .ab-toast__icon {
  color: #52c41a;
}

/* Info 样式 */
.ab-toast.info {
  background: #e6f4ff;
  border: 1px solid #91caff;
}

.ab-toast.info .ab-toast__icon {
  color: #1677ff;
}

/* Warning 样式 */
.ab-toast.warning {
  background: #fffbe6;
  border: 1px solid #ffe58f;
}

.ab-toast.warning .ab-toast__icon {
  color: #faad14;
}

/* Error 样式 */
.ab-toast.error {
  background: #fff2f0;
  border: 1px solid #ffccc7;
}

.ab-toast.error .ab-toast__icon {
  color: #ff4d4f;
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .ab-toast__title,
  .ab-toast__message {
    color: rgba(255, 255, 255, 0.85);
  }

  /* Success - Dark */
  .ab-toast.success {
    background: rgba(82, 196, 26, 0.08);
    border: 1px solid rgba(82, 196, 26, 0.3);
  }

  .ab-toast.success .ab-toast__icon {
    color: #73d13d;
  }

  /* Info - Dark */
  .ab-toast.info {
    background: rgba(22, 119, 255, 0.08);
    border: 1px solid rgba(22, 119, 255, 0.3);
  }

  .ab-toast.info .ab-toast__icon {
    color: #4096ff;
  }

  /* Warning - Dark */
  .ab-toast.warning {
    background: rgba(250, 173, 20, 0.08);
    border: 1px solid rgba(250, 173, 20, 0.3);
  }

  .ab-toast.warning .ab-toast__icon {
    color: #ffc53d;
  }

  /* Error - Dark */
  .ab-toast.error {
    background: rgba(255, 77, 79, 0.08);
    border: 1px solid rgba(255, 77, 79, 0.3);
  }

  .ab-toast.error .ab-toast__icon {
    color: #ff7875;
  }

  .ab-toast {
    box-shadow:
      0 6px 16px 0 rgba(0, 0, 0, 0.32),
      0 3px 6px -4px rgba(0, 0, 0, 0.48),
      0 9px 28px 8px rgba(0, 0, 0, 0.2);
  }

  .ab-toast:hover {
    box-shadow:
      0 8px 20px 0 rgba(0, 0, 0, 0.36),
      0 4px 8px -4px rgba(0, 0, 0, 0.52),
      0 12px 32px 8px rgba(0, 0, 0, 0.24);
  }
}
</style>
