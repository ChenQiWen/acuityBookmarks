/**
 * 事件流处理系统 - 基础设施层
 *
 * 职责：
 * - 提供事件合并和防抖功能
 * - 安全的事件派发机制
 * - 支持事件订阅和取消订阅
 * - 提供事件流管理
 */

type AnyDetail = Record<string, unknown> | undefined

/**
 * 事件监听器类型
 */
export type EventListener<T = any> = (detail: T) => void

/**
 * 事件流配置
 */
export interface EventStreamConfig {
  defaultWaitMs: number
  maxListeners: number
  enableLogging: boolean
}

/**
 * 事件流管理器
 */
export class EventStream {
  private config: EventStreamConfig
  private pendingTimers = new Map<string, number>()
  private lastDetails = new Map<string, AnyDetail>()
  private listeners = new Map<string, Set<EventListener>>()
  private eventHistory: Array<{
    name: string
    detail: AnyDetail
    timestamp: number
  }> = []

  constructor(config: Partial<EventStreamConfig> = {}) {
    this.config = {
      defaultWaitMs: 100,
      maxListeners: 100,
      enableLogging: false,
      ...config
    }
  }

  /**
   * 合并并派发自定义事件
   * 在 waitMs 窗口内仅派发一次，使用最后一次的 detail
   */
  dispatchCoalescedEvent(
    name: string,
    detail?: AnyDetail,
    waitMs?: number
  ): void {
    const delay = waitMs ?? this.config.defaultWaitMs

    this.lastDetails.set(name, detail)

    const existing = this.pendingTimers.get(name)
    if (existing) {
      clearTimeout(existing)
    }

    const id = window.setTimeout(
      () => {
        try {
          const finalDetail = this.lastDetails.get(name)
          this.dispatchEventInternal(name, finalDetail)
        } finally {
          this.pendingTimers.delete(name)
        }
      },
      Math.max(0, delay)
    )

    this.pendingTimers.set(name, id)
  }

  /**
   * 直接派发事件（无合并）
   * 用于低频或一次性事件
   */
  dispatchEventSafe(name: string, detail?: AnyDetail): void {
    this.dispatchEventInternal(name, detail)
  }

  /**
   * 订阅事件
   */
  on<T = any>(name: string, listener: EventListener<T>): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set())
    }

    const listeners = this.listeners.get(name)!

    if (listeners.size >= this.config.maxListeners) {
      console.warn(`EventStream: Too many listeners for event "${name}"`)
      return () => {}
    }

    listeners.add(listener as EventListener)

    if (this.config.enableLogging) {
      console.log(`EventStream: Added listener for "${name}"`)
    }

    // 返回取消订阅函数
    return () => {
      listeners.delete(listener as EventListener)
      if (listeners.size === 0) {
        this.listeners.delete(name)
      }

      if (this.config.enableLogging) {
        console.log(`EventStream: Removed listener for "${name}"`)
      }
    }
  }

  /**
   * 一次性事件订阅
   */
  once<T = any>(name: string, listener: EventListener<T>): () => void {
    const unsubscribe = this.on<T>(name, detail => {
      listener(detail)
      unsubscribe()
    })

    return unsubscribe
  }

  /**
   * 取消事件订阅
   */
  off(name: string, listener?: EventListener): void {
    if (!this.listeners.has(name)) {
      return
    }

    const listeners = this.listeners.get(name)!

    if (listener) {
      listeners.delete(listener)
    } else {
      listeners.clear()
    }

    if (listeners.size === 0) {
      this.listeners.delete(name)
    }
  }

  /**
   * 取消所有事件订阅
   */
  removeAllListeners(name?: string): void {
    if (name) {
      this.listeners.delete(name)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * 获取事件监听器数量
   */
  getListenerCount(name: string): number {
    return this.listeners.get(name)?.size ?? 0
  }

  /**
   * 获取所有事件名称
   */
  getEventNames(): string[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * 内部事件派发
   */
  private dispatchEventInternal(name: string, detail?: AnyDetail): void {
    // 记录事件历史
    this.eventHistory.push({
      name,
      detail,
      timestamp: Date.now()
    })

    // 限制历史记录大小
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-500)
    }

    // 派发到浏览器事件系统
    try {
      const evt = new CustomEvent(name, { detail })
      window.dispatchEvent(evt)
    } catch (error) {
      console.error(`EventStream: Failed to dispatch event "${name}"`, error)
    }

    // 通知订阅者
    const listeners = this.listeners.get(name)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(detail)
        } catch (error) {
          console.error(`EventStream: Error in listener for "${name}"`, error)
        }
      })
    }

    if (this.config.enableLogging) {
      console.log(`EventStream: Dispatched event "${name}"`, detail)
    }
  }

  /**
   * 获取事件历史
   */
  getEventHistory(name?: string): Array<{
    name: string
    detail: AnyDetail
    timestamp: number
  }> {
    if (name) {
      return this.eventHistory.filter(event => event.name === name)
    }
    return [...this.eventHistory]
  }

  /**
   * 清空事件历史
   */
  clearEventHistory(): void {
    this.eventHistory = []
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<EventStreamConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): EventStreamConfig {
    return { ...this.config }
  }

  /**
   * 销毁事件流
   */
  destroy(): void {
    // 清理所有定时器
    this.pendingTimers.forEach(id => clearTimeout(id))
    this.pendingTimers.clear()

    // 清理所有监听器
    this.listeners.clear()

    // 清理历史记录
    this.eventHistory = []

    // 清理最后详情
    this.lastDetails.clear()
  }
}

/**
 * 默认事件流实例
 */
export const eventStream = new EventStream()

/**
 * 便捷的事件派发函数（保持向后兼容）
 */
export function dispatchCoalescedEvent(
  name: string,
  detail?: AnyDetail,
  waitMs: number = 100
): void {
  eventStream.dispatchCoalescedEvent(name, detail, waitMs)
}

/**
 * 便捷的安全事件派发函数（保持向后兼容）
 */
export function dispatchEventSafe(name: string, detail?: AnyDetail): void {
  eventStream.dispatchEventSafe(name, detail)
}

/**
 * 便捷的事件订阅函数
 */
export function onEvent<T = any>(
  name: string,
  listener: EventListener<T>
): () => void {
  return eventStream.on(name, listener)
}

/**
 * 便捷的一次性事件订阅函数
 */
export function onceEvent<T = any>(
  name: string,
  listener: EventListener<T>
): () => void {
  return eventStream.once(name, listener)
}

/**
 * 便捷的事件取消订阅函数
 */
export function offEvent(name: string, listener?: EventListener): void {
  eventStream.off(name, listener)
}
