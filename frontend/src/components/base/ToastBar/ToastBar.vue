<template>
  <teleport to="body">
    <div
      class="ab-toastbar"
      :class="positionClass"
      :style="containerStyle"
      aria-live="polite"
      aria-atomic="true"
    >
      <transition-group name="ab-toast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="ab-toast"
          :class="[t.level, { paused: !!t.paused }]"
          @mouseenter="pause(t.id)"
          @mouseleave="resume(t.id)"
        >
          <!-- ✅ 环形进度条（复用 ProgressBar 组件） -->
          <div class="ab-toast__progress-circle" aria-hidden="true">
            <ProgressBar
              variant="circular"
              :value="0"
              :size="32"
              :stroke-width="2.5"
              :color="getProgressColor(t.level)"
              :show-label="false"
              countdown
              :duration="t.timeoutMs"
              :paused="t.paused"
            />
          </div>

          <!-- ✅ 复用 Icon 组件 -->
          <div class="ab-toast__icon" aria-hidden="true">
            <Icon :name="getIconName(t.level)" :size="22" />
          </div>
          <div class="ab-toast__content">
            <div v-if="t.title" class="ab-toast__title">{{ t.title }}</div>
            <div class="ab-toast__message">{{ t.message }}</div>
          </div>
          <!-- ✅ 关闭按钮 -->
          <button
            v-if="showClose"
            class="ab-toast__close"
            type="button"
            :aria-label="`关闭${t.title || t.message}通知`"
            @click="close(t.id)"
          >
            <Icon name="icon-close" :size="16" />
          </button>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive } from 'vue'
import ProgressBar from '@/components/base/ProgressBar/ProgressBar.vue'
import Icon from '@/components/base/Icon/Icon.vue'
import { NOTIFICATION_CONFIG, ANIMATION_CONFIG } from '@/config/constants'

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

const props = withDefaults(
  defineProps<{
    position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
    /** 顶部偏移（像素），用于避免遮挡右上角按钮 */
    offsetTop?: number
    /** 安全关闭的最大生命周期（毫秒）；到时即使悬停也会关闭 */
    maxLifetimeMs?: number
    /** 是否显示关闭按钮 */
    showClose?: boolean
  }>(),
  {
    showClose: true // ✅ 默认显示关闭按钮
  }
)

const state = reactive({
  toasts: [] as ToastItem[]
})

/**
 * ✅ 根据 Toast 级别获取图标名称
 */
function getIconName(level: Level): string {
  const iconMap: Record<Level, string> = {
    info: 'icon-information',
    success: 'icon-check-circle',
    warning: 'icon-alert',
    error: 'icon-alert-circle'
  }
  return iconMap[level]
}

/**
 * ✅ 根据 Toast 级别获取进度条颜色
 */
function getProgressColor(
  level: Level
): 'primary' | 'secondary' | 'success' | 'warning' | 'error' {
  const colorMap: Record<
    Level,
    'primary' | 'secondary' | 'success' | 'warning' | 'error'
  > = {
    info: 'primary',
    success: 'success',
    warning: 'warning',
    error: 'error'
  }
  return colorMap[level]
}

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

  // ✅ 如果 toast 不存在,直接返回（避免重复关闭导致闪烁）
  if (!t) return

  // 清理定时器
  if (t.__timer) {
    try {
      clearTimeout(t.__timer)
    } catch {}
  }
  if (t.__safetyTimer) {
    try {
      clearTimeout(t.__safetyTimer)
    } catch {}
  }

  // 从列表中移除
  state.toasts = state.toasts.filter(toast => toast.id !== id)
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
  // ✅ 恢复倒计时（进度条通过CSS自动恢复）
  scheduleAutoClose(t)
}

function showToast(
  message: string,
  opts?: { title?: string; level?: Level; timeoutMs?: number }
) {
  const id = Math.random().toString(36).slice(2)
  const level: Level = opts?.level || 'info'
  const timeoutMs = Math.max(
    0,
    opts?.timeoutMs ?? NOTIFICATION_CONFIG.DEFAULT_TOAST_TIMEOUT
  )
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

  // ✅ 注入动画配置为 CSS 变量
  return {
    ...(top !== undefined ? { '--ab-toast-offset-top': `${top}px` } : {}),
    '--ab-toast-enter-duration': `${ANIMATION_CONFIG.DURATION.TOAST_ENTER}ms`,
    '--ab-toast-leave-duration': `${ANIMATION_CONFIG.DURATION.TOAST_LEAVE}ms`,
    '--ab-toast-enter-easing': ANIMATION_CONFIG.EASING.EMPHASIZED,
    '--ab-toast-leave-easing': ANIMATION_CONFIG.EASING.ACCELERATE,
    '--ab-toast-shadow-easing': ANIMATION_CONFIG.EASING.SHADOW,
    '--ab-toast-button-easing': ANIMATION_CONFIG.EASING.STANDARD
  } as Record<string, string>
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

/* ✅ 动画 - 使用统一配置 */
.ab-toast-enter-active {
  animation: ab-toast-slide-in var(--ab-toast-enter-duration)
    var(--ab-toast-enter-easing);
}

.ab-toast-leave-active {
  animation: ab-toast-slide-out var(--ab-toast-leave-duration)
    var(--ab-toast-leave-easing);
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
    transition: opacity var(--ab-toast-leave-duration);
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
  padding: 12px 16px 6px;
  border-radius: 8px;
  box-shadow:
    0 6px 16px 0 rgba(0, 0, 0, 0.08),
    0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.05);
  font-size: 14px;
  line-height: 1.5715;
  word-wrap: break-word;
  position: relative;
  /* ✅ 允许环形进度条溢出显示（不使用 overflow: hidden） */
  overflow: visible;
  /* ✅ 只过渡 box-shadow，避免和 Vue 动画冲突 - 使用统一配置 */
  transition: box-shadow 0.3s var(--ab-toast-shadow-easing);
}

.ab-toast:hover {
  box-shadow:
    0 8px 20px 0 rgba(0, 0, 0, 0.1),
    0 4px 8px -4px rgba(0, 0, 0, 0.14),
    0 12px 32px 8px rgba(0, 0, 0, 0.06);
}

/* ✅ 环形进度条容器（使用 ProgressBar 组件） */
.ab-toast__progress-circle {
  position: absolute;
  left: -18px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* 图标容器（使用 Icon 组件） */
.ab-toast__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
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

/* ✅ 关闭按钮 */
.ab-toast__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: -4px -4px 0 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-sm, 4px);
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  /* ✅ 使用统一配置 */
  transition: all var(--ab-toast-leave-duration) var(--ab-toast-button-easing);
  outline: none;
}

.ab-toast__close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.88);
}

.ab-toast__close:active {
  background: rgba(0, 0, 0, 0.12);
}

.ab-toast__close:focus-visible {
  outline: 2px solid var(--color-primary, #1677ff);
  outline-offset: 2px;
}

/* 暗色模式关闭按钮 */
@media (prefers-color-scheme: dark) {
  .ab-toast__close {
    color: rgba(255, 255, 255, 0.45);
  }

  .ab-toast__close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
  }

  .ab-toast__close:active {
    background: rgba(255, 255, 255, 0.16);
  }
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
