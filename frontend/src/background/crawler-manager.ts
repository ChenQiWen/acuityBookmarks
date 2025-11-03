/**
 * 后台爬取管理器
 *
 * 职责：
 * - 在 Service Worker 后台运行爬取调度器
 * - 使用 chrome.alarms 定期触发自动爬取
 * - 响应前端页面的手动爬取请求
 * - 广播爬取进度到所有打开的页面
 *
 * 架构：
 * - 调度器运行在 Service Worker（持续可用）
 * - 使用 Offscreen Document 进行 DOM 解析
 * - 通过 chrome.runtime.sendMessage 与前端通信
 */

import { logger } from '@/infrastructure/logging/logger'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import {
  crawlTaskScheduler,
  type CrawlOptions,
  type QueueStatistics
} from '@/services/crawl-task-scheduler'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

/**
 * ✅ 优化：后台爬取管理器（事件驱动）
 *
 * @remarks
 * 架构优化说明：
 * - 移除周期性爬取（避免浪费资源）
 * - 改为事件驱动：新书签创建时立即爬取
 * - 保留消息监听器以响应前端手动触发
 */
export class BackgroundCrawlerManager {
  private readonly ALARM_NAME = 'crawl-periodic' as const

  constructor() {
    this.initialize()
  }

  /**
   * 初始化管理器
   */
  private async initialize() {
    logger.info(
      'BackgroundCrawler',
      '🚀 初始化后台爬取管理器（事件驱动模式）...'
    )

    // 1. 清除旧的周期性 alarm（向后兼容）
    this.clearLegacyPeriodicCrawl()

    // 2. 注册消息监听器（响应前端请求）
    this.registerMessageListener()

    logger.info(
      'BackgroundCrawler',
      '✅ 后台爬取管理器初始化完成（事件驱动模式）'
    )
  }

  // ==================== 清理旧配置 ====================

  /**
   * 清除旧的周期性爬取 alarm（向后兼容）
   */
  private clearLegacyPeriodicCrawl() {
    chrome.alarms.clear(this.ALARM_NAME, wasCleared => {
      if (wasCleared) {
        logger.info(
          'BackgroundCrawler',
          '✅ 已清除旧的周期性爬取定时器（优化：改为事件驱动）'
        )
      }
    })
  }

  // ==================== 消息监听 ====================

  /**
   * 注册消息监听器（响应前端页面请求）
   */
  private registerMessageListener() {
    /**
     * 统一的消息处理包装器，确保所有异步操作都有错误处理
     */
    const safeHandler = async (
      handler: () => Promise<unknown>,
      sendResponse: (response: unknown) => void
    ): Promise<void> => {
      try {
        const result = await handler()
        sendResponse({ success: true, data: result })
      } catch (error) {
        logger.error('BackgroundCrawler', '消息处理失败', error)
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      logger.debug('BackgroundCrawler', '收到消息', { type: message.type })

      // 1. 启动爬取
      if (message.type === 'START_CRAWL') {
        safeHandler(() => this.handleStartCrawl(message.data), sendResponse)
        return true // 异步响应
      }

      // 2. 获取爬取进度
      if (message.type === 'GET_CRAWL_PROGRESS') {
        try {
          const progress = crawlTaskScheduler.getStatistics()
          sendResponse({ success: true, progress })
        } catch (error) {
          logger.error('BackgroundCrawler', '获取进度失败', error)
          sendResponse({ success: false, error: String(error) })
        }
        return false
      }

      // 3. 暂停爬取
      if (message.type === 'PAUSE_CRAWL') {
        try {
          crawlTaskScheduler.pause()
          sendResponse({ success: true })
        } catch (error) {
          logger.error('BackgroundCrawler', '暂停失败', error)
          sendResponse({ success: false, error: String(error) })
        }
        return false
      }

      // 4. 恢复爬取
      if (message.type === 'RESUME_CRAWL') {
        try {
          crawlTaskScheduler.resume()
          sendResponse({ success: true })
        } catch (error) {
          logger.error('BackgroundCrawler', '恢复失败', error)
          sendResponse({ success: false, error: String(error) })
        }
        return false
      }

      // 5. 取消爬取
      if (message.type === 'CANCEL_CRAWL') {
        try {
          crawlTaskScheduler.cancelAll()
          sendResponse({ success: true })
        } catch (error) {
          logger.error('BackgroundCrawler', '取消失败', error)
          sendResponse({ success: false, error: String(error) })
        }
        return false
      }

      // 未知消息类型
      logger.warn('BackgroundCrawler', '未知消息类型', { type: message.type })
      sendResponse({ success: false, error: `未知消息类型: ${message.type}` })
      return false
    })

    logger.info('BackgroundCrawler', '✅ 消息监听器已注册')
  }

