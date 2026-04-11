/**
 * 🎯 本地化爬取任务调度器
 *
 * 核心功能：
 * - 优先级队列管理
 * - 并发控制（全局 + 域名级别）
 * - 空闲调度（不影响用户体验）
 * - 断点续爬（持久化状态）
 * - 渐进式数据同步
 *
 * 隐私保护：
 * - 100% 本地执行
 * - 零数据上传
 * - 使用 Offscreen Document 解析
 */

import { logger } from '@/infrastructure/logging/logger'
import { CRAWLER_CONFIG, TIMEOUT_CONFIG } from '@/config/constants'
import { crawlBookmarkLocally, type CrawlResult } from './local-crawler-worker'
import { modernStorage } from '@/infrastructure/storage/modern-storage'

// ==================== 类型定义 ====================

export interface CrawlTask {
  id: string // 任务ID (URL hash)
  url: string // 书签URL
  bookmarkId: string // 书签ID
  bookmarkTitle: string // 书签标题
  priority: number // 优先级 (0-100)
  status: 'pending' | 'running' | 'success' | 'failed' | 'paused'
  retryCount: number // 重试次数
  createdAt: number // 创建时间
  startedAt?: number // 开始时间
  finishedAt?: number // 完成时间
  result?: CrawlResult // 爬取结果
  error?: string // 错误信息
}

export interface QueueStatistics {
  total: number // 总任务数
  completed: number // 已完成
  failed: number // 已失败
  pending: number // 待处理
  running: number // 运行中
  paused: number // 已暂停
  progress: number // 进度百分比 (0-100)
}

export interface CrawlOptions {
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  respectRobots?: boolean
  onProgress?: (progress: QueueStatistics) => void
  onTaskComplete?: (task: CrawlTask) => void
  onComplete?: (stats: QueueStatistics) => void
  onError?: (error: Error) => void
}

// ==================== 并发控制器 ====================

/**
 * 并发控制器：限制全局、域级任务并发，避免对站点造成压力。
 */
class ConcurrencyController {
  private readonly MAX_GLOBAL_CONCURRENT: number
  private readonly MAX_PER_DOMAIN_CONCURRENT: number
  private readonly MIN_DOMAIN_INTERVAL_MS: number

  private runningCount = 0
  private domainRunning = new Map<string, number>()
  private domainLastAccess = new Map<string, number>()

  constructor() {
    this.MAX_GLOBAL_CONCURRENT = CRAWLER_CONFIG.CONCURRENCY || 2
    this.MAX_PER_DOMAIN_CONCURRENT = CRAWLER_CONFIG.PER_DOMAIN_CONCURRENCY || 1
    this.MIN_DOMAIN_INTERVAL_MS = 1000
  }

  /** 判断是否可以启动指定 URL 的任务。 */
  canStartTask(url: string): boolean {
    try {
      const domain = new URL(url).hostname

      // 检查全局并发
      if (this.runningCount >= this.MAX_GLOBAL_CONCURRENT) {
        return false
      }

      // 检查域名并发
      const domainCount = this.domainRunning.get(domain) || 0
      if (domainCount >= this.MAX_PER_DOMAIN_CONCURRENT) {
        return false
      }

      // 检查域名间隔
      const lastAccess = this.domainLastAccess.get(domain) || 0
      if (Date.now() - lastAccess < this.MIN_DOMAIN_INTERVAL_MS) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  /** 等待直到可执行指定 URL 的任务。 */
  async waitForSlot(url: string): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.canStartTask(url)) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  startTask(url: string): void {
    try {
      const domain = new URL(url).hostname
      this.runningCount++
      this.domainRunning.set(domain, (this.domainRunning.get(domain) || 0) + 1)
      this.domainLastAccess.set(domain, Date.now())
    } catch (error) {
      logger.error('ConcurrencyController', 'Failed to start task', error)
    }
  }

  finishTask(url: string): void {
    try {
      const domain = new URL(url).hostname
      this.runningCount = Math.max(0, this.runningCount - 1)
      this.domainRunning.set(
        domain,
        Math.max(0, (this.domainRunning.get(domain) || 1) - 1)
      )
    } catch (error) {
      logger.error('ConcurrencyController', 'Failed to finish task', error)
    }
  }

  getStats() {
    return {
      runningCount: this.runningCount,
      domainsActive: this.domainRunning.size
    }
  }
}

// ==================== 空闲调度器 ====================

class IdleScheduler {
  private isUserActive = false
  private lastActivity = Date.now()
  private readonly USER_IDLE_THRESHOLD: number

