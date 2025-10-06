<template>
  <teleport to="body">
  <div class="ab-toastbar" :class="positionClass" :style="containerStyle" aria-live="polite" aria-atomic="true">
      <transition-group name="ab-toast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="ab-toast"
          :class="[t.level, { paused: !!t.paused }]"
          :style="{ '--ab-toast-duration': (t.timeoutMs + 'ms') }"
          @mouseenter="pause(t.id)"
          @mouseleave="resume(t.id)"
        >
          <div class="ab-toast__icon" aria-hidden="true">
            <span class="ab-toast__icon-badge" :class="t.level">
              <span v-if="t.level==='success'">✔︎</span>
              <span v-else-if="t.level==='error'">✖︎</span>
              <span v-else-if="t.level==='warning'">⚠︎</span>
              <span v-else>ℹ︎</span>
            </span>
          </div>
          <div class="ab-toast__content">
            <div class="ab-toast__title">{{ t.title || defaultTitle }}</div>
            <div class="ab-toast__message">{{ t.message }}</div>
          </div>
          <button class="ab-toast__close" @click="close(t.id)" :aria-label="closeLabel">×</button>
          <div
            class="ab-toast__progress"
            aria-hidden="true"
            :ref="(el) => setProgressRef(t.id, el as unknown as HTMLElement)"
          />
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { reactive, computed, onBeforeUnmount, nextTick } from 'vue'
import { t as i18n } from '@/utils/i18n'

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
  defaultTitle?: string
  /** 顶部偏移（像素），用于避免遮挡右上角按钮 */
  offsetTop?: number
  /** 安全关闭的最大生命周期（毫秒）；到时即使悬停也会关闭 */
  maxLifetimeMs?: number
}>()
const defaultTitle = computed(() => props.defaultTitle ?? 'AcuityBookmarks')

const state = reactive({
  toasts: [] as ToastItem[]
})

// Keep element refs for precise control of the progress animation
const progressRefs = new Map<string, HTMLElement>()

function setProgressRef(id: string, el: HTMLElement | null) {
  if (!el) {
    progressRefs.delete(id)
    return
  }
  progressRefs.set(id, el)
}

function getToastById(id: string) {
  return state.toasts.find(x => x.id === id) as (ToastItem & { __timer?: any; __safetyTimer?: any }) | undefined
}

function applyProgressStyle(id: string) {
  const t = getToastById(id)
  const el = progressRefs.get(id)
  if (!t || !el) return
  const total = t.timeoutMs
  const remaining = Math.max(0, t.remaining ?? total)
  const elapsed = Math.max(0, total - remaining)
  // Update longhands so we can control timeline precisely; keep animation-name from CSS
  el.style.animationDuration = `${total}ms`
  el.style.animationDelay = `-${elapsed}ms`
  el.style.animationPlayState = t.paused ? 'paused' : 'running'
}

const toasts = computed(() => state.toasts)

function close(id: string) {
  const t = state.toasts.find(x => x.id === id) as (ToastItem & { __timer?: any; __safetyTimer?: any }) | undefined
  if (t?.__timer) try { clearTimeout(t.__timer) } catch {}
  if (t?.__safetyTimer) try { clearTimeout(t.__safetyTimer) } catch {}
  state.toasts = state.toasts.filter(t => t.id !== id)
}

function pause(id: string) {
  const t = getToastById(id)
  if (!t || t.paused) return
  const now = Date.now()
  const elapsed = now - (t.startedAt || now)
  t.remaining = Math.max(0, (t.remaining ?? t.timeoutMs) - elapsed)
  // 取消当前倒计时，等待恢复时重新计时
  try { if (t.__timer) clearTimeout(t.__timer) } catch {}
  t.paused = true
  // Clear inline overrides to avoid compounding when resuming; keep paused visual
  const el = progressRefs.get(id)
  if (el) {
    el.style.animationPlayState = 'paused'
    el.style.animationDuration = ''
    el.style.animationDelay = ''
  }
}

function resume(id: string) {
  const t = getToastById(id)
  if (!t || !t.paused) return
  t.paused = false
  t.startedAt = Date.now()
  scheduleAutoClose(t)
  // Re-sync progress bar animation to the remaining time
  nextTick(() => applyProgressStyle(id))
}

function showToast(message: string, opts?: { title?: string; level?: Level; timeoutMs?: number }) {
  const id = Math.random().toString(36).slice(2)
  const level: Level = opts?.level || 'info'
  const timeoutMs = Math.max(0, opts?.timeoutMs ?? 2500)
  const item: ToastItem = { id, message, title: opts?.title, level, timeoutMs, startedAt: Date.now(), remaining: timeoutMs }
  state.toasts.push(item)
  if (timeoutMs > 0) scheduleAutoClose(item)
  // Ensure initial progress timeline is synced to 0 elapsed
  nextTick(() => applyProgressStyle(id))
  return id
}

function scheduleAutoClose(t: ToastItem) {
  const tt = t as ToastItem & { __timer?: any; __safetyTimer?: any }
  const ms = tt.remaining ?? tt.timeoutMs
  if (ms <= 0) return close(tt.id)
  try { if (tt.__timer) clearTimeout(tt.__timer) } catch {}
  const handle = setTimeout(() => {
    // Look up live toast at execution time to avoid stale closure on paused flag
    const live = getToastById(tt.id)
    if (!live) return
    if (!live.paused) close(live.id)
  }, ms)
  ;(tt as any).__timer = handle
  // 安全关闭：到达最大生命周期后强制关闭（忽略悬停）
  const baseStart = tt.startedAt || Date.now()
  const maxMs = Math.max(tt.timeoutMs, props.maxLifetimeMs ?? 6000)
  const remainingToMax = Math.max(0, baseStart + maxMs - Date.now())
  if (remainingToMax > 0) {
    try { if (tt.__safetyTimer) clearTimeout(tt.__safetyTimer) } catch {}
    const safety = setTimeout(() => close(tt.id), remainingToMax)
    ;(tt as any).__safetyTimer = safety
  }
}