  // ==================== 爬取逻辑 ====================

  /**
   * 处理手动爬取请求（前端页面触发）
   */
  private async handleStartCrawl(data: {
    bookmarkIds?: string[]
    options?: CrawlOptions
  }) {
    try {
      logger.info('BackgroundCrawler', '🚀 处理手动爬取请求...')

      await indexedDBManager.initialize()

      let bookmarks: BookmarkRecord[]

      // 如果指定了书签 ID，只爬取这些书签
      if (data.bookmarkIds && data.bookmarkIds.length > 0) {
        logger.info(
          'BackgroundCrawler',
          `爬取指定书签: ${data.bookmarkIds.length} 个`
        )
        bookmarks = await this.getBookmarksByIds(data.bookmarkIds)
      } else {
        // 否则爬取所有未处理的书签
        logger.info('BackgroundCrawler', '爬取所有未处理的书签')
        const allBookmarks = await indexedDBManager.getAllBookmarks()
        bookmarks = this.filterUnprocessedBookmarks(allBookmarks)
      }

      if (bookmarks.length === 0) {
        logger.info('BackgroundCrawler', '✅ 没有需要爬取的书签')
        return
      }

      const chromeBookmarks = this.convertToChromeBookmarks(bookmarks)

      // 启动爬取（高优先级）
      await this.startCrawl(chromeBookmarks, {
        priority: data.options?.priority || 'high',
        respectRobots: data.options?.respectRobots ?? true,
        ...data.options
      })

      logger.info('BackgroundCrawler', '✅ 手动爬取已启动')
    } catch (error) {
      logger.error('BackgroundCrawler', '❌ 手动爬取失败', error)
      throw error
    }
  }

  /**
   * 启动爬取
   */
  private async startCrawl(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[],
    options: CrawlOptions
  ) {
    await crawlTaskScheduler.scheduleBookmarksCrawl(bookmarks, {
      ...options,
      // 进度回调：广播到所有页面
      onProgress: stats => {
        this.broadcastProgress(stats)
      },
      // 任务完成回调
      onTaskComplete: task => {
        this.broadcastTaskComplete(task)
      },
      // 全部完成回调
      onComplete: stats => {
        this.broadcastComplete(stats)
      },
      // 错误回调
      onError: error => {
        this.broadcastError(error)
      }
    })
  }

  // ==================== 工具方法 ====================

  /**
   * 筛选未处理的书签
   */
  private filterUnprocessedBookmarks(
    bookmarks: BookmarkRecord[]
  ): BookmarkRecord[] {
    return bookmarks.filter(bookmark => {
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
  }

  /**
   * 根据 ID 获取书签
   */
  private async getBookmarksByIds(ids: string[]): Promise<BookmarkRecord[]> {
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const idSet = new Set(ids)
    return allBookmarks.filter(b => idSet.has(b.id))
  }

  /**
   * 转换为 Chrome 书签格式
   */
  private convertToChromeBookmarks(
    bookmarks: BookmarkRecord[]
  ): chrome.bookmarks.BookmarkTreeNode[] {
    return bookmarks.map(
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
  }

  // ==================== 进度广播 ====================

  /**
   * 广播进度到所有页面
   */
  private broadcastProgress(stats: QueueStatistics) {
    chrome.runtime.sendMessage(
      {
        type: 'CRAWL_PROGRESS_UPDATE',
        data: stats
      },
      () => {
        // 忽略错误（可能没有页面在监听）
        if (chrome.runtime.lastError) {
          // 静默忽略
        }
      }
    )
  }

  /**
   * 广播任务完成
   */
  private broadcastTaskComplete(task: unknown) {
    chrome.runtime.sendMessage(
      {
        type: 'CRAWL_TASK_COMPLETE',
        data: task
      },
      () => {
        if (chrome.runtime.lastError) {
          // 静默忽略
        }
      }
    )
  }

  /**
   * 广播全部完成
   */
  private broadcastComplete(stats: QueueStatistics) {
    chrome.runtime.sendMessage(
      {
        type: 'CRAWL_COMPLETE',
        data: stats
      },
      () => {
        if (chrome.runtime.lastError) {
          // 静默忽略
        }
      }
    )

    logger.info('BackgroundCrawler', '🎉 爬取全部完成', stats)
  }

  /**
   * 广播错误
   */
  private broadcastError(error: Error) {
    chrome.runtime.sendMessage(
      {
        type: 'CRAWL_ERROR',
        data: { message: error.message }
      },
      () => {
        if (chrome.runtime.lastError) {
          // 静默忽略
        }
      }
    )

    logger.error('BackgroundCrawler', '❌ 爬取错误', error)
  }
}

/**
 * 全局单例实例
 */
export const backgroundCrawlerManager = new BackgroundCrawlerManager()