  constructor() {
    this.USER_IDLE_THRESHOLD = CRAWLER_CONFIG.IDLE_DELAY_MS || 3000
    this.setupActivityDetection()
    this.setupVisibilityDetection()
  }

  private setupActivityDetection() {
    // Service Worker 环境检测
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      logger.debug('CrawlScheduler', 'Service Worker 环境，跳过用户活动检测')
      this.isUserActive = false // Service Worker 中认为用户不活跃
      return
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']

    const onActivity = () => {
      this.isUserActive = true
      this.lastActivity = Date.now()
    }

    events.forEach(event => {
      if (document && document.addEventListener) {
        document.addEventListener(event, onActivity, { passive: true })
      }
    })

    // 定期检查用户是否空闲
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        if (Date.now() - this.lastActivity > this.USER_IDLE_THRESHOLD) {
          this.isUserActive = false
        }
      }, 5000)
    }
  }

  private setupVisibilityDetection() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    if (document && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.isUserActive = false
        }
      })
    }
  }

  shouldContinueCrawling(): boolean {
    // 如果禁用了空闲调度，总是返回 true
    if (!CRAWLER_CONFIG.USE_IDLE_SCHEDULING) {
      return true
    }

    // 用户活跃时暂停
    if (this.isUserActive) return false

    // 页面隐藏时可以继续
    if (typeof document !== 'undefined' && document && document.hidden) {
      return true
    }

    // 用户空闲足够久时可以继续
    return Date.now() - this.lastActivity > this.USER_IDLE_THRESHOLD
  }

  async waitForIdleOrTimeout(
    timeout = TIMEOUT_CONFIG.CRAWLER.IDLE_WAIT
  ): Promise<void> {
    if (!CRAWLER_CONFIG.USE_IDLE_SCHEDULING) {
      return
    }

    const startTime = Date.now()

    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.shouldContinueCrawling() || Date.now() - startTime > timeout) {
          clearInterval(checkInterval)
          resolve()
        }
      }, TIMEOUT_CONFIG.DELAY.STANDARD) // 检查间隔
    })
  }
}

// ==================== 持久化队列 ====================

interface RawPersistedQueueState {
  tasks?: unknown
  statistics?: unknown
  timestamp?: unknown
}

class PersistentQueue {
  private readonly STORAGE_KEY = 'crawl_queue_state_v2'

  async saveState(
    tasks: CrawlTask[],
    statistics: QueueStatistics
  ): Promise<void> {
    if (!chrome?.storage?.local) {
      logger.warn(
        'PersistentQueue',
        'chrome.storage.local 不可用，跳过队列状态保存'
      )
      return
    }
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: {
          tasks: tasks.map(t => ({
            ...t,
            // 不保存运行中状态，重启后重新开始
            status: t.status === 'running' ? 'pending' : t.status
          })),
          statistics,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      logger.error('PersistentQueue', 'Failed to save state', error)
    }
  }

  async loadState(): Promise<{
    tasks: CrawlTask[]
    statistics: QueueStatistics
  } | null> {
    if (!chrome?.storage?.local) {
      logger.warn(
        'PersistentQueue',
        'chrome.storage.local 不可用，跳过队列状态恢复'
      )
      return null
    }
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY)
      const saved = this.parsePersistedState(result[this.STORAGE_KEY])

      if (!saved) return null

      // 检查状态是否太旧（超过7天）
      if (Date.now() - saved.timestamp > 7 * 24 * 60 * 60 * 1000) {
        await this.clearState()
        return null
      }

