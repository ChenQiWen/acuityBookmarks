/**
 * 性能优化工具集
 * 基于产品文档的智能分析和高性能要求设计
 */

import { PERFORMANCE_CONFIG, BOOKMARK_CONFIG } from '../config/constants'
import { logger } from './logger'

// === 类型定义 ===
export interface DebounceOptions {
  leading?: boolean
  trailing?: boolean
  maxWait?: number
}

export interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export interface PerformanceMetrics {
  startTime: number
  endTime?: number
  duration?: number
  memoryUsage?: number
  operation: string
  metadata?: Record<string, string | number | boolean>
}

// === 防抖函数 ===
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number = PERFORMANCE_CONFIG.SEARCH_DEBOUNCE_TIME,
  options: DebounceOptions = {}
): T & { cancel(): void; flush(): void } {
  const { leading = false, trailing = true, maxWait } = options
  
  let timeoutId: number | null = null
  let maxTimeoutId: number | null = null
  let lastCallTime: number | undefined
  let lastInvokeTime = 0
  let lastArgs: Parameters<T> | undefined
  let lastThis: unknown
  let result: ReturnType<T>

  function invokeFunc(time: number): ReturnType<T> {
    const args = lastArgs!
    const thisArg = lastThis

    lastArgs = undefined
    lastThis = undefined
    lastInvokeTime = time
    result = func.apply(thisArg, args) as ReturnType<T>
    return result
  }

  function leadingEdge(time: number): ReturnType<T> {
    lastInvokeTime = time
    timeoutId = window.setTimeout(timerExpired, wait)
    return leading ? invokeFunc(time) : result
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - lastCallTime!
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = wait - timeSinceLastCall

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - lastCallTime!
    const timeSinceLastInvoke = time - lastInvokeTime

    return (lastCallTime === undefined || timeSinceLastCall >= wait ||
            timeSinceLastCall < 0 || (maxWait !== undefined && timeSinceLastInvoke >= maxWait))
  }

  function timerExpired(): void {
    const time = Date.now()
    if (shouldInvoke(time)) {
      trailingEdge(time)
    } else {
      timeoutId = window.setTimeout(timerExpired, remainingWait(time))
    }
  }

  function trailingEdge(time: number): ReturnType<T> {
    timeoutId = null

    if (trailing && lastArgs) {
      return invokeFunc(time)
    }
    lastArgs = undefined
    lastThis = undefined
    return result
  }

  function cancel(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId)
    }
    lastInvokeTime = 0
    lastArgs = undefined
    lastCallTime = undefined
    lastThis = undefined
    timeoutId = null
    maxTimeoutId = null
  }

  function flush(): ReturnType<T> {
    return timeoutId === null ? result : trailingEdge(Date.now())
  }

  function debounced(this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastThis = this
    lastCallTime = time

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(lastCallTime)
      }
      if (maxWait !== undefined) {
        timeoutId = window.setTimeout(timerExpired, wait)
        return invokeFunc(lastCallTime)
      }
    }
    if (timeoutId === null) {
      timeoutId = window.setTimeout(timerExpired, wait)
    }
    return result
  }

  debounced.cancel = cancel
  debounced.flush = flush
  return debounced as unknown as T & { cancel(): void; flush(): void }
}

// === 节流函数 ===
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number = PERFORMANCE_CONFIG.HOVER_DEBOUNCE_TIME,
  options: ThrottleOptions = {}
): T & { cancel(): void; flush(): void } {
  const { leading = true, trailing = true } = options
  return debounce(func, wait, { leading, trailing, maxWait: wait })
}

