/**
 * 后台爬取客户端
 *
 * 职责：
 * - 为前端页面提供简单的 API 与后台爬取管理器通信
 * - 监听爬取进度更新
 * - 处理消息响应
 *
 * 使用示例：
 * ```typescript
 * const client = new BackgroundCrawlerClient()
 *
 * // 监听进度
 * client.onProgress((stats) => {
 *   progressBar.value = stats.progress
 * })
 *
 * // 启动爬取
 * await client.startCrawl({ bookmarkIds: ['1', '2', '3'] })
 * ```
 */

import { logger } from '@/infrastructure/logging/logger'
import type { QueueStatistics } from '@/services/crawl-task-scheduler'

export type ProgressCallback = (stats: QueueStatistics) => void
export type TaskCompleteCallback = (task: unknown) => void
export type CompleteCallback = (stats: QueueStatistics) => void
export type ErrorCallback = (error: { message: string }) => void

/**
 * 爬取消息类型
 */
type CrawlerMessage =
  | { type: 'CRAWL_PROGRESS_UPDATE'; data: QueueStatistics }
  | { type: 'CRAWL_TASK_COMPLETE'; data: unknown }
  | { type: 'CRAWL_COMPLETE'; data: QueueStatistics }
  | { type: 'CRAWL_ERROR'; data: { message: string } }

/**
 * 后台爬取客户端
 */
export class BackgroundCrawlerClient {
  private progressCallbacks: Set<ProgressCallback> = new Set()
  private taskCompleteCallbacks: Set<TaskCompleteCallback> = new Set()
  private completeCallbacks: Set<CompleteCallback> = new Set()
  private errorCallbacks: Set<ErrorCallback> = new Set()
  private messageListener: ((message: CrawlerMessage) => void) | null = null

  constructor() {
    this.setupMessageListener()
  }