      return {
        tasks: saved.tasks,
        statistics: saved.statistics
      }
    } catch (error) {
      logger.error('PersistentQueue', 'Failed to load state', error)
      return null
    }
  }

  async clearState(): Promise<void> {
    if (!chrome?.storage?.local) {
      logger.warn(
        'PersistentQueue',
        'chrome.storage.local 不可用，跳过状态清除'
      )
      return
    }
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY)
    } catch (error) {
      logger.error('PersistentQueue', 'Failed to clear state', error)
    }
  }

  private getDefaultStatistics(): QueueStatistics {
    return {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      running: 0,
      paused: 0,
      progress: 0
    }
  }

  private isValidStatistics(value: unknown): value is QueueStatistics {
    if (!value || typeof value !== 'object') return false
    const stats = value as Partial<Record<keyof QueueStatistics, unknown>>
    const isNumber = (val: unknown): val is number =>
      typeof val === 'number' && Number.isFinite(val)

    return (
      isNumber(stats.total) &&
      isNumber(stats.completed) &&
      isNumber(stats.failed) &&
      isNumber(stats.pending) &&
      isNumber(stats.running) &&
      isNumber(stats.paused) &&
      isNumber(stats.progress)
    )
  }

  private parsePersistedState(value: unknown): {
    tasks: CrawlTask[]
    statistics: QueueStatistics
    timestamp: number
  } | null {
    if (!value || typeof value !== 'object') return null
    const raw = value as RawPersistedQueueState
    const timestamp =
      typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
        ? raw.timestamp
        : 0
    if (!timestamp) return null

    const tasks = Array.isArray(raw.tasks) ? (raw.tasks as CrawlTask[]) : []
    const statistics = this.isValidStatistics(raw.statistics)
      ? (raw.statistics as QueueStatistics)
      : this.getDefaultStatistics()

    return { tasks, statistics, timestamp }
  }
}

// ==================== 任务调度器主类 ====================

/**
 * 🔴 Session Storage Keys:
 * - `crawl_scheduler_is_running`: 调度器是否正在运行
 * - `crawl_scheduler_is_paused`: 调度器是否已暂停
 */
export class CrawlTaskScheduler {
  private readonly RUNNING_STATE_KEY = 'crawl_scheduler_is_running' as const
  private readonly PAUSED_STATE_KEY = 'crawl_scheduler_is_paused' as const

  private tasks: CrawlTask[] = []
  private runningTasks = new Map<string, CrawlTask>()
  private statistics: QueueStatistics = {
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    running: 0,
    paused: 0,
    progress: 0
  }

  private concurrencyController = new ConcurrencyController()
  private idleScheduler = new IdleScheduler()
  private persistentQueue = new PersistentQueue()

  // 🔴 迁移到 session storage：临时运行状态
  // private isRunning = false
  // private isPaused = false
  private currentOptions: CrawlOptions | null = null
  private completionTriggered = false // 防止重复触发完成回调

  constructor() {
    this.restoreState()
  }

  // ==================== Session Storage Helper ====================

  /**
   * 获取调度器运行状态
   */
  private async getIsRunning(): Promise<boolean> {
    return (
      (await modernStorage.getSession<boolean>(
        this.RUNNING_STATE_KEY,
        false
      )) ?? false
    )
  }

  /**
   * 设置调度器运行状态
   */
  private async setIsRunning(value: boolean): Promise<void> {
    await modernStorage.setSession(this.RUNNING_STATE_KEY, value)
  }

  /**
   * 获取调度器暂停状态
   */
  private async getIsPaused(): Promise<boolean> {
    return (
      (await modernStorage.getSession<boolean>(this.PAUSED_STATE_KEY, false)) ??
      false
    )
  }

  /**
   * 设置调度器暂停状态
   */
  private async setIsPaused(value: boolean): Promise<void> {
    await modernStorage.setSession(this.PAUSED_STATE_KEY, value)
  }

  // ==================== 公共 API ====================