// === 性能监控 ===
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private observers: PerformanceObserver[] = []

  constructor() {
    // 初始化性能观察者
    if (typeof PerformanceObserver !== 'undefined') {
      this.initializeObservers()
    }
  }

  private initializeObservers(): void {
    try {
      // 监听长任务
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // 超过50ms的任务
            logger.warn('Performance', '检测到长任务', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            })
          }
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
      this.observers.push(longTaskObserver)

      // 监听导航性能
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.info('Performance', '页面导航性能', {
            domContentLoaded: (entry as PerformanceNavigationTiming).domContentLoadedEventEnd,
            loadComplete: (entry as PerformanceNavigationTiming).loadEventEnd,
            firstPaint: performance.getEntriesByType('paint').find(e => e.name === 'first-paint')?.startTime
          })
        }
      })
      navigationObserver.observe({ entryTypes: ['navigation'] })
      this.observers.push(navigationObserver)

    } catch (error) {
      logger.warn('Performance', '性能观察者初始化失败', { error })
    }
  }

  /**
   * 开始性能测量
   */
  startMeasure(operation: string, metadata?: Record<string, string | number | boolean>): void {
    const startTime = performance.now()
    this.metrics.set(operation, {
      startTime,
      operation,
      metadata,
      memoryUsage: this.getMemoryUsage()
    })
    
    logger.info('Performance', `开始测量: ${operation}`, metadata)
  }

  /**
   * 结束性能测量
   */
  endMeasure(operation: string): PerformanceMetrics | null {
    const metric = this.metrics.get(operation)
    if (!metric) {
      logger.warn('Performance', `未找到测量起点: ${operation}`)
      return null
    }

    const endTime = performance.now()
    const duration = endTime - metric.startTime
    const finalMetric = {
      ...metric,
      endTime,
      duration,
      memoryUsage: this.getMemoryUsage()
    }

    this.metrics.delete(operation)
    
    // 记录性能数据
    if (duration > 100) { // 超过100ms的操作
      logger.warn('Performance', `缓慢操作: ${operation}`, {
        duration: `${duration.toFixed(2)}ms`,
        metadata: metric.metadata
      })
    } else {
      logger.info('Performance', `完成测量: ${operation}`, {
        duration: `${duration.toFixed(2)}ms`
      })
    }

    return finalMetric
  }

  /**
   * 测量异步操作
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, string | number | boolean>
  ): Promise<T> {
    this.startMeasure(operation, metadata)
    try {
      const result = await fn()
      this.endMeasure(operation)
      return result
    } catch (error) {
      this.endMeasure(operation)
      throw error
    }
  }

  /**
   * 测量同步操作
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, string | number | boolean>
  ): T {
    this.startMeasure(operation, metadata)
    try {
      const result = fn()
      this.endMeasure(operation)
      return result
    } catch (error) {
      this.endMeasure(operation)
      throw error
    }
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      return (performance as any).memory?.usedJSHeapSize
    }
    return undefined
  }

  /**
   * 获取所有活跃的测量
   */
  getActiveMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values())
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.length = 0
    this.metrics.clear()
  }
}

// === 单例性能监控器 ===
export const performanceMonitor = new PerformanceMonitor()

// === 大数据集处理优化 ===

/**
 * 分块处理大数组 - 避免阻塞UI
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T, index: number) => R | Promise<R>,
  chunkSize: number = BOOKMARK_CONFIG.BATCH_PROCESS_SIZE,
  delayBetweenChunks: number = 10
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    
    // 处理当前块
    const chunkResults = await Promise.all(
      chunk.map((item, chunkIndex) => processor(item, i + chunkIndex))
    )
    
    results.push(...chunkResults)
    
    // 如果还有更多数据，让出控制权
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenChunks))
    }
  }

  return results
}

/**
 * 虚拟滚动辅助函数
 */
export interface VirtualScrollState {
  startIndex: number
  endIndex: number
  visibleItems: unknown[]
  totalHeight: number
  offsetY: number
}

export function calculateVirtualScroll(
  totalItems: number,
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  overscan: number = 5
): VirtualScrollState {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2)
  
  return {
    startIndex,
    endIndex,
    visibleItems: [], // 由调用者填充
    totalHeight: totalItems * itemHeight,
    offsetY: startIndex * itemHeight
  }
}

// === 内存管理 ===

/**
 * 弱引用缓存 - 自动内存回收
 */
export class WeakCache<K extends object, V> {
  private cache = new WeakMap<K, V>()

  set(key: K, value: V): void {
    this.cache.set(key, value)
  }

  get(key: K): V | undefined {
    return this.cache.get(key)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }
}

/**
 * LRU缓存 - 限制大小的缓存
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>()
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  set(key: K, value: V): void {
    // 如果key已存在，先删除（会重新插入到末尾）
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的项（Map的第一个）
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, value)
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // 移到末尾（表示最近使用）
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// === 资源清理助手 ===

/**
 * 清理助手 - 自动管理资源清理
 */
export class CleanupHelper {
  private cleanupFunctions: Array<() => void> = []

  /**
   * 添加清理函数
   */
  add(cleanupFn: () => void): void {
    this.cleanupFunctions.push(cleanupFn)
  }

  /**
   * 执行所有清理函数
   */
  cleanup(): void {
    for (const cleanupFn of this.cleanupFunctions) {
      try {
        cleanupFn()
      } catch (error) {
        logger.warn('Performance', '清理函数执行失败', { error })
      }
    }
    this.cleanupFunctions.length = 0
  }
}

// === 导出常用的防抖/节流实例 ===
export const debouncedSearch = debounce(() => {}, PERFORMANCE_CONFIG.SEARCH_DEBOUNCE_TIME)
export const debouncedHover = debounce(() => {}, PERFORMANCE_CONFIG.HOVER_DEBOUNCE_TIME)
export const throttledScroll = throttle(() => {}, 16) // 60fps

// === 页面可见性优化 ===
export class VisibilityManager {
  private isVisible = true
  private callbacks: Array<(visible: boolean) => void> = []

  constructor() {
    this.setupVisibilityListener()
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden
      this.callbacks.forEach(callback => {
        try {
          callback(this.isVisible)
        } catch (error) {
          logger.warn('Performance', '可见性回调执行失败', { error })
        }
      })
    })
  }

  onVisibilityChange(callback: (visible: boolean) => void): () => void {
    this.callbacks.push(callback)
    
    // 返回取消订阅函数
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }

  get visible(): boolean {
    return this.isVisible
  }
}

export const visibilityManager = new VisibilityManager()