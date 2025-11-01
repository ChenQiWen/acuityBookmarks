/**
 * 书签变化监听与同步
 *
 * 实现单向数据流架构：
 * Chrome API → Background → IndexedDB → 广播 → UI
 *
 * 架构原则：
 * 1. Background 是唯一监听 Chrome bookmarks 事件的地方
 * 2. 每次事件触发后完整同步到 IndexedDB
 * 3. 同步完成后广播消息给所有前端页面
 * 4. 前端页面监听广播，从 IndexedDB 刷新 UI
 *
 * @see /单向数据流架构说明.md
 */

import { logger } from '@/infrastructure/logging/logger'
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
import { scheduleHealthRebuildForIds } from '@/services/bookmark-health-service'
import { TIMEOUT_CONFIG } from '@/config/constants'

/**
 * 同步到 IndexedDB 并广播更新消息
 *
 * @param eventType - 事件类型
 * @param bookmarkId - 书签 ID
 * @param forceFullSync - 是否强制全量同步（默认 false，使用增量同步）
 */
async function syncAndBroadcast(
  eventType: 'created' | 'changed' | 'moved' | 'removed',
  bookmarkId: string,
  forceFullSync = false
): Promise<void> {
  try {
    logger.info('BackgroundBookmarks', `🔄 书签 ${eventType}:`, bookmarkId)

    // 1. 根据情况选择全量或增量同步
    if (forceFullSync) {
      logger.info(
        'BackgroundBookmarks',
        '🔄 执行全量同步（移动操作需重建 pathIds）'
      )
      await bookmarkSyncService.syncAllBookmarks()
    } else {
      // ✅ 优先使用增量同步，性能更好
      logger.info('BackgroundBookmarks', '⚡ 执行增量同步（单节点更新）')
      bookmarkSyncService.enqueueIncremental(eventType, bookmarkId)
      // 等待增量同步完成（带去抖的异步执行，方法内部有 300ms 去抖）
      await new Promise(resolve =>
        setTimeout(resolve, TIMEOUT_CONFIG.DELAY.BOOKMARK_OP)
      )
    }

    // 2. 广播消息到所有页面
    chrome.runtime
      .sendMessage({
        type: 'acuity-bookmarks-db-synced',
        eventType: eventType,
        bookmarkId: bookmarkId,
        timestamp: Date.now()
      })
      .catch(() => {
        // 静默失败：可能没有活动的前端页面在监听
        logger.debug('BackgroundBookmarks', '广播消息失败（可能没有活动页面）')
      })

    scheduleHealthRebuildForIds([bookmarkId], `background-${eventType}`)

    logger.info('BackgroundBookmarks', `✅ 同步完成并已广播: ${eventType}`)
  } catch (error) {
    logger.error('BackgroundBookmarks', `❌ 同步失败: ${eventType}`, error)
  }
}

/**
 * 注册书签变化监听器
 *
 * 监听 Chrome bookmarks 的所有变化事件：
 * - onCreated: 书签/文件夹创建
 * - onChanged: 书签标题/URL 修改
 * - onMoved: 书签/文件夹移动
 * - onRemoved: 书签/文件夹删除
 * - onImportBegan/onImportEnded: 书签导入
 */
export function registerBookmarkChangeListeners(): void {
  logger.info('BackgroundBookmarks', '🔧 注册书签变化监听器...')

  // 监听书签创建
  chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
    logger.info('BackgroundBookmarks', '📝 书签已创建:', bookmark.title || id)
    // ✅ 创建操作使用增量同步
    await syncAndBroadcast('created', id, false)
  })

  // 监听书签修改
  chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    logger.info('BackgroundBookmarks', '✏️ 书签已修改:', changeInfo.title || id)
    // ✅ 修改操作使用增量同步
    await syncAndBroadcast('changed', id, false)
  })

  // 监听书签移动
  chrome.bookmarks.onMoved.addListener(async (id, _moveInfo) => {
    logger.info('BackgroundBookmarks', '📁 书签已移动:', id)
    // ⚠️ 移动操作需要全量同步，因为会影响 pathIds、ancestorIds 等层级字段
    await syncAndBroadcast('moved', id, true)
  })

  // 监听书签删除
  chrome.bookmarks.onRemoved.addListener(async (id, _removeInfo) => {
    logger.info('BackgroundBookmarks', '🗑️ 书签已删除:', id)
    // ✅ 删除操作使用增量同步
    await syncAndBroadcast('removed', id, false)
  })

  // 监听导入开始
  chrome.bookmarks.onImportBegan?.addListener(() => {
    logger.info('BackgroundBookmarks', '📥 书签导入开始...')
  })

  // 监听导入结束
  chrome.bookmarks.onImportEnded?.addListener(async () => {
    logger.info('BackgroundBookmarks', '📥 书签导入结束，开始同步...')
    await syncAndBroadcast('created', 'import-batch')
  })

  logger.info('BackgroundBookmarks', '✅ 书签变化监听器已注册')
}
