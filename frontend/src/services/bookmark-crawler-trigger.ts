/**
 * 书签爬取触发器
 *
 * ⚠️ 重要更新：此文件正在迁移到后台架构
 *
 * 新架构：
 * - 爬取任务运行在 Service Worker 后台（`background/crawler-manager.ts`）
 * - 前端页面通过 `backgroundCrawlerClient` 或 `useCrawler` composable 触发
 * - 定期爬取使用 `chrome.alarms`（已在后台自动运行）
 *
 * 推荐使用：
 * - Vue 组件：`import { useCrawler } from '@/composables/useCrawler'`
 * - 普通服务：`import { backgroundCrawlerClient } from '@/services/background-crawler-client'`
 *
 * 详细文档：
 * - 架构说明：`frontend/src/background/CRAWLER_ARCHITECTURE.md`
 * - 使用指南：`frontend/src/composables/CRAWLER_USAGE_GUIDE.md`
 * - 迁移追踪：`frontend/src/CRAWLER_MIGRATION_TRACKER.md`
 */

import {
  crawlSingleBookmark,
  crawlMultipleBookmarks,
  getCrawlStatistics
} from './local-bookmark-crawler'
import { backgroundCrawlerClient } from './background-crawler-client'
import { logger } from '@/infrastructure/logging/logger'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

/**
 * 爬取所有未爬取的书签（增量爬取）
 *
 * @deprecated 请使用后台爬取架构 `backgroundCrawlerClient.startCrawl()`
 * 或在后台自动定期爬取（无需手动调用）
 *
 * ⚠️ 迁移说明：
 * - 后台定期爬取已自动运行（每小时），无需手动调用
 * - 如需手动触发：`await backgroundCrawlerClient.startCrawl(bookmarkIds, { onlyWhenIdle: true })`
 * - Vue 组件推荐使用 `useCrawler()` composable
 */
export async function crawlUnprocessedBookmarks(
  limit: number = 100
): Promise<void> {
  try {
    logger.warn(
      'CrawlTrigger',
      '⚠️ crawlUnprocessedBookmarks 已废弃，建议使用后台爬取'
    )
    logger.info('CrawlTrigger', `📡 开始增量爬取（最多 ${limit} 条）...`)

    // ✅ 确保 IndexedDB 已初始化
    await indexedDBManager.initialize()

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

    // 🔄 使用新的后台爬取 API
    const bookmarkIds = unprocessed.map(b => b.id)
    await backgroundCrawlerClient.startCrawl({
      bookmarkIds,
      priority: 'normal',
      respectRobots: true
    })

    logger.info('CrawlTrigger', '✅ 增量爬取已发送到后台')
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 增量爬取失败', error)
    throw error
  }
}

/**
 * 爬取选项
 */
export interface CrawlByIdsOptions {
  onProgress?: (current: number, total: number) => void
  onComplete?: (stats: {
    success: number
    failed: number
    total: number
  }) => void
}

/**
 * 直接爬取 Chrome 书签对象（用于初始化时）
 */
export async function crawlChromeBookmarks(
  chromeBookmarks: chrome.bookmarks.BookmarkTreeNode[],
  options: CrawlByIdsOptions = {}
): Promise<void> {
  try {
    logger.info(
      'CrawlTrigger',
      `📡 爬取 Chrome 书签: ${chromeBookmarks.length} 条`
    )

    if (chromeBookmarks.length === 0) {
      logger.warn('CrawlTrigger', '⚠️ 没有有效的书签')
      options.onComplete?.({ success: 0, failed: 0, total: 0 })
      return
    }

    // 批量爬取，带进度回调
    let successCount = 0
    let failedCount = 0

    for (let i = 0; i < chromeBookmarks.length; i++) {
      try {
        await crawlMultipleBookmarks([chromeBookmarks[i]])
        successCount++
      } catch {
        failedCount++
      }

      // 触发进度回调
      options.onProgress?.(i + 1, chromeBookmarks.length)
    }

    // 触发完成回调
    options.onComplete?.({
      success: successCount,
      failed: failedCount,
      total: chromeBookmarks.length
    })

    logger.info(
      'CrawlTrigger',
      `✅ 爬取完成: 成功 ${successCount}, 失败 ${failedCount}`
    )
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 爬取失败', error)
    throw error
  }
}

