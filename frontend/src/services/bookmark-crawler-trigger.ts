/**
 * 书签爬取触发器
 *
 * 提供多种触发方式：
 * 1. 手动触发（开发/测试）
 * 2. 定时触发（后台自动）
 * 3. 事件触发（书签变化）
 */

import {
  crawlSingleBookmark,
  crawlMultipleBookmarks,
  getCrawlStatistics
} from './local-bookmark-crawler'
import { logger } from '@/infrastructure/logging/logger'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

/**
 * 爬取所有未爬取的书签（增量爬取）
 */
export async function crawlUnprocessedBookmarks(
  limit: number = 100
): Promise<void> {
  try {
    logger.info('CrawlTrigger', `📡 开始增量爬取（最多 ${limit} 条）...`)

    // 1. 获取所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    logger.info('CrawlTrigger', `📚 共 ${allBookmarks.length} 条书签`)

    // 2. 筛选出未爬取的书签
    const unprocessed = allBookmarks
      .filter(bookmark => {
        // 只处理有 URL 的书签
        if (!bookmark.url) return false

        // 没有元数据的书签
        if (!bookmark.hasMetadata) return true

        // 元数据过期的书签（30天）
        if (bookmark.metadataUpdatedAt) {
          const age = Date.now() - bookmark.metadataUpdatedAt
          const thirtyDays = 30 * 24 * 60 * 60 * 1000
          return age > thirtyDays
        }

        return false
      })
      .slice(0, limit) // 限制数量

    logger.info('CrawlTrigger', `🎯 待爬取: ${unprocessed.length} 条`)

    if (unprocessed.length === 0) {
      logger.info('CrawlTrigger', '✅ 没有需要爬取的书签')
      return
    }

    // 3. 转换为 Chrome 书签格式
    const chromeBookmarks: chrome.bookmarks.BookmarkTreeNode[] =
      unprocessed.map(
        b =>
          ({
            id: b.id,
            title: b.title,
            url: b.url,
            dateAdded: b.dateAdded,
            dateLastUsed: b.lastVisited,
            parentId: b.parentId,
            index: b.index
          }) as chrome.bookmarks.BookmarkTreeNode
      )

    // 4. 批量爬取
    await crawlMultipleBookmarks(chromeBookmarks)

    logger.info('CrawlTrigger', '✅ 增量爬取完成')
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 增量爬取失败', error)
    throw error
  }
}

/**
 * 爬取指定书签ID列表
 */
export async function crawlBookmarksByIds(
  bookmarkIds: string[]
): Promise<void> {
  try {
    logger.info('CrawlTrigger', `📡 爬取指定书签: ${bookmarkIds.length} 条`)

    const bookmarks: chrome.bookmarks.BookmarkTreeNode[] = []

    for (const id of bookmarkIds) {
      const bookmark = await indexedDBManager.getBookmarkById(id)
      if (bookmark && bookmark.url) {
        bookmarks.push({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          dateAdded: bookmark.dateAdded,
          parentId: bookmark.parentId,
          index: bookmark.index
        } as chrome.bookmarks.BookmarkTreeNode)
      }
    }

    if (bookmarks.length === 0) {
      logger.warn('CrawlTrigger', '⚠️ 没有有效的书签')
      return
    }

    await crawlMultipleBookmarks(bookmarks)
    logger.info('CrawlTrigger', '✅ 爬取完成')
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 爬取失败', error)
    throw error
  }
}

/**
 * 重新爬取所有书签（强制刷新）
 */
export async function recrawlAllBookmarks(): Promise<void> {
  try {
    logger.info('CrawlTrigger', '📡 开始全量重新爬取...')

    // 获取所有有 URL 的书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const urlBookmarks = allBookmarks.filter(b => b.url)

    logger.info('CrawlTrigger', `📚 共 ${urlBookmarks.length} 条书签待爬取`)

    const chromeBookmarks: chrome.bookmarks.BookmarkTreeNode[] =
      urlBookmarks.map(
        b =>
          ({
            id: b.id,
            title: b.title,
            url: b.url,
            dateAdded: b.dateAdded,
            parentId: b.parentId,
            index: b.index
          }) as chrome.bookmarks.BookmarkTreeNode
      )

    await crawlMultipleBookmarks(chromeBookmarks)

    logger.info('CrawlTrigger', '✅ 全量爬取完成')
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 全量爬取失败', error)
    throw error
  }
}

/**
 * 启动定时爬取任务（后台运行）
 */
