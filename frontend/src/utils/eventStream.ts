/*
 * 事件合并与安全派发（Event Stream Utilities）
 *
 * 职责：
 * - 在高频事件（如书签更新/DB同步）场景下合并短时间内重复事件；
 * - 降低 UI 抖动，确保下游仅接收稳定的事件流；
 * - 提供 dispatchCoalescedEvent（合并）与 dispatchEventSafe（直接派发）。
 *
 * 设计原则：
 * - 合并窗口 waitMs 内仅派发一次，取最后一次的 detail；
 * - 依赖浏览器环境的 window 与 CustomEvent，保持模块轻量与纯前端；
 *
 * 边界与约束：
 * - 不跨线程，不使用 BroadcastChannel；若需 Worker/Service Worker，请交由适配层处理；
 * - 不持久化状态，不做事件重试或缓存。
 */

type AnyDetail = Record<string, unknown> | undefined

const pendingTimers = new Map<string, number>()
const lastDetails = new Map<string, AnyDetail>()

/**
 * 合并并派发自定义事件：在 waitMs 窗口内仅派发一次，使用最后一次的 detail
 */
export function dispatchCoalescedEvent(
  name: string,
  detail?: AnyDetail,
  waitMs: number = 100
) {
  lastDetails.set(name, detail)
  const existing = pendingTimers.get(name)
  if (existing) {
    clearTimeout(existing)
  }
  const id = window.setTimeout(
    () => {
      try {
        const d = lastDetails.get(name)
        const evt = new CustomEvent(name, { detail: d })
        window.dispatchEvent(evt)
      } finally {
        pendingTimers.delete(name)
      }
    },
    Math.max(0, waitMs)
  )
  pendingTimers.set(name, id)
}

/**
 * 直接派发（无合并），用于低频或一次性事件
 */
export function dispatchEventSafe(name: string, detail?: AnyDetail) {
  const evt = new CustomEvent(name, { detail })
  window.dispatchEvent(evt)
}
