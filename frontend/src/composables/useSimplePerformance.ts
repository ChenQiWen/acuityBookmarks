/**
 * 🚀 简化版性能优化组合式函数
 *
 * 提供基础性能优化功能，避免复杂的类型问题
 */

import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from 'vue'

/**
 * 防抖函数
 */
/**
 * 对传入的响应式数据做防抖处理
 *
 * @description
 * 在高频输入场景（如筛选输入框）中，直接 watch 原值可能导致过多的业务调用。
 * 通过防抖，只在指定的延迟时间后输出最近一次的值，从而降低计算压力。
 *
 * @param value 原始的响应式数据源，推荐传入 `ref` 或 `computed`
 * @param delay 防抖的延迟时间，单位为毫秒
 * @returns 一个新的 `ref`，其值在延迟后更新
 */
export function useDebounce<T extends object>(value: T, delay: number) {
  const debouncedValue = ref(value)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

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
/**
 * 对传入的响应式数据做节流处理
 *
 * @description
 * 适用于滚动、窗口尺寸变化等持续触发的场景。节流只会在间隔时间到达后更新一次值，
 * 可有效避免不必要的重新渲染。
 *
 * @param value 原始的响应式数据源
 * @param delay 节流的时间间隔，单位为毫秒
 * @returns 一个新的 `ref`，在节流策略下更新
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
/**
 * 基础虚拟滚动能力
 *
 * @description
 * 当列表数据量较大时，全部渲染会导致性能急剧下降。该组合函数根据视窗位置只返回
 * 当前需要渲染的切片数据，并提供容器高度、滚动位置等辅助信息。
 *
 * @param items 原始列表数据
 * @param options 虚拟滚动参数：条目高度、容器高度以及 overscan 数量
 * @returns 包含可视数据、滚动范围、容器引用等信息的对象
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
/**
 * 懒加载能力
 *
 * @description
 * 借助 `IntersectionObserver` 检测元素进入视窗，适用于图片、模块的按需加载。
 * 在元素第一次进入视窗后会停止观察，以避免重复触发。
 *
 * @returns 提供元素引用、加载状态、控制方法等
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
/**
 * 组件级性能监控
 *
 * @description
 * 使用 `performance` API 测量组件渲染与更新耗时，并可主动同步内存占用。
 * 可在调试性能瓶颈、动态上报指标时复用。
 *
 * @param componentName 组件或场景名称，用于生成唯一的性能标记
 * @returns 包含性能指标与手动测量方法的对象
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
/**
 * 运行时内存管理辅助
 *
 * @description
 * 持续侦测浏览器 JS 堆使用率，超过阈值时提示需要优化；在组件卸载时尝试执行垃圾回收
 * （若浏览器提供 `gc`）以释放内存。
 *
 * @returns 返回内存占用、是否需要优化、主动更新与清理函数
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
  let intervalId: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    intervalId = setInterval(updateMemoryUsage, 5000) // 每5秒更新一次
  })

  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
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
/**
 * 响应式优化辅助
 *
 * @description
 * 对传入的对象使用 `shallowRef` 包裹，减少深层响应式的性能开销，
 * 适用于仅关心顶层引用变化的场景。
 *
 * @param data 原始数据对象
 * @returns 以 `shallowRef` 包裹后的数据引用
 */
export function useReactiveOptimization<T>(data: T) {
  return shallowRef(data)
}

// 导入 nextTick
import { nextTick } from 'vue'