export function startPeriodicCrawl(intervalHours: number = 24): void {
  logger.info('CrawlTrigger', `⏰ 启动定时爬取: 每 ${intervalHours} 小时`)

  // 使用 Chrome Alarms API 进行定时任务
  if (chrome?.alarms) {
    chrome.alarms.create('bookmark-periodic-crawl', {
      delayInMinutes: 1, // 启动后1分钟开始第一次
      periodInMinutes: intervalHours * 60
    })

    logger.info('CrawlTrigger', '✅ 定时任务已创建')
  } else {
    logger.warn('CrawlTrigger', '⚠️ Alarms API 不可用')
  }
}

/**
 * 停止定时爬取任务
 */
export function stopPeriodicCrawl(): void {
  if (chrome?.alarms) {
    chrome.alarms.clear('bookmark-periodic-crawl')
    logger.info('CrawlTrigger', '⏹️ 定时任务已停止')
  }
}

/**
 * 监听书签变化，自动爬取新书签
 */
export function startAutocrawlOnBookmarkAdd(): void {
  if (!chrome?.bookmarks?.onCreated) {
    logger.warn('CrawlTrigger', '⚠️ 书签事件监听不可用')
    return
  }

  chrome.bookmarks.onCreated.addListener(async (_id, bookmark) => {
    if (bookmark.url) {
      logger.info('CrawlTrigger', `🆕 检测到新书签: ${bookmark.title}`)

      // 延迟1秒后爬取，避免频繁操作
      setTimeout(async () => {
        try {
          await crawlSingleBookmark(bookmark)
          logger.info('CrawlTrigger', `✅ 新书签已爬取: ${bookmark.title}`)
        } catch (error) {
          logger.error(
            'CrawlTrigger',
            `❌ 爬取新书签失败: ${bookmark.title}`,
            error
          )
        }
      }, 1000)
    }
  })

  logger.info('CrawlTrigger', '👂 已启动书签新增监听')
}

/**
 * 获取爬取状态统计
 */
export async function getCrawlStatus(): Promise<{
  total: number
  withMetadata: number
  pending: number
  expired: number
  successRate: number
}> {
  const stats = await getCrawlStatistics()
  const allBookmarks = await indexedDBManager.getAllBookmarks()
  const urlBookmarks = allBookmarks.filter(b => b.url)

  return {
    total: urlBookmarks.length,
    withMetadata: stats.withMetadata,
    pending: urlBookmarks.length - stats.total,
    expired: stats.expired,
    successRate:
      stats.total > 0
        ? ((stats.withMetadata - stats.failed) / stats.total) * 100
        : 0
  }
}

/**
 * 测试爬取单个 URL
 */
export async function testCrawlUrl(url: string): Promise<void> {
  logger.info('CrawlTrigger', `🧪 测试爬取: ${url}`)

  const testBookmark = {
    id: 'test-' + Date.now(),
    title: 'Test Bookmark',
    url: url,
    dateAdded: Date.now(),
    index: 0
  } as chrome.bookmarks.BookmarkTreeNode

  try {
    await crawlSingleBookmark(testBookmark)
    logger.info('CrawlTrigger', '✅ 测试成功')
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 测试失败', error)
    throw error
  }
}

// ==================== 全局类型声明 ====================

/**
 * BookmarkCrawler 全局调试 API
 */
export interface BookmarkCrawlerGlobal {
  crawlUnprocessed: typeof crawlUnprocessedBookmarks
  crawlByIds: typeof crawlBookmarksByIds
  recrawlAll: typeof recrawlAllBookmarks
  startPeriodic: typeof startPeriodicCrawl
  stopPeriodic: typeof stopPeriodicCrawl
  startAutoOnAdd: typeof startAutocrawlOnBookmarkAdd
  getStatus: typeof getCrawlStatus
  testUrl: typeof testCrawlUrl
  getStats: typeof getCrawlStatistics
}

// 扩展 globalThis 类型
declare global {
  var bookmarkCrawler: BookmarkCrawlerGlobal
}

// 导出全局对象（用于控制台调试）
// 注意：Service Worker 中使用 self，Window 中使用 window，globalThis 兼容两者
if (typeof globalThis !== 'undefined') {
  globalThis.bookmarkCrawler = {
    crawlUnprocessed: crawlUnprocessedBookmarks,
    crawlByIds: crawlBookmarksByIds,
    recrawlAll: recrawlAllBookmarks,
    startPeriodic: startPeriodicCrawl,
    stopPeriodic: stopPeriodicCrawl,
    startAutoOnAdd: startAutocrawlOnBookmarkAdd,
    getStatus: getCrawlStatus,
    testUrl: testCrawlUrl,
    getStats: getCrawlStatistics
  }

  // 同时挂载到 self（Service Worker）
  if (typeof self !== 'undefined' && self !== globalThis) {
    // Service Worker 环境中 self 也挂载 bookmarkCrawler
    Object.defineProperty(self, 'bookmarkCrawler', {
      value: globalThis.bookmarkCrawler,
      writable: true,
      configurable: true
    })
  }
}
