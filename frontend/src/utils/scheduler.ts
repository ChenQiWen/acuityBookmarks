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
      console.error('Microtask error:', e)
    })
}
