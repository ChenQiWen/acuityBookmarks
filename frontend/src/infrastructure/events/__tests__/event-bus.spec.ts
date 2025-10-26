/**
 * 事件总线测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { emitEvent, onEvent, onceEvent, clearAllListeners } from '../event-bus'

describe('EventBus', () => {
  beforeEach(() => {
    clearAllListeners()
  })

  describe('emitEvent / onEvent', () => {
    it('应该能够发送和接收事件', () => {
      const handler = vi.fn()

      onEvent('bookmark:created', handler)
      emitEvent('bookmark:created', {
        id: '123',
        bookmark: {
          id: '123',
          title: 'Test',
          parentId: '0',
          dateAdded: Date.now(),
          isFolder: false,
          childrenCount: 0
        }
      })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({
        id: '123',
        bookmark: { id: '123', title: 'Test' }
      })
    })

    it('应该支持多个监听器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onEvent('bookmark:updated', handler1)
      onEvent('bookmark:updated', handler2)

      emitEvent('bookmark:updated', {
        id: '123',
        changes: { title: 'New Title' }
      })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('应该支持取消监听', () => {
      const handler = vi.fn()

      const unsubscribe = onEvent('bookmark:deleted', handler)

      emitEvent('bookmark:deleted', { id: '123' })
      expect(handler).toHaveBeenCalledTimes(1)

      // 取消监听
      unsubscribe()

      emitEvent('bookmark:deleted', { id: '456' })
      expect(handler).toHaveBeenCalledTimes(1) // 不再触发
    })
  })

  describe('onceEvent', () => {
    it('应该只触发一次', () => {
      const handler = vi.fn()

      onceEvent('sync:completed', handler)

      emitEvent('sync:completed', { duration: 100, count: 10 })
      emitEvent('sync:completed', { duration: 200, count: 20 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ duration: 100, count: 10 })
    })
  })

  describe('类型安全', () => {
    it('应该提供类型提示和检查', () => {
      // 这个测试主要是确保 TypeScript 编译通过
      // 运行时不会有实际断言

      onEvent('bookmark:created', data => {
        // TypeScript 应该能推断出 data 的类型
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('bookmark')
      })

      onEvent('data:synced', data => {
        expect(data).toHaveProperty('eventType')
        expect(data).toHaveProperty('bookmarkId')
        expect(data).toHaveProperty('timestamp')
      })
    })
  })
})
