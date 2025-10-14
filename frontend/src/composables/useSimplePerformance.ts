/**
 * 🚀 简化版性能优化组合式函数
 *
 * 提供基础性能优化功能，避免复杂的类型问题
 */

import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from 'vue'

/**
 * 防抖函数
 */
export function useDebounce<T extends object>(value: T, delay: number) {
  const debouncedValue = ref(value)
  let timeoutId: number | null = null

  const updateValue = (newValue: T) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      debouncedValue.value = newValue
      timeoutId = null
    }, delay)
  }

  watch(value, updateValue)

  return debouncedValue
}

/**
 * 节流函数
 */
export function useThrottle<T extends object>(value: T, delay: number) {
  const throttledValue = ref(value)
  let lastUpdate = 0

  const updateValue = (newValue: T) => {
    const now = Date.now()
    if (now - lastUpdate >= delay) {
      throttledValue.value = newValue
      lastUpdate = now
    }
  }

  watch(value, updateValue)

  return throttledValue
}

/**
 * 虚拟滚动组合式函数
 */
export function useVirtualScroll<T>(
  items: T[],
  options: {
    itemHeight?: number
    containerHeight?: number
    overscan?: number
  } = {}
) {
  const { itemHeight = 32, containerHeight = 400, overscan = 5 } = options

  const scrollTop = ref(0)
  const containerRef = ref<HTMLElement>()

  const visibleRange = computed(() => {
    const start = Math.floor(scrollTop.value / itemHeight)
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    )
    return {
      start: Math.max(0, start - overscan),
      end
    }
  })

  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    return items.slice(start, end).map((item, index) => ({
      item,
      index: start + index
    }))
  })

  const totalHeight = computed(() => items.length * itemHeight)

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement
    scrollTop.value = target.scrollTop
  }

  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener('scroll', handleScroll, {
        passive: true
      })
    }
  })

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', handleScroll)
    }
  })

  return {
    containerRef,
    visibleItems,
    totalHeight,
    scrollTop,
    visibleRange
  }
}

/**
 * 懒加载组合式函数
 */
export function useLazyLoad() {
  const isVisible = ref(false)
  const isLoaded = ref(false)
  const elementRef = ref<HTMLElement>()

  const load = () => {
    if (!isLoaded.value) {
      isLoaded.value = true
    }
  }

  onMounted(() => {
    if (elementRef.value) {
      const observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              load()
              observer.unobserve(entry.target)
            }
          }
        },
        { rootMargin: '50px', threshold: 0.1 }
      )
      observer.observe(elementRef.value)
    }
  })

  return {
    elementRef,
    isVisible,
    isLoaded,
    load
  }
}

/**
 * 性能监控组合式函数
 */
export function usePerformanceMonitor(componentName: string) {
  const metrics = ref({
    renderTime: 0,
    updateTime: 0,
    memoryUsage: 0
  })

  const startRender = () => {
    performance.mark(`${componentName}-render`)
  }

  const endRender = () => {
    const duration = performance.measure(
      `${componentName}-render`,
      `${componentName}-render`
    )
    metrics.value.renderTime = duration.duration
  }

  const startUpdate = () => {
    performance.mark(`${componentName}-update`)
  }

  const endUpdate = () => {
    const duration = performance.measure(
      `${componentName}-update`,
      `${componentName}-update`
    )
    metrics.value.updateTime = duration.duration
  }

  const updateMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (
        performance as unknown as {
          memory: { usedJSHeapSize: number; totalJSHeapSize: number }
        }
      ).memory
      metrics.value.memoryUsage =
        (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    }
  }

  onMounted(() => {
    startRender()
    nextTick(() => {
      endRender()
      updateMemoryUsage()
    })
  })

  return {
    metrics,
    startRender,
    endRender,
    startUpdate,
    endUpdate,
    updateMemoryUsage
  }
}

/**
 * 内存管理组合式函数
 */
export function useMemoryManagement() {
  const memoryUsage = ref({ used: 0, total: 0, percentage: 0 })
  const shouldOptimize = ref(false)

  const updateMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (
        performance as unknown as {
          memory: { usedJSHeapSize: number; totalJSHeapSize: number }
        }
      ).memory
      memoryUsage.value = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      }
      shouldOptimize.value = memoryUsage.value.percentage > 70
    }
  }

  const cleanup = () => {
    // 强制垃圾回收（如果可用）
    if (
      'gc' in window &&
      typeof (window as unknown as { gc?: () => void }).gc === 'function'
    ) {
      ;(window as unknown as { gc: () => void }).gc()
    }
  }

  // 定期更新内存使用情况
  let intervalId: number
  onMounted(() => {
    intervalId = setInterval(updateMemoryUsage, 5000) // 每5秒更新一次
  })

  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId)
    }
    cleanup()
  })

  return {
    memoryUsage,
    shouldOptimize,
    updateMemoryUsage,
    cleanup
  }
}

/**
 * 响应式优化组合式函数
 */
export function useReactiveOptimization<T>(data: T) {
  return shallowRef(data)
}

// 导入 nextTick
import { nextTick } from 'vue'
