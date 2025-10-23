/**
 * 消息路由模块
 *
 * 职责：
 * - 接收来自前端页面的 chrome.runtime.sendMessage 请求
 * - 根据消息类型分发到对应的处理器
 * - 处理书签查询、通知、导航等操作
 * - 提供异步响应支持
 */

import { logger } from '@/infrastructure/logging/logger'
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import {
  openManagementPage,
  openSettingsPage,
  toggleSidePanel
} from './navigation'
import { getExtensionState } from './state'

/**
 * 运行时消息接口
 */
interface RuntimeMessage {
  /** 消息类型 */
  type: string
  /** 可选的消息数据 */
  data?: Record<string, unknown>
}

/**
 * 异步响应函数类型
 */
type AsyncResponse = (payload: unknown) => void

/**
 * 注册消息处理器
 *
 * 监听 chrome.runtime.onMessage 事件并分发到具体处理函数
 */
export function registerMessageHandlers(): void {
  chrome.runtime.onMessage.addListener(
    (message: RuntimeMessage, _sender, sendResponse) => {
      void handleMessage(message, sendResponse)
      return true
    }
  )
}

/**
 * 处理接收到的消息
 *
 * 根据消息类型路由到对应的处理函数
 *
 * @param message - 接收到的消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleMessage(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const { type } = message

  try {
    switch (type) {
      case 'ACUITY_NOTIFY_PING': {
        sendResponse({ ok: true })
        return
      }
      case 'ACUITY_NOTIFY': {
        await handleNotification(message, sendResponse)
        return
      }
      case 'ACUITY_NOTIFY_CLEAR': {
        await handleNotificationClear(message, sendResponse)
        return
      }
      case 'OPEN_MANAGEMENT_PAGE': {
        openManagementPage()
        sendResponse({ success: true })
        return
      }
      case 'OPEN_SETTINGS_PAGE': {
        openSettingsPage()
        sendResponse({ success: true })
        return
      }
      case 'TOGGLE_SIDEBAR': {
        toggleSidePanel()
        sendResponse({ success: true })
        return
      }
      case 'SYNC_BOOKMARKS': {
        sendResponse({ ok: true })
        return
      }
      case 'get-bookmarks-paged': {
        await handlePagedBookmarks(message, sendResponse)
        return
      }
      case 'get-children-paged': {
        await handleChildrenPaged(message, sendResponse)
        return
      }
      case 'get-tree-root': {
        await handleTreeRoot(sendResponse)
        return
      }
      case 'get-global-stats': {
        await handleGlobalStats(sendResponse)
        return
      }
      default: {
        sendResponse({ status: 'noop' })
      }
    }
  } catch (error) {
    logger.error('BackgroundMessaging', `处理消息 ${type} 失败`, error)
    sendResponse({ status: 'error', message: String(error) })
  }
}

/**
 * 处理通知消息
 *
 * 创建 Chrome 系统通知
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleNotification(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const data = message.data || {}
  const title = (data.title as string) || 'Acuity'
  const content = (data.message as string) || ''
  const iconUrl =
    (data.iconUrl as string) ||
    chrome.runtime.getURL?.('logo.png') ||
    'logo.png'

  if (!chrome.notifications?.create) {
    sendResponse({ notificationId: '' })
    return
  }

  await new Promise<void>(resolve => {
    chrome.notifications.create(
      { type: 'basic', title, message: content, iconUrl },
      id => {
        sendResponse({ notificationId: id || '' })
        resolve()
      }
    )
  })
}

/**
 * 处理清除通知消息
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleNotificationClear(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const id = message.data?.notificationId as string | undefined
  if (!id) {
    sendResponse({ ok: true })
    return
  }

  if (!chrome.notifications?.clear) {
    sendResponse({ ok: true })
    return
  }

  await new Promise<void>(resolve => {
    chrome.notifications.clear(id, () => {
      sendResponse({ ok: true })
      resolve()
    })
  })
}

/**
 * 处理分页获取书签消息
 *
 * @param message - 消息对象（包含 limit 和 offset）
 * @param sendResponse - 响应回调函数
 */
async function handlePagedBookmarks(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const limit = Number(message.data?.limit ?? 100)
  const offset = Number(message.data?.offset ?? 0)
  const items = await bookmarkSyncService.getAllBookmarks(limit, offset)
  sendResponse({
    ok: true,
    value: { items, limit, offset, total: items.length }
  })
}

/**
 * 处理分页获取子节点消息
 *
 * @param message - 消息对象（包含 parentId、limit 和 offset）
 * @param sendResponse - 响应回调函数
 */
async function handleChildrenPaged(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const parentId = String(message.data?.parentId ?? '')
  const limit = Number(message.data?.limit ?? 100)
  const offset = Number(message.data?.offset ?? 0)
  const items = await bookmarkSyncService.getChildrenByParentId(
    parentId,
    offset,
    limit
  )
  sendResponse({ ok: true, value: items })
}

/**
 * 处理获取树根节点消息
 *
 * 带超时保护，避免长时间等待
 *
 * @param sendResponse - 响应回调函数
 */
async function handleTreeRoot(sendResponse: AsyncResponse): Promise<void> {
  let responded = false

  const done = (payload: unknown) => {
    if (responded) return
    responded = true
    sendResponse(payload)
  }

  const failFastTimer = setTimeout(() => {
    logger.warn('BackgroundMessaging', 'get-tree-root 超时，返回空数组')
    done({ ok: true, value: [], meta: { failFast: true } })
  }, 2000)

  try {
    const state = await getExtensionState()
    if (!state.dbReady) {
      clearTimeout(failFastTimer)
      done({ ok: true, value: [], meta: { notReady: true } })
      return
    }

    const items = await bookmarkSyncService.getRootBookmarks()
    clearTimeout(failFastTimer)
    done({ ok: true, value: items })
  } catch (error) {
    clearTimeout(failFastTimer)
    throw error
  }
}

/**
 * 处理获取全局统计数据消息
 *
 * @param sendResponse - 响应回调函数
 */
async function handleGlobalStats(sendResponse: AsyncResponse): Promise<void> {
  const all = await bookmarkSyncService.getAllBookmarks(999_999, 0)
  const totalBookmarks = all.filter(
    (item: BookmarkRecord) => item.url && !item.isFolder
  ).length
  const totalFolders = all.filter(
    (item: BookmarkRecord) => item.isFolder
  ).length
  sendResponse({ ok: true, value: { totalBookmarks, totalFolders } })
}