/**
 * 爬取指定书签ID列表
 *
 * @deprecated 请使用后台爬取架构 `backgroundCrawlerClient.startCrawl()`
 *
 * ⚠️ 迁移说明：
 * ```typescript
 * // 旧代码
 * await crawlBookmarksByIds(ids, {
 *   onProgress: (current, total) => console.log(`${current}/${total}`),
 *   onComplete: (stats) => console.log(stats)
 * })
 *
 * // 新代码
 * const unsubscribeProgress = backgroundCrawlerClient.onProgress((stats) => {
 *   console.log(`${stats.completed}/${stats.total}`)
 * })
 * const unsubscribeComplete = backgroundCrawlerClient.onComplete((stats) => {
 *   console.log(stats)
 * })
 * await backgroundCrawlerClient.startCrawl(ids, { onlyWhenIdle: false })
 *
 * // 清理监听器
 * unsubscribeProgress()
 * unsubscribeComplete()
 * ```
 */
export async function crawlBookmarksByIds(
  bookmarkIds: string[],
  options: CrawlByIdsOptions = {}
): Promise<void> {
  try {
    logger.warn(
      'CrawlTrigger',
      '⚠️ crawlBookmarksByIds 已废弃，建议使用后台爬取'
    )
    logger.info('CrawlTrigger', `📡 爬取指定书签: ${bookmarkIds.length} 条`)

    if (bookmarkIds.length === 0) {
      logger.warn('CrawlTrigger', '⚠️ 没有有效的书签')
      options.onComplete?.({ success: 0, failed: 0, total: 0 })
      return
    }

    // 🔄 使用新的后台爬取 API，并适配旧的回调接口
    let currentProgress = 0
    const totalCount = bookmarkIds.length

    // 订阅进度更新
    const unsubscribeProgress = backgroundCrawlerClient.onProgress(stats => {
      currentProgress = stats.completed
      options.onProgress?.(currentProgress, totalCount)
    })

    // 订阅完成事件
    const unsubscribeComplete = backgroundCrawlerClient.onComplete(stats => {
      options.onComplete?.({
        success: stats.completed,
        failed: stats.failed,
        total: stats.total
      })

      logger.info(
        'CrawlTrigger',
        `✅ 爬取完成: 成功 ${stats.completed}, 失败 ${stats.failed}`
      )
    })

    // 启动爬取
    await backgroundCrawlerClient.startCrawl({
      bookmarkIds,
      priority: 'high', // 用户主动触发，高优先级
      respectRobots: true
    })

    // 清理监听器
    unsubscribeProgress()
    unsubscribeComplete()
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 爬取失败', error)
    throw error
  }
}

/**
 * 重新爬取所有书签（强制刷新）
 *
 * @deprecated 请使用后台爬取架构
 *
 * ⚠️ 迁移说明：
 * ```typescript
 * // 旧代码
 * await recrawlAllBookmarks()
 *
 * // 新代码
 * const allBookmarks = await indexedDBManager.getAllBookmarks()
 * const bookmarkIds = allBookmarks.filter(b => b.url).map(b => b.id)
 * await backgroundCrawlerClient.startCrawl(bookmarkIds, {
 *   force: true, // 强制重新爬取
 *   maxConcurrent: 5,
 *   onlyWhenIdle: true
 * })
 * ```
 */
