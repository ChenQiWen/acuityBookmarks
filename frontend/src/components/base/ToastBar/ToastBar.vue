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
          <div class="ab-toast__icon" aria-hidden="true">
            <Icon :name="getIconName(t.level)" :size="22" />
          </div>
          <div class="ab-toast__content">
            <div v-if="t.title" class="ab-toast__title">{{ t.title }}</div>
            <div class="ab-toast__message">{{ t.message }}</div>
          </div>
          <button
            v-if="showClose"
            class="ab-toast__close"
            type="button"
            :aria-label="`关闭${t.title || t.message}通知`"
            @click="close(t.id)"
          >
            <Icon name="icon-cancel" :size="16" />
          </button>
          <ProgressBar
            variant="circular"
            :value="0"
            :size="22"
            :stroke-width="2.5"
            :color="getProgressColor(t.level)"
            :show-label="false"
            countdown
            :duration="t.timeoutMs"
            :paused="t.paused"
          />
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
  /** ✅ 初始创建时间（永不改变，用于安全定时器） */
  createdAt: number
  /** ✅ 当前倒计时起始时间（pause/resume 时更新） */
  startedAt?: number
  /** ✅ 剩余时间（pause 时计算） */
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
    info: 'icon-info',
    success: 'icon-success',
    warning: 'icon-warning',
    error: 'icon-error'
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

// ✅ 防止重复关闭的标志集合（避免闪烁）
const closingIds = new Set<string>()

function close(id: string) {
  // ✅ 如果正在关闭，直接返回（防止重复调用）
  if (closingIds.has(id)) return

  const t = state.toasts.find(x => x.id === id) as
    | (ToastItem & {
        __timer?: ReturnType<typeof setTimeout>
        __safetyTimer?: ReturnType<typeof setTimeout>
      })
    | undefined

  // ✅ 如果 toast 不存在,直接返回（避免重复关闭导致闪烁）
  if (!t) return

  // ✅ 标记为正在关闭
  closingIds.add(id)

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

  // ✅ 延迟清理标志（等待 Vue transition 完成）
  setTimeout(() => {
    closingIds.delete(id)
  }, 500) // 略大于 leave 动画时长（200ms）
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
  const now = Date.now()
  const item: ToastItem = {
    id,
    message,
    title: opts?.title,
    level,
    timeoutMs,
    createdAt: now, // ✅ 初始创建时间（永不改变）
    startedAt: now, // ✅ 当前倒计时起始时间
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

  // ✅ 清除旧的主定时器
  try {
    if (tt.__timer) clearTimeout(tt.__timer)
  } catch {}

  // ✅ 主定时器：基于剩余时间
  const handle = setTimeout(() => {
    // Look up live toast at execution time to avoid stale closure on paused flag
    const live = getToastById(tt.id)
    if (!live) return
    if (!live.paused) close(live.id)
  }, ms)
  ;(tt as ToastItem & { __timer?: ReturnType<typeof setTimeout> }).__timer =
    handle

  // ✅ 安全定时器：基于初始创建时间（createdAt），确保最大生命周期
  // 即使用户一直 hover，也会在 maxLifetimeMs 后强制关闭
  const maxMs = props.maxLifetimeMs ?? NOTIFICATION_CONFIG.MAX_TOAST_LIFETIME
  const elapsed = Date.now() - tt.createdAt
  const remainingToMax = Math.max(0, maxMs - elapsed)

  if (remainingToMax > 0) {
    try {
      if (tt.__safetyTimer) clearTimeout(tt.__safetyTimer)
    } catch {}
    const safety = setTimeout(() => {
      const live = getToastById(tt.id)
      if (!live) return
      close(live.id) // ✅ 强制关闭，忽略 paused 状态
    }, remainingToMax)
    ;(
      tt as ToastItem & { __safetyTimer?: ReturnType<typeof setTimeout> }
    ).__safetyTimer = safety
  }
}

onBeforeUnmount(() => {
  // ✅ 清理所有定时器
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
  // ✅ 清理关闭标志集合
  closingIds.clear()
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
    transition: opacity var(--ab-toast-leave-duration);
    animation: none;
  }
}

/* 暗色模式关闭按钮 */
@media (prefers-color-scheme: dark) {
  .ab-toast__close {
    color: rgb(255 255 255 / 45%);
  }

  .ab-toast__close:hover {
    color: rgb(255 255 255 / 85%);
    background: rgb(255 255 255 / 8%);
  }

  .ab-toast__close:active {
    background: rgb(255 255 255 / 16%);
  }
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .ab-toast__title,
  .ab-toast__message {
    color: rgb(255 255 255 / 85%);
  }

  /* Success - Dark */
  .ab-toast.success {
    border: 1px solid rgb(82 196 26 / 30%);
    background: rgb(82 196 26 / 8%);
  }

  .ab-toast.success .ab-toast__icon {
    color: #73d13d;
  }

  /* Info - Dark */
  .ab-toast.info {
    border: 1px solid rgb(22 119 255 / 30%);
    background: rgb(22 119 255 / 8%);
  }

  .ab-toast.info .ab-toast__icon {
    color: #4096ff;
  }

  /* Warning - Dark */
  .ab-toast.warning {
    border: 1px solid rgb(250 173 20 / 30%);
    background: rgb(250 173 20 / 8%);
  }

  .ab-toast.warning .ab-toast__icon {
    color: #ffc53d;
  }

  /* Error - Dark */
  .ab-toast.error {
    border: 1px solid rgb(255 77 79 / 30%);
    background: rgb(255 77 79 / 8%);
  }

  .ab-toast.error .ab-toast__icon {
    color: #ff7875;
  }

  .ab-toast {
    box-shadow:
      0 6px 16px 0 rgb(0 0 0 / 32%),
      0 3px 6px -4px rgb(0 0 0 / 48%),
      0 9px 28px 8px rgb(0 0 0 / 20%);
  }

  .ab-toast:hover {
    box-shadow:
      0 8px 20px 0 rgb(0 0 0 / 36%),
      0 4px 8px -4px rgb(0 0 0 / 52%),
      0 12px 32px 8px rgb(0 0 0 / 24%);
  }
}

.ab-toastbar {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  gap: 14px;
  pointer-events: none;
}

.ab-toastbar.top-right {
  top: var(--ab-toast-offset-top, 16px);
  right: 16px;
}

.ab-toastbar.bottom-right {
  right: 16px;
  bottom: 16px;
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
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform, opacity;
  animation: ab-toast-slide-in var(--ab-toast-enter-duration)
    var(--ab-toast-enter-easing);
}

.ab-toast-leave-active {
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform, opacity;
  animation: ab-toast-slide-out var(--ab-toast-leave-duration)
    var(--ab-toast-leave-easing);
}

/* Toast 卡片样式 - 参考 Ant Design Alert */
.ab-toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 320px;
  max-width: 480px;

  /* ✅ 增加左侧 padding，为环形进度条预留空间 */
  padding: 12px 16px 6px 20px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5715;
  pointer-events: auto;

  /* ✅ 只过渡 box-shadow，避免和 Vue 动画冲突 - 使用统一配置 */
  transition: box-shadow 0.3s var(--ab-toast-shadow-easing);

  /* ✅ 允许环形进度条溢出显示（不使用 overflow: hidden） */
  overflow: visible;
  box-shadow:
    0 6px 16px 0 rgb(0 0 0 / 8%),
    0 3px 6px -4px rgb(0 0 0 / 12%),
    0 9px 28px 8px rgb(0 0 0 / 5%);
  overflow-wrap: break-word;
}