  /**
   * 检查是否在 Chrome 扩展环境中
   */
  private isChromeExtension(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      typeof chrome.runtime !== 'undefined' &&
      typeof chrome.runtime.sendMessage === 'function'
    )
  }

  /**
   * 设置消息监听器
   */
  private setupMessageListener() {
    // ✅ 只在 Chrome 扩展环境中设置监听器
    if (!this.isChromeExtension()) {
      return
    }

    this.messageListener = (message: CrawlerMessage) => {
      // 进度更新
      if (message.type === 'CRAWL_PROGRESS_UPDATE') {
        this.notifyProgress(message.data)
      }

      // 任务完成
      if (message.type === 'CRAWL_TASK_COMPLETE') {
        this.notifyTaskComplete(message.data)
      }

      // 全部完成
      if (message.type === 'CRAWL_COMPLETE') {
        this.notifyComplete(message.data)
      }

      // 错误
      if (message.type === 'CRAWL_ERROR') {
        this.notifyError(message.data)
      }
    }

    chrome.runtime.onMessage.addListener(this.messageListener)
  }

  // ==================== 公共 API ====================

  /**
   * 启动爬取
   */
  async startCrawl(options?: {
    bookmarkIds?: string[]
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    respectRobots?: boolean
  }): Promise<{ success: boolean; error?: string }> {
    // ✅ 环境检查
    if (!this.isChromeExtension()) {
      logger.warn('CrawlerClient', '⚠️ 不在 Chrome 扩展环境中，无法启动爬取')
      return {
        success: false,
        error: 'Not in Chrome extension environment'
      }
    }

    try {
      logger.info('CrawlerClient', '发送启动爬取请求...', options)

      const response = await chrome.runtime.sendMessage({
        type: 'START_CRAWL',
        data: {
          bookmarkIds: options?.bookmarkIds,
          options: {
            priority: options?.priority || 'high',
            respectRobots: options?.respectRobots ?? true
          }
        }
      })

      if (response.success) {
        logger.info('CrawlerClient', '✅ 爬取已启动')
      } else {
        logger.error('CrawlerClient', '❌ 启动爬取失败', response.error)
      }

      return response
    } catch (error) {
      logger.error('CrawlerClient', '❌ 发送爬取请求失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 获取当前爬取进度
   */
  async getProgress(): Promise<QueueStatistics | null> {
    // ✅ 环境检查
    if (!this.isChromeExtension()) {
      return null
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CRAWL_PROGRESS'
      })

      if (response.success) {
        return response.progress
      }

      return null
    } catch (error) {
      logger.error('CrawlerClient', '获取爬取进度失败', error)
      return null
    }
  }

  /**
   * 暂停爬取
   */
  async pause(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'PAUSE_CRAWL'
      })
      return response.success
    } catch (error) {
      logger.error('CrawlerClient', '暂停爬取失败', error)
      return false
    }
  }

  /**
   * 恢复爬取
   */
  async resume(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RESUME_CRAWL'
      })
      return response.success
    } catch (error) {
      logger.error('CrawlerClient', '恢复爬取失败', error)
      return false
    }
  }

  /**
   * 取消爬取
   */
  async cancel(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CANCEL_CRAWL'
      })
      return response.success
    } catch (error) {
      logger.error('CrawlerClient', '取消爬取失败', error)
      return false
    }
  }

  // ==================== 事件监听 ====================

  /**
   * 监听进度更新
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => {
      this.progressCallbacks.delete(callback)
    }
  }

  /**
   * 监听任务完成
   */
  onTaskComplete(callback: TaskCompleteCallback): () => void {
    this.taskCompleteCallbacks.add(callback)
    return () => {
      this.taskCompleteCallbacks.delete(callback)
    }
  }

  /**
   * 监听全部完成
   */
  onComplete(callback: CompleteCallback): () => void {
    this.completeCallbacks.add(callback)
    return () => {
      this.completeCallbacks.delete(callback)
    }
  }

  /**
   * 监听错误
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback)
    return () => {
      this.errorCallbacks.delete(callback)
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 通知进度更新
   */
  private notifyProgress(stats: QueueStatistics) {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(stats)
      } catch (error) {
        logger.error('CrawlerClient', '进度回调执行失败', error)
      }
    })
  }

  /**
   * 通知任务完成
   */
  private notifyTaskComplete(task: unknown) {
    this.taskCompleteCallbacks.forEach(callback => {
      try {
        callback(task)
      } catch (error) {
        logger.error('CrawlerClient', '任务完成回调执行失败', error)
      }
    })
  }

  /**
   * 通知全部完成
   */
  private notifyComplete(stats: QueueStatistics) {
    this.completeCallbacks.forEach(callback => {
      try {
        callback(stats)
      } catch (error) {
        logger.error('CrawlerClient', '完成回调执行失败', error)
      }
    })
  }

  /**
   * 通知错误
   */
  private notifyError(error: { message: string }) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error)
      } catch (err) {
        logger.error('CrawlerClient', '错误回调执行失败', err)
      }
    })
  }

  // ==================== 清理 ====================

  /**
   * 清理资源
   */
  dispose() {
    // ✅ 只在 Chrome 扩展环境中清理监听器
    if (this.messageListener && this.isChromeExtension()) {
      chrome.runtime.onMessage.removeListener(this.messageListener)
      this.messageListener = null
    }

    this.progressCallbacks.clear()
    this.taskCompleteCallbacks.clear()
    this.completeCallbacks.clear()
    this.errorCallbacks.clear()
  }
}

/**
 * 创建客户端实例
 */
export function createCrawlerClient(): BackgroundCrawlerClient {
  return new BackgroundCrawlerClient()
}

/**
 * 全局单例：后台爬取客户端
 *
 * 在前端页面中使用：
 * ```typescript
 * import { backgroundCrawlerClient } from '@/services/background-crawler-client'
 *
 * // 启动爬取
 * await backgroundCrawlerClient.startCrawl(bookmarkIds, options)
 *
 * // 订阅进度
 * const unsubscribe = backgroundCrawlerClient.onProgress((stats) => {
 *   console.log(`进度: ${stats.completed}/${stats.total}`)
 * })
 * ```
 */
export const backgroundCrawlerClient = new BackgroundCrawlerClient()
