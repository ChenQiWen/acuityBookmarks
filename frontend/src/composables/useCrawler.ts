/**
 * 爬取功能 Composable
 *
 * 提供简单的 API 在任何 Vue 组件中使用后台爬取功能
 *
 * @example
 * ```vue
 * <script setup>
 * import { useCrawler } from '@/composables/useCrawler'
 *
 * const {
 *   progress,
 *   isRunning,
 *   startCrawl,
 *   pause,
 *   resume,
 *   cancel
 * } = useCrawler()
 *
 * // 启动爬取
 * await startCrawl({ bookmarkIds: ['1', '2', '3'] })
 * </script>
 *
 * <template>
 *   <ProgressBar v-if="isRunning" :value="progress" />
 * </template>
 * ```
 */

import { ref, onUnmounted, computed } from 'vue'
import { createCrawlerClient } from '@/services/background-crawler-client'
import type { QueueStatistics } from '@/services/crawl-task-scheduler'
import { logger } from '@/infrastructure/logging/logger'

export interface UseCrawlerOptions {
  /**
   * 是否在组件挂载时自动获取当前进度
   */
  autoLoadProgress?: boolean

  /**
   * 进度更新回调
   */
  onProgress?: (stats: QueueStatistics) => void

  /**
   * 完成回调
   */
  onComplete?: (stats: QueueStatistics) => void

  /**
   * 错误回调
   */
  onError?: (error: { message: string }) => void
}

export function useCrawler(options: UseCrawlerOptions = {}) {
  // ==================== 状态 ====================

  /** 爬取统计信息 */
  const stats = ref<QueueStatistics>({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    running: 0,
    paused: 0,
    progress: 0
  })

  /** 是否正在爬取 */
  const isRunning = computed(() => stats.value.running > 0)

  /** 是否已暂停 */
  const isPaused = computed(() => stats.value.paused > 0)

  /** 进度百分比 (0-100) */
  const progress = computed(() => stats.value.progress)

  /** 已完成数量 */
  const completed = computed(() => stats.value.completed)

  /** 失败数量 */
  const failed = computed(() => stats.value.failed)

  /** 总数 */
  const total = computed(() => stats.value.total)

  /** 错误信息 */
  const error = ref<string | null>(null)

  // ==================== 客户端 ====================

  const client = createCrawlerClient()

  // 监听进度更新
  const unsubscribeProgress = client.onProgress(newStats => {
    stats.value = newStats
    options.onProgress?.(newStats)
  })

  // 监听完成
  const unsubscribeComplete = client.onComplete(newStats => {
    stats.value = newStats
    logger.info('useCrawler', '🎉 爬取完成', newStats)
    options.onComplete?.(newStats)
  })

  // 监听错误
  const unsubscribeError = client.onError(err => {
    error.value = err.message
    logger.error('useCrawler', '❌ 爬取错误', err)
    options.onError?.(err)
  })

  // 自动加载当前进度
  if (options.autoLoadProgress) {
    client.getProgress().then(currentStats => {
      if (currentStats) {
        stats.value = currentStats
      }
    })
  }

  // ==================== 方法 ====================

  /**
   * 启动爬取
   */
  async function startCrawl(params?: {
    bookmarkIds?: string[]
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    respectRobots?: boolean
  }): Promise<boolean> {
    try {
      error.value = null

      const result = await client.startCrawl({
        bookmarkIds: params?.bookmarkIds,
        priority: params?.priority || 'high',
        respectRobots: params?.respectRobots ?? true
      })

      if (!result.success) {
        error.value = result.error || '启动爬取失败'
        return false
      }

      logger.info('useCrawler', '✅ 爬取已启动')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      logger.error('useCrawler', '启动爬取失败', err)
      return false
    }
  }

  /**
   * 暂停爬取
   */
  async function pause(): Promise<boolean> {
    try {
      const success = await client.pause()
      if (success) {
        logger.info('useCrawler', '⏸️ 爬取已暂停')
      }
      return success
    } catch (err) {
      logger.error('useCrawler', '暂停爬取失败', err)
      return false
    }
  }

  /**
   * 恢复爬取
   */
  async function resume(): Promise<boolean> {
    try {
      const success = await client.resume()
      if (success) {
        logger.info('useCrawler', '▶️ 爬取已恢复')
      }
      return success
    } catch (err) {
      logger.error('useCrawler', '恢复爬取失败', err)
      return false
    }
  }

  /**
   * 取消爬取
   */
  async function cancel(): Promise<boolean> {
    try {
      const success = await client.cancel()
      if (success) {
        logger.info('useCrawler', '⏹️ 爬取已取消')
        // 重置状态
        stats.value = {
          total: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          running: 0,
          paused: 0,
          progress: 0
        }
      }
      return success
    } catch (err) {
      logger.error('useCrawler', '取消爬取失败', err)
      return false
    }
  }

  /**
   * 刷新当前进度
   */
  async function refreshProgress(): Promise<void> {
    try {
      const currentStats = await client.getProgress()
      if (currentStats) {
        stats.value = currentStats
      }
    } catch (err) {
      logger.error('useCrawler', '刷新进度失败', err)
    }
  }

  /**
   * 切换暂停/恢复
   */
  async function togglePause(): Promise<boolean> {
    if (isPaused.value) {
      return await resume()
    } else {
      return await pause()
    }
  }

  // ==================== 清理 ====================

  onUnmounted(() => {
    unsubscribeProgress()
    unsubscribeComplete()
    unsubscribeError()
    client.dispose()
  })

  // ==================== 返回 ====================

  return {
    // 状态
    stats,
    isRunning,
    isPaused,
    progress,
    completed,
    failed,
    total,
    error,

    // 方法
    startCrawl,
    pause,
    resume,
    cancel,
    togglePause,
    refreshProgress
  }
}