.ab-toast:hover {
  box-shadow:
    0 8px 20px 0 rgb(0 0 0 / 10%),
    0 4px 8px -4px rgb(0 0 0 / 14%),
    0 12px 32px 8px rgb(0 0 0 / 6%);
}

/* 图标容器（使用 Icon 组件） */
.ab-toast__icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  margin-top: 1px;
}

/* 内容区域 */
.ab-toast__content {
  flex: 1;
  min-width: 0;
}

.ab-toast__title {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: rgb(0 0 0 / 88%);
}

.ab-toast__message {
  font-size: 14px;
  line-height: 22px;
  color: rgb(0 0 0 / 88%);
}

/* ✅ 关闭按钮 */
.ab-toast__close {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 28px;
  height: 28px;
  margin: -4px -4px 0 0;
  padding: 0;
  border: none;
  border-radius: var(--border-radius-sm, 4px);
  outline: none;
  color: rgb(0 0 0 / 45%);
  background: transparent;
  cursor: pointer;

  /* ✅ 使用统一配置 */
  transition: all var(--ab-toast-leave-duration) var(--ab-toast-button-easing);
}

.ab-toast__close:hover {
  color: rgb(0 0 0 / 88%);
  background: rgb(0 0 0 / 6%);
}

.ab-toast__close:active {
  background: rgb(0 0 0 / 12%);
}

.ab-toast__close:focus-visible {
  outline: 2px solid var(--color-primary, #1677ff);
  outline-offset: 2px;
}

/* Success 样式 */
.ab-toast.success {
  border: 1px solid #b7eb8f;
  background: #f6ffed;
}

.ab-toast.success .ab-toast__icon {
  color: #52c41a;
}

/* Info 样式 */
.ab-toast.info {
  border: 1px solid #91caff;
  background: #e6f4ff;
}

.ab-toast.info .ab-toast__icon {
  color: #1677ff;
}

/* Warning 样式 */
.ab-toast.warning {
  border: 1px solid #ffe58f;
  background: #fffbe6;
}

.ab-toast.warning .ab-toast__icon {
  color: #faad14;
}

/* Error 样式 */
.ab-toast.error {
  border: 1px solid #ffccc7;
  background: #fff2f0;
}

.ab-toast.error .ab-toast__icon {
  color: #ff4d4f;
}
</style>
