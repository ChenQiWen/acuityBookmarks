/**
 * Chrome 消息到事件总线的桥接
 *
 * 职责：
 * - 监听 chrome.runtime.onMessage
 * - 将消息转换为类型安全的事件总线事件
 * - 统一管理所有 Chrome 消息处理
 */

import { emitEvent } from './event-bus'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Chrome 消息类型定义
 */
interface ChromeMessage {
  type: string
  [key: string]: unknown
}

/**
 * 初始化 Chrome 消息监听器
 *
 * 应在应用启动时调用一次
 *
 * @example
 * ```typescript
 * // main.ts
 * import { initializeChromeMessageBridge } from '@/infrastructure/events/chrome-message-bridge'
 *
 * initializeChromeMessageBridge()
 * ```
 */
export function initializeChromeMessageBridge() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    logger.warn(
      'ChromeMessageBridge',
      'Chrome runtime 不可用，跳过消息桥接初始化'
    )
    return
  }

  logger.info('ChromeMessageBridge', '🔗 初始化 Chrome 消息桥接')

  chrome.runtime.onMessage.addListener(
    (message: ChromeMessage, _sender, _sendResponse) => {
      handleChromeMessage(message)

      // Chrome 消息处理器要求返回 false（不需要异步响应）
      return false
    }
  )

  logger.info('ChromeMessageBridge', '✅ Chrome 消息桥接已启动')
}

/**
 * 处理 Chrome 消息并转换为事件
 */
function handleChromeMessage(message: ChromeMessage) {
  const { type } = message

  logger.debug('ChromeMessageBridge', `收到消息: ${type}`, message)

  switch (type) {
    /**
     * 数据同步完成消息
     * （从 Background Script 同步到 IndexedDB）
     */
    case 'acuity-bookmarks-db-synced': {
      const { eventType, bookmarkId, timestamp } = message

      emitEvent('data:synced', {
        eventType: eventType as 'created' | 'changed' | 'moved' | 'removed',
        bookmarkId: String(bookmarkId),
        timestamp: Number(timestamp ?? Date.now())
      })

      logger.info('ChromeMessageBridge', `✅ 数据同步事件已转发: ${eventType}`)
      break
    }

    /**
     * 书签更新通知（旧格式，向后兼容）
     *
     * 注意：实际生产环境应该使用 acuity-bookmarks-db-synced 事件
     */
    case 'BOOKMARK_UPDATED': {
      const { id, eventType, payload } = message

      // 根据事件类型触发不同的事件
      if (eventType === 'created') {
        // 创建事件：payload 应包含完整书签数据
        const defaultBookmarkData = {
          id: String(id),
          title: 'Untitled',
          parentId: '0',
          dateAdded: Date.now(),
          isFolder: false,
          childrenCount: 0
        }
        const bookmarkData =
          payload && typeof payload === 'object'
            ? { ...defaultBookmarkData, ...payload }
            : defaultBookmarkData

        emitEvent('bookmark:created', {
          id: String(id),
          bookmark: bookmarkData
        })
      } else if (eventType === 'changed') {
        // 更新事件：payload 包含变更字段
        const changes =
          payload && typeof payload === 'object'
            ? (payload as Record<string, unknown>)
            : ({} as Record<string, unknown>)

        emitEvent('bookmark:updated', {
          id: String(id),
          changes
        })
      } else if (eventType === 'removed') {
        // 删除事件
        emitEvent('bookmark:deleted', {
          id: String(id)
        })
      }

      break
    }

    default:
      // 未识别的消息类型
      logger.debug('ChromeMessageBridge', `未处理的消息类型: ${type}`)
  }
}

/**
 * 发送消息到 Background Script
 *
 * @param message - 消息对象
 * @returns Promise<响应>
 *
 * @example
 * ```typescript
 * const response = await sendToBackground({
 *   type: 'CREATE_BOOKMARK',
 *   data: { title: '新书签' }
 * })
 * ```
 */
export async function sendToBackground<T = unknown>(
  message: ChromeMessage
): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    throw new Error('Chrome runtime 不可用')
  }

  try {
    const response = await chrome.runtime.sendMessage(message)
    return response as T
  } catch (error) {
    logger.error('ChromeMessageBridge', '发送消息失败', error)
    throw error
  }
}
