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
import { crawlTaskScheduler } from '@/services/crawl-task-scheduler'

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
    // ❌ 已移除：safeHandler（不再需要手动触发处理）

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      logger.debug('BackgroundCrawler', '收到消息', { type: message.type })

      // ✅ 仅保留进度查询功能（用于显示，不用于控制）
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

      // ❌ 已移除所有手动控制功能（START_CRAWL, PAUSE_CRAWL, RESUME_CRAWL, CANCEL_CRAWL）
      // 爬取逻辑完全由系统内部自动触发，用户不可手动控制

      // 未知消息类型
      logger.debug('BackgroundCrawler', '未知消息类型（已忽略）', {
        type: message.type
      })
      sendResponse({ success: false, error: `未知消息类型: ${message.type}` })
      return false
    })

    logger.info('BackgroundCrawler', '✅ 消息监听器已注册')
  }

  // ==================== 爬取逻辑 ====================

  /**
   * ❌ 已移除：handleStartCrawl
   *
   * 爬取逻辑现在完全由系统内部自动触发：
   * - 新书签创建时自动爬取（bookmarks.ts 中的 onCreated 监听器）
   * - 用户不可手动触发
   */

  /**
   * ❌ 已移除：startCrawl
   *
   * 爬取逻辑现在完全由系统内部自动触发（bookmarks.ts 中的 onCreated 监听器）。
   * 不再需要手动触发爬取。
   */

  // ==================== 工具方法 ====================

  /**
   * ❌ 已移除：filterUnprocessedBookmarks
   *
   * 不再需要手动筛选书签，系统会自动处理。
   */

  /**
   * ❌ 已移除：getBookmarksByIds
   *
   * 不再需要手动获取书签，系统会自动处理。
   */

  /**
   * ❌ 已移除：convertToChromeBookmarks
   *
   * 不再需要手动转换，系统会自动处理。
   */
}

/**
 * 全局单例实例
 */
export const backgroundCrawlerManager = new BackgroundCrawlerManager()
