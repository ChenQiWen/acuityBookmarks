// 事件合并与安全派发工具
// 目标：在高频事件（如书签更新与DB同步）下合并短时间内的重复事件，降低UI抖动

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