export async function recrawlAllBookmarks(): Promise<void> {
  try {
    logger.warn(
      'CrawlTrigger',
      '⚠️ recrawlAllBookmarks 已废弃，建议使用后台爬取'
    )
    logger.info('CrawlTrigger', '📡 开始全量重新爬取...')

    // ✅ 确保 IndexedDB 已初始化
    await indexedDBManager.initialize()

    // 获取所有有 URL 的书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const urlBookmarks = allBookmarks.filter(b => b.url)

    logger.info('CrawlTrigger', `📚 共 ${urlBookmarks.length} 条书签待爬取`)

    // 🔄 使用新的后台爬取 API
    const bookmarkIds = urlBookmarks.map(b => b.id)
    await backgroundCrawlerClient.startCrawl({
      bookmarkIds,
      priority: 'low', // 全量爬取使用低优先级
      respectRobots: true
    })

    logger.info('CrawlTrigger', '✅ 全量爬取已发送到后台')
  } catch (error) {
    logger.error('CrawlTrigger', '❌ 全量爬取失败', error)
    throw error
  }
}

/**
 * 启动定时爬取任务（后台运行）
 *
 * @deprecated 后台定期爬取已自动运行，无需手动调用
 *
 * ⚠️ 说明：
 * - `BackgroundCrawlerManager` 会在 Service Worker 启动时自动创建定期爬取任务
 * - 使用 `chrome.alarms` API，每小时自动触发
 * - 如需修改间隔，请在 `background/crawler-manager.ts` 中配置 `periodInMinutes`
 */
export function startPeriodicCrawl(intervalHours: number = 24): void {
  logger.warn(
    'CrawlTrigger',
    '⚠️ startPeriodicCrawl 已废弃，后台定期爬取已自动运行'
  )
  logger.info(
    'CrawlTrigger',
    `后台爬取管理器已自动启动，间隔 60 分钟（忽略参数 ${intervalHours} 小时）`
  )
}

/**
 * 停止定时爬取任务
 *
 * @deprecated 定期爬取是核心功能，不应停止
 *
 * ⚠️ 说明：
 * - 如果确实需要停止，请在 Service Worker Console 中执行：
 *   `chrome.alarms.clear('crawl-periodic')`
 * - 或在 `background/crawler-manager.ts` 中修改逻辑
 */
export function stopPeriodicCrawl(): void {
  logger.warn(
    'CrawlTrigger',
    '⚠️ stopPeriodicCrawl 已废弃，定期爬取由后台管理，不应手动停止'
  )
}

/**
 * 监听书签变化，自动爬取新书签
 *
 * @deprecated 应该在 Service Worker 中监听书签事件
 *
 * ⚠️ 迁移说明：
 * - 此函数应该在 `background/bookmarks.ts` 中实现
 * - Service Worker 更适合监听全局事件
 * - 前端页面可能未打开，无法监听
 *
 * 参考实现：
 * ```typescript
 * // frontend/src/background/bookmarks.ts
 * chrome.bookmarks.onCreated.addListener(async (_id, bookmark) => {
 *   if (bookmark.url) {
 *     // 通过后台爬取管理器处理
 *     await backgroundCrawlerManager.handleNewBookmark(bookmark.id)
 *   }
 * })
 * ```
 */
export function startAutocrawlOnBookmarkAdd(): void {
  logger.warn('CrawlTrigger', '⚠️ startAutocrawlOnBookmarkAdd 已废弃')
  logger.info(
    'CrawlTrigger',
    '书签事件监听应该在 Service Worker (background/bookmarks.ts) 中实现'
  )
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
  // ✅ 确保 IndexedDB 已初始化
  await indexedDBManager.initialize()

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
  crawlChromeBookmarks: typeof crawlChromeBookmarks
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
  // 延迟初始化，避免在Service Worker环境中立即执行
  const initGlobalCrawler = () => {
    globalThis.bookmarkCrawler = {
      crawlUnprocessed: crawlUnprocessedBookmarks,
      crawlByIds: crawlBookmarksByIds,
      crawlChromeBookmarks,
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

  // 在Service Worker环境中延迟初始化
  if (typeof document === 'undefined') {
    // Service Worker环境，延迟初始化
    setTimeout(initGlobalCrawler, 100)
  } else {
    // 浏览器环境，立即初始化
    initGlobalCrawler()
  }
}
