<template>
  <teleport to="body">
    <div class="ab-toastbar" :class="positionClass" aria-live="polite" aria-atomic="true">
      <transition-group name="ab-toast" tag="div">
        <div v-for="t in toasts" :key="t.id" class="ab-toast" :class="t.level" @mouseenter="pause(t.id)" @mouseleave="resume(t.id)">
          <div class="ab-toast__icon" aria-hidden="true">
            <span v-if="t.level==='success'">✔︎</span>
            <span v-else-if="t.level==='error'">✖︎</span>
            <span v-else-if="t.level==='warning'">⚠︎</span>
            <span v-else>ℹ︎</span>
          </div>
          <div class="ab-toast__content">
            <div class="ab-toast__title">{{ t.title || defaultTitle }}</div>
            <div class="ab-toast__message">{{ t.message }}</div>
          </div>
          <button class="ab-toast__close" @click="close(t.id)" aria-label="关闭">×</button>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { reactive, computed, onBeforeUnmount } from 'vue'

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

const props = defineProps<{ position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'; defaultTitle?: string }>()
const defaultTitle = computed(() => props.defaultTitle ?? 'AcuityBookmarks')

const state = reactive({
  toasts: [] as ToastItem[]
})

const toasts = computed(() => state.toasts)

function close(id: string) {
  state.toasts = state.toasts.filter(t => t.id !== id)
}

function pause(id: string) {
  const t = state.toasts.find(x => x.id === id)
  if (!t || t.paused) return
  t.paused = true
  const elapsed = Date.now() - (t.startedAt || Date.now())
  t.remaining = Math.max(0, (t.remaining ?? t.timeoutMs) - elapsed)
}

function resume(id: string) {
  const t = state.toasts.find(x => x.id === id)
  if (!t || !t.paused) return
  t.paused = false
  scheduleAutoClose(t)
}

function showToast(message: string, opts?: { title?: string; level?: Level; timeoutMs?: number }) {
  const id = Math.random().toString(36).slice(2)
  const level: Level = opts?.level || 'info'
  const timeoutMs = Math.max(0, opts?.timeoutMs ?? 2500)
  const item: ToastItem = { id, message, title: opts?.title, level, timeoutMs, startedAt: Date.now(), remaining: timeoutMs }
  state.toasts.push(item)
  if (timeoutMs > 0) scheduleAutoClose(item)
  return id
}

function scheduleAutoClose(t: ToastItem) {
  const ms = t.remaining ?? t.timeoutMs
  if (ms <= 0) return close(t.id)
  const handle = setTimeout(() => { if (!t.paused) close(t.id) }, ms)
  // 避免内存泄漏：当手动关闭/组件卸载时清理
  ;(t as any).__timer = handle
}

onBeforeUnmount(() => {
  for (const t of state.toasts) {
    const h = (t as any).__timer
    if (h) clearTimeout(h)
  }
})

const positionClass = computed(() => props.position ?? 'top-right')

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
.ab-toastbar.top-right { top: 12px; right: 12px; }
.ab-toastbar.bottom-right { bottom: 12px; right: 12px; }
.ab-toastbar.top-left { top: 12px; left: 12px; }
.ab-toastbar.bottom-left { bottom: 12px; left: 12px; }

.ab-toast-enter-active, .ab-toast-leave-active { transition: all .18s ease; }
.ab-toast-enter-from { opacity: 0; transform: translateY(-6px); }
.ab-toast-leave-to { opacity: 0; transform: translateY(-6px); }

.ab-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 260px;
  max-width: 420px;
  background: var(--ab-toast-bg, #fff);
  color: var(--ab-toast-fg, #333);
  border: 1px solid var(--ab-toast-border, rgba(0,0,0,.1));
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 14px rgba(0,0,0,.08);
  margin-bottom: 10px;
}

.ab-toast__icon { font-size: 18px; line-height: 1; margin-top: 2px; }
.ab-toast__title { font-weight: 600; font-size: 13px; line-height: 1.2; }
.ab-toast__message { font-size: 13px; opacity: .9; margin-top: 2px; }
.ab-toast__close { border: none; background: transparent; color: inherit; cursor: pointer; font-size: 16px; margin-left: 6px; }

.ab-toast.success { border-color: rgba(16, 185, 129, .35); }
.ab-toast.warning { border-color: rgba(245, 158, 11, .35); }
.ab-toast.error { border-color: rgba(239, 68, 68, .35); }
</style>
