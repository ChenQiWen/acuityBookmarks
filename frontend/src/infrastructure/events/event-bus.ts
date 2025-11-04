/**
 * 应用级事件总线（基于 mitt）
 *
 * 职责：
 * - 提供类型安全的事件发布/订阅
 * - 解耦组件间通信
 * - 统一管理应用级事件
 *
 * 使用场景：
 * - 跨组件通信（替代 props drilling）
 * - Background Script 到前端的消息传递
 * - 数据同步事件通知
 */

import mitt from 'mitt'
import type { BookmarkNode } from '@/types/domain/bookmark'

/**
 * 应用事件类型定义
 *
 * 所有事件都需要在这里定义类型，确保类型安全
 */
export interface AppEvents extends Record<string | symbol, unknown> {
  /**
   * 书签创建事件
   */
  'bookmark:created': {
    id: string
    bookmark: BookmarkNode
  }

  /**
   * 书签更新事件
   */
  'bookmark:updated': {
    id: string
    changes: Partial<BookmarkNode>
  }

  /**
   * 书签删除事件
   */
  'bookmark:deleted': {
    id: string
  }

  /**
   * 书签移动事件
   */
  'bookmark:moved': {
    id: string
    oldParentId: string
    newParentId: string
    oldIndex: number
    newIndex: number
  }

  /**
   * 数据同步完成事件
   * （从 Background Script 同步到 IndexedDB）
   */
  'data:synced': {
    eventType: 'created' | 'changed' | 'moved' | 'removed'
    bookmarkId: string
    timestamp: number
  }

  /**
   * 全量同步开始事件
   */
  'sync:started': {
    source: 'background' | 'user' | 'auto'
  }

  /**
   * 全量同步完成事件
   */
  'sync:completed': {
    duration: number
    count: number
  }

  /**
   * 同步失败事件
   */
  'sync:failed': {
    error: Error
  }

  /**
   * 数据健康检查完成事件
   */
  'health:checked': {
    healthy: boolean
    issues: string[]
  }

  /**
   * 通知事件（替代原有的通知系统）
   */
  'notification:show': {
    title: string
    message: string
    level: 'info' | 'success' | 'warning' | 'error'
  }

  /**
   * 侧边栏状态变更事件（页面内同步）
   */
  'sidepanel:state-changed': {
    isOpen: boolean
  }

  /**
   * 用户登录事件
   */
  'auth:logged-in': {
    email?: string
    tier?: 'free' | 'pro'
  }

  /**
   * 用户退出登录事件
   */
  'auth:logged-out': Record<string, never>
}

/**
 * 全局事件总线实例
 */
export const eventBus = mitt<AppEvents>()

/**
 * 类型安全的事件发射函数
 *
 * @example
 * ```typescript
 * emitEvent('bookmark:created', {
 *   id: '123',
 *   bookmark: { ... }
 * })
 * ```
 */
export function emitEvent<K extends keyof AppEvents>(
  type: K,
  payload: AppEvents[K]
) {
  eventBus.emit(type, payload)
}

/**
 * 类型安全的事件监听函数
 *
 * @returns 取消监听的函数
 *
 * @example
 * ```typescript
 * const unsubscribe = onEvent('bookmark:created', (data) => {
 *   console.log('书签创建:', data.id)
 * })
 *
 * // 取消监听
 * unsubscribe()
 * ```
 */
export function onEvent<K extends keyof AppEvents>(
  type: K,
  handler: (payload: AppEvents[K]) => void
): () => void {
  eventBus.on(type, handler)

  // 返回取消监听的函数
  return () => {
    eventBus.off(type, handler)
  }
}

/**
 * 一次性事件监听
 *
 * @example
 * ```typescript
 * onceEvent('sync:completed', (data) => {
 *   console.log('同步完成，耗时:', data.duration)
 * })
 * ```
 */
export function onceEvent<K extends keyof AppEvents>(
  type: K,
  handler: (payload: AppEvents[K]) => void
) {
  const wrapper = (payload: AppEvents[K]) => {
    handler(payload)
    eventBus.off(type, wrapper)
  }

  eventBus.on(type, wrapper)
}

/**
 * 清除所有事件监听器
 *
 * ⚠️ 谨慎使用，通常只在应用卸载时调用
 */
export function clearAllListeners() {
  eventBus.all.clear()
}