  /**
   * 调度书签批量爬取
   */
  async scheduleBookmarksCrawl(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[],
    options: CrawlOptions = {}
  ): Promise<string> {
    const taskId = this.generateTaskId()
    this.currentOptions = options
    this.completionTriggered = false // 重置完成标志，确保新任务可以触发完成回调

    logger.info('CrawlScheduler', `📋 调度爬取任务: ${bookmarks.length} 个书签`)

    // 1. URL 去重
    const urlGroups = this.groupBookmarksByURL(bookmarks)
    logger.info(
      'CrawlScheduler',
      `🔗 URL去重: ${bookmarks.length} → ${urlGroups.size} 个唯一URL`
    )

    // 2. 创建任务
    const newTasks: CrawlTask[] = []
    const priorityMap = this.getPriorityMap(options.priority)

    for (const [url, group] of urlGroups.entries()) {
      // 使用优先级最高的书签作为代表
      const representative = this.selectRepresentative(group)

      const task: CrawlTask = {
        id: this.hashURL(url),
        url,
        bookmarkId: representative.id,
        bookmarkTitle: representative.title || '',
        priority: this.calculatePriority(representative, priorityMap),
        status: 'pending',
        retryCount: 0,
        createdAt: Date.now()
      }

      newTasks.push(task)
    }

    // 3. 按优先级排序
    newTasks.sort((a, b) => b.priority - a.priority)

    // 4. 添加到队列
    this.tasks.push(...newTasks)
    this.updateStatistics()

    // 5. 持久化
    await this.saveState()

    // 6. 启动执行
    const isRunning = await this.getIsRunning()
    if (!isRunning) {
      this.startExecution()
    }

    return taskId
  }

  /**
   * 暂停爬取
   */
  async pause(): Promise<void> {
    await this.setIsPaused(true)
    logger.info('CrawlScheduler', '⏸️ 爬取已暂停')
  }

  /**
   * 继续爬取
   */
  async resume(): Promise<void> {
    await this.setIsPaused(false)
    logger.info('CrawlScheduler', '▶️ 爬取已继续')

    const isRunning = await this.getIsRunning()
    if (!isRunning) {
      this.startExecution()
    }
  }

  /**
   * 取消所有任务
   */
  async cancelAll(): Promise<void> {
    await this.setIsPaused(true)
    await this.setIsRunning(false)
    this.tasks = []
    this.runningTasks.clear()
    this.updateStatistics()
    await this.persistentQueue.clearState()

    logger.info('CrawlScheduler', '❌ 所有任务已取消')
  }

  /**
   * 获取统计信息
   */
  getStatistics(): QueueStatistics {
    return { ...this.statistics }
  }

  /**
   * 获取所有任务
   */
  getTasks(): CrawlTask[] {
    return [...this.tasks]
  }

  // ==================== 私有方法 ====================

  private async startExecution(): Promise<void> {
    const isRunning = await this.getIsRunning()
    if (isRunning) return

    await this.setIsRunning(true)
    logger.info('CrawlScheduler', '🚀 开始执行爬取任务')

    let currentIsRunning = await this.getIsRunning()
    let currentIsPaused = await this.getIsPaused()

    while (currentIsRunning && !currentIsPaused) {
      // 1. 检查是否有待处理任务
      const pendingTasks = this.tasks.filter(t => t.status === 'pending')
      if (pendingTasks.length === 0) {
        break
      }

      // 2. 等待空闲时段
      if (CRAWLER_CONFIG.USE_IDLE_SCHEDULING) {
        await this.idleScheduler.waitForIdleOrTimeout() // 使用默认超时配置
      }

      // 3. 检查是否应该继续
      if (!this.idleScheduler.shouldContinueCrawling()) {
        await new Promise(resolve =>
          setTimeout(resolve, TIMEOUT_CONFIG.DELAY.CRAWLER_TASK_WAIT)
        )
        continue
      }

      // 4. 获取下一个可执行的任务
      const nextTask = pendingTasks.find(t =>
        this.concurrencyController.canStartTask(t.url)
      )

      if (!nextTask) {
        // 等待有任务完成
        await new Promise(resolve =>
          setTimeout(resolve, TIMEOUT_CONFIG.DELAY.CRAWLER_TASK_RETRY)
        )
        continue
      }

      // 5. 执行任务
      this.executeTask(nextTask)

      // 6. 批次间延迟
      await new Promise(resolve =>
        setTimeout(resolve, CRAWLER_CONFIG.BATCH_INTERVAL_MS || 1500)
      )

      // 🔴 重新检查状态
      currentIsRunning = await this.getIsRunning()
      currentIsPaused = await this.getIsPaused()
    }

    await this.setIsRunning(false)

    // 注意：完成回调已在 executeTask 的 finally 块中触发
    // 这里保留作为兜底检查（防止并发执行时的边界情况）
    if (
      !this.completionTriggered &&
      this.statistics.pending === 0 &&
      this.statistics.running === 0
    ) {
      this.completionTriggered = true
      logger.info(
        'CrawlScheduler',
        '✅ 所有任务已完成（兜底检查）',
        this.statistics
      )
      this.currentOptions?.onComplete?.(this.statistics)
    }
  }