onBeforeUnmount(() => {
  for (const t of state.toasts) {
    const h = (t as any).__timer
    if (h) try { clearTimeout(h) } catch {}
    const s = (t as any).__safetyTimer
    if (s) try { clearTimeout(s) } catch {}
  }
})

const positionClass = computed(() => props.position ?? 'top-right')
const containerStyle = computed(() => {
  // 仅对 top-* 应用偏移
  const top = (props.position?.startsWith('top-') ?? true) ? (props.offsetTop ?? 56) : undefined
  return top !== undefined ? ({ '--ab-toast-offset-top': `${top}px` } as any) : undefined
})

const closeLabel = computed(() => i18n('toast.close') || 'Close')

// 暴露方法供管理器调用
defineExpose({ showToast, close })
</script>

<style scoped>
.ab-toastbar {
  position: fixed;
  z-index: 2147483000; /* 高于常见组件 */
  pointer-events: none;
  padding: 12px;
}
.ab-toastbar.top-right { top: var(--ab-toast-offset-top, 12px); right: 12px; }
.ab-toastbar.bottom-right { bottom: 12px; right: 12px; }
.ab-toastbar.top-left { top: var(--ab-toast-offset-top, 12px); left: 12px; }
.ab-toastbar.bottom-left { bottom: 12px; left: 12px; }

.ab-toast-enter-active { transition: opacity var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard), transform var(--md-sys-motion-duration-short4) cubic-bezier(.22,.61,.36,1); }
.ab-toast-leave-active { transition: opacity var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard), transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard); }
.ab-toast-enter-from { opacity: 0; transform: translateY(var(--spacing-sm)) scale(.98); }
.ab-toast-leave-to { opacity: 0; transform: translateY(-6px) scale(.98); }

@media (prefers-reduced-motion: reduce) {
  .ab-toast-enter-active, .ab-toast-leave-active { transition: none; }
}

.ab-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 260px;
  max-width: 420px;
  background: var(--ab-toast-bg, #fff);
  color: var(--ab-toast-fg, #1f2937);
  border: 1px solid var(--ab-toast-border, rgba(0,0,0,.08));
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 var(--spacing-sm) 24px rgba(0,0,0,.08);
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
  will-change: transform, opacity;
}

.ab-toast:hover { box-shadow: 0 10px 28px rgba(0,0,0,.12); }

/* 左侧强调条 */
.ab-toast::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: currentColor;
}

.ab-toast__icon { font-size: 0; line-height: 0; margin-top: 2px; }
.ab-toast__icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 14px;
  color: #fff;
}
.ab-toast__title { font-weight: 600; font-size: var(--text-base); line-height: 1.2; }
.ab-toast__message { font-size: var(--text-base); opacity: .9; margin-top: var(--spacing-0-5); }
.ab-toast__close {
  border: none; background: transparent; color: inherit;
  cursor: pointer; font-size: var(--font-size-lg); margin-left: var(--spacing-1-5);
  opacity: .7; transition: opacity var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard); line-height: 1;
}
.ab-toast__close:hover { opacity: 1; }

/* 底部进度条 */
.ab-toast__progress {
  position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
  background: currentColor;
  transform-origin: left center;
  animation: ab-toast-progress var(--ab-toast-duration) linear forwards;
}
.ab-toast.paused .ab-toast__progress { animation-play-state: paused; }

@keyframes ab-toast-progress {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* 语义颜色（可接入 CSS 变量主题） */
:root {
  --ab-success: #16a34a;
  --ab-info: #2563eb;
  --ab-warning: #d97706;
  --ab-error: #dc2626;
}

.ab-toast.info { color: var(--ab-info); }
.ab-toast.success { color: var(--ab-success); }
.ab-toast.warning { color: var(--ab-warning); }
.ab-toast.error { color: var(--ab-error); }

.ab-toast.info .ab-toast__icon-badge { background: var(--ab-info); }
.ab-toast.success .ab-toast__icon-badge { background: var(--ab-success); }
.ab-toast.warning .ab-toast__icon-badge { background: var(--ab-warning); }
.ab-toast.error .ab-toast__icon-badge { background: var(--ab-error); }

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .ab-toast {
    --ab-toast-bg: #111827; /* slate-900 */
    --ab-toast-fg: #e5e7eb; /* gray-200 */
    --ab-toast-border: rgba(255,255,255,.08);
    box-shadow: 0 14px 34px rgba(0,0,0,.5);
  }
  .ab-toast__message { opacity: .92; }
  .ab-toast__close { opacity: .75; }
  .ab-toast:hover { box-shadow: 0 18px 40px rgba(0,0,0,.6); }

  /* 降低饱和度的语义色（Dark） */
  :root {
    --ab-success: #34d399; /* green-400 */
    --ab-info: #60a5fa;    /* blue-400  */
    --ab-warning: #fbbf24; /* amber-400 */
    --ab-error: #f87171;   /* red-400   */
  }
}
</style>
