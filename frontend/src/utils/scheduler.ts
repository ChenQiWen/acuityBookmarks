/**
 * 任务调度工具
 *
 * 能力：
 * - 优先使用 `requestIdleCallback` 安排 UI 空闲时执行，降低阻塞；
 * - 回退到 `setTimeout`，确保在缺少 RIC 的环境仍能让出主线程；
 * - 提供微任务调度接口，便于安全地串联异步逻辑。
 */
export interface ScheduleOptions {
  timeout?: number
}

export function scheduleUIUpdate(
  fn: () => void,
  options: ScheduleOptions = {}
) {
  const { timeout = 100 } = options
  try {
    // Prefer requestIdleCallback if available
    const ric = (
      globalThis as unknown as {
        requestIdleCallback?: typeof requestIdleCallback
      }
    ).requestIdleCallback as
      | ((
          cb: (deadline: { timeRemaining: () => number }) => void,
          opts?: { timeout: number }
        ) => number)
      | undefined
    if (typeof ric === 'function') {
      ric(
        () => {
          try {
            fn()
          } catch {}
        },
        { timeout }
      )
      return
    }
  } catch {}
  // Fallback to a short timeout to yield the UI thread
  setTimeout(
    () => {
      try {
        fn()
      } catch {}
    },
    Math.min(timeout, 50)
  )
}

export function scheduleMicrotask(fn: () => void) {
  Promise.resolve()
    .then(() => fn())
    .catch(e => {
      // 统一错误降噪：避免直接抛出影响上层逻辑
      console.error('Microtask error:', e)
    })
}