  private async executeTask(task: CrawlTask): Promise<void> {
    // 1. 更新状态
    task.status = 'running'
    task.startedAt = Date.now()
    this.runningTasks.set(task.id, task)
    this.concurrencyController.startTask(task.url)
    this.updateStatistics()

    logger.info('CrawlScheduler', `🔍 开始爬取: ${task.url}`)

    try {
      // 2. 执行爬取
      const result = await crawlBookmarkLocally(task.url, {
        respectRobots: this.currentOptions?.respectRobots ?? true,
        timeout: TIMEOUT_CONFIG.CRAWLER.REQUEST
      })

      task.result = result
      task.finishedAt = Date.now()

      // 3. 处理结果
      if (result.success) {
        task.status = 'success'
        logger.info(
          'CrawlScheduler',
          `✅ 爬取成功: ${task.url} (${result.duration}ms)`
        )

        // 通知任务完成
        this.currentOptions?.onTaskComplete?.(task)
      } else {
        // 重试逻辑
        if (task.retryCount < 2 && this.shouldRetry(result)) {
          task.retryCount++
          task.status = 'pending'
          logger.warn(
            'CrawlScheduler',
            `🔄 重试任务 (${task.retryCount}/2): ${task.url}`
          )
        } else {
          task.status = 'failed'
          task.error = result.error
          logger.error(
            'CrawlScheduler',
            `❌ 爬取失败: ${task.url}`,
            result.error
          )
        }
      }
    } catch (error) {
      task.status = 'failed'
      task.error = String(error)
      task.finishedAt = Date.now()
      logger.error('CrawlScheduler', `❌ 任务异常: ${task.url}`, error)
    } finally {
      // 4. 清理
      this.runningTasks.delete(task.id)
      this.concurrencyController.finishTask(task.url)
      this.updateStatistics()

      // 5. 持久化
      await this.saveState()

      // 6. 通知进度
      this.currentOptions?.onProgress?.(this.statistics)

      // 7. 检查是否所有任务都已完成（在每个任务完成后都检查）
      if (
        !this.completionTriggered &&
        this.statistics.pending === 0 &&
        this.statistics.running === 0
      ) {
        this.completionTriggered = true
        logger.info('CrawlScheduler', '✅ 所有任务已完成', this.statistics)
        this.currentOptions?.onComplete?.(this.statistics)
      }
    }
  }

  private shouldRetry(result: CrawlResult): boolean {
    return result.errorType === 'timeout' || result.errorType === 'network'
  }

  private groupBookmarksByURL(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  ): Map<string, chrome.bookmarks.BookmarkTreeNode[]> {
    const groups = new Map<string, chrome.bookmarks.BookmarkTreeNode[]>()

    for (const bookmark of bookmarks) {
      if (!bookmark.url) continue

      const normalizedURL = this.normalizeURL(bookmark.url)

      if (!groups.has(normalizedURL)) {
        groups.set(normalizedURL, [])
      }

      groups.get(normalizedURL)!.push(bookmark)
    }

    return groups
  }

