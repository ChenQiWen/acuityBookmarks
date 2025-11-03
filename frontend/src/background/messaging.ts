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
import { openManagementPage, openSettingsPage } from './navigation'
import { getExtensionState } from './state'
import {
  checkDataHealth,
  recoverData,
  autoCheckAndRecover
} from './data-health-check'

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
      case 'CHECK_DATA_HEALTH': {
        const result = await checkDataHealth(true)
        sendResponse({ success: true, result })
        return
      }
      case 'RECOVER_DATA': {
        const bookmarkCount = await recoverData()
        sendResponse({ success: true, bookmarkCount })
        return
      }
      case 'AUTO_CHECK_AND_RECOVER': {
        const recovered = await autoCheckAndRecover(true)
        sendResponse({ success: true, recovered })
        return
      }
      case 'CREATE_BOOKMARK': {
        await handleCreateBookmark(message, sendResponse)
        return
      }
      case 'UPDATE_BOOKMARK': {
        await handleUpdateBookmark(message, sendResponse)
        return
      }
      case 'DELETE_BOOKMARK': {
        await handleDeleteBookmark(message, sendResponse)
        return
      }
      case 'GET_AI_CATEGORY_SUGGESTION': {
        await handleGetAICategorySuggestion(message, sendResponse)
        return
      }
      case 'GET_BOOKMARK_TREE': {
        await handleGetBookmarkTree(sendResponse)
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

  const failFastTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
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

/**
 * 处理创建书签消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 * Chrome API → Background → IndexedDB → 广播通知
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleCreateBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}

    // ✅ 严格验证数据（防止创建文件夹而不是书签）
    const title = (data.title as string)?.trim()
    const url = (data.url as string)?.trim()
    const parentId = data.parentId as string | undefined

    if (!url || url === '') {
      const error = '❌ 无法创建书签：URL 为空或未定义'
      logger.error('BackgroundMessaging', error, data)
      sendResponse({ success: false, error })
      return
    }

    if (!title || title === '') {
      logger.warn('BackgroundMessaging', '标题为空，使用 URL 作为标题')
    }

    logger.info('BackgroundMessaging', '创建书签', {
      title: title || url,
      url,
      parentId
    })

    // 1. 调用 Chrome API 创建书签
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>(
      (resolve, reject) => {
        chrome.bookmarks.create(
          {
            title: title || url, // ✅ 如果标题为空，使用 URL
            url, // ✅ 必须提供 URL（否则会创建文件夹）
            parentId,
            index: data.index as number | undefined
          },
          result => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(result)
            }
          }
        )
      }
    )

    // 注意：Chrome API 创建书签后会自动触发 chrome.bookmarks.onCreated 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info(
      'BackgroundMessaging',
      `✅ 书签已创建: ${node.title || node.id}`
    )
    sendResponse({ success: true, bookmark: node })
  } catch (error) {
    logger.error('BackgroundMessaging', '创建书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理更新书签消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleUpdateBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const id = data.id as string

    if (!id) {
      throw new Error('缺少书签 ID')
    }

    // 1. 调用 Chrome API 更新书签
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>(
      (resolve, reject) => {
        chrome.bookmarks.update(
          id,
          {
            title: data.title as string | undefined,
            url: data.url as string | undefined
          },
          result => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(result)
            }
          }
        )
      }
    )

    // 注意：Chrome API 更新书签后会自动触发 chrome.bookmarks.onChanged 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info(
      'BackgroundMessaging',
      `✅ 书签已更新: ${node.title || node.id}`
    )
    sendResponse({ success: true, bookmark: node })
  } catch (error) {
    logger.error('BackgroundMessaging', '更新书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理删除书签消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleDeleteBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const id = data.id as string

    if (!id) {
      throw new Error('缺少书签 ID')
    }

    // 1. 调用 Chrome API 删除书签
    await new Promise<void>((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })

    // 注意：Chrome API 删除书签后会自动触发 chrome.bookmarks.onRemoved 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info('BackgroundMessaging', `✅ 书签已删除: ${id}`)
    sendResponse({ success: true })
  } catch (error) {
    logger.error('BackgroundMessaging', '删除书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理 AI 分类建议请求
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleGetAICategorySuggestion(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const title = (data.title as string) || ''
    const url = (data.url as string) || ''

    if (!title || !url) {
      sendResponse({
        success: false,
        error: '标题和 URL 不能为空'
      })
      return
    }

    // 动态导入 AI 服务（避免 Service Worker 启动时加载）
    const { aiAppService } = await import('@/application/ai/ai-app-service')

    const result = await aiAppService.categorizeBookmark({
      title,
      url
    })

    logger.info('BackgroundMessaging', 'AI 分类建议', {
      title,
      category: result.category
    })

    sendResponse({
      success: true,
      category: result.category
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '获取 AI 分类建议失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理获取书签树请求
 *
 * 返回 Chrome 原生的书签树结构（用于文件夹选择）
 *
 * @param sendResponse - 响应回调函数
 */
async function handleGetBookmarkTree(
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
      (resolve, reject) => {
        chrome.bookmarks.getTree(result => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      }
    )

    sendResponse({
      success: true,
      tree
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '获取书签树失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