  private normalizeURL(url: string): string {
    try {
      const parsed = new URL(url)
      parsed.hash = ''

      // 移除常见追踪参数
      const trackingParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'ref',
        'source'
      ]
      trackingParams.forEach(param => parsed.searchParams.delete(param))

      return parsed.toString()
    } catch {
      return url
    }
  }

  private selectRepresentative(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  ): chrome.bookmarks.BookmarkTreeNode {
    // 优先选择最近访问的
    const sorted = bookmarks.sort((a, b) => {
      const aTime = a.dateLastUsed || a.dateAdded || 0
      const bTime = b.dateLastUsed || b.dateAdded || 0
      return bTime - aTime
    })

    return sorted[0]
  }

  private calculatePriority(
    bookmark: chrome.bookmarks.BookmarkTreeNode,
    baseScore: number
  ): number {
    let priority = baseScore

    // 最近添加优先
    if (bookmark.dateAdded) {
      const daysSinceAdded =
        (Date.now() - bookmark.dateAdded) / (1000 * 60 * 60 * 24)
      if (daysSinceAdded < 7) priority += 20
      else if (daysSinceAdded < 30) priority += 10
    }

    // 最近访问优先
    if (bookmark.dateLastUsed) {
      const daysSinceUsed =
        (Date.now() - bookmark.dateLastUsed) / (1000 * 60 * 60 * 24)
      if (daysSinceUsed < 1) priority += 20
      else if (daysSinceUsed < 7) priority += 10
    }

    return Math.min(100, Math.max(0, priority))
  }

  private getPriorityMap(level?: string): number {
    switch (level) {
      case 'urgent':
        return 90
      case 'high':
        return 70
      case 'normal':
        return 50
      case 'low':
        return 30
      default:
        return 50
    }
  }

  private updateStatistics(): void {
    this.statistics.total = this.tasks.length
    this.statistics.completed = this.tasks.filter(
      t => t.status === 'success'
    ).length
    this.statistics.failed = this.tasks.filter(
      t => t.status === 'failed'
    ).length
    this.statistics.pending = this.tasks.filter(
      t => t.status === 'pending'
    ).length
    this.statistics.running = this.runningTasks.size
    this.statistics.paused = this.tasks.filter(
      t => t.status === 'paused'
    ).length

    const finished = this.statistics.completed + this.statistics.failed
    this.statistics.progress =
      this.statistics.total > 0
        ? Math.round((finished / this.statistics.total) * 100)
        : 0
  }

  private async saveState(): Promise<void> {
    await this.persistentQueue.saveState(this.tasks, this.statistics)
  }

  private async restoreState(): Promise<void> {
    const saved = await this.persistentQueue.loadState()

    if (saved) {
      this.tasks = saved.tasks
      this.statistics = saved.statistics
      logger.info('CrawlScheduler', '📂 恢复队列状态', this.statistics)

      // 如果有未完成任务，自动继续执行（后台静默）
      if (this.statistics.pending > 0) {
        logger.info(
          'CrawlScheduler',
          `🔄 自动继续执行 ${this.statistics.pending} 个未完成的爬虫任务`
        )
        // 使用 requestIdleCallback 在浏览器空闲时启动，避免与主线程任务冲突
        this.scheduleResumeOnIdle()
      }
    }
  }

  /**
   * 在浏览器空闲时恢复任务执行
   */
  private scheduleResumeOnIdle(): void {
    // 优先使用 requestIdleCallback（浏览器原生空闲调度）
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(
        () => {
          logger.info('CrawlScheduler', '⏰ 浏览器空闲，开始恢复爬虫任务')
          this.startExecution()
        },
        { timeout: 10000 } // 最多等待 10 秒，避免永远不执行
      )
    } else {
      // 降级方案：使用 IdleScheduler 等待用户空闲（使用默认超时配置）
      this.idleScheduler.waitForIdleOrTimeout().then(() => {
        logger.info('CrawlScheduler', '⏰ 用户空闲，开始恢复爬虫任务')
        this.startExecution()
      })
    }
  }

  private hashURL(url: string): string {
    // 简单的哈希函数
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
}

// ==================== 导出单例 ====================

export const crawlTaskScheduler = new CrawlTaskScheduler()
