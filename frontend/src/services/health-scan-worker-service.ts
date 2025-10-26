/**
 * 健康扫描 Worker 服务
 *
 * 职责：
 * - 管理 health-scan-worker 的生命周期
 * - 提供进度回调接口
 * - 支持取消扫描
 * - 将评估结果写回 IndexedDB
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type {
  BookmarkRecord,
  CrawlMetadataRecord
} from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'

/** 健康扫描进度数据 */
export interface HealthScanProgress {
  current: number
  total: number
  percentage: number
  message: string
}

/** 进度回调函数类型 */
export type HealthProgressCallback = (progress: HealthScanProgress) => void

/** 单条书签的健康度评估结果 */
interface BookmarkHealthEvaluation {
  id: string
  tags: Array<'404' | 'duplicate' | 'empty' | 'invalid'>
  metadata: BookmarkRecord['healthMetadata']
}

/** Worker 发送的消息类型 */
interface WorkerOutputMessage {
  type: 'progress' | 'completed' | 'error' | 'cancelled'
  data?: {
    current?: number
    total?: number
    percentage?: number
    message?: string
    results?: BookmarkHealthEvaluation[]
    error?: string
  }
}

/** Worker 接收的消息类型 */
interface WorkerInputMessage {
  type: 'scan' | 'cancel'
  data?: {
    bookmarks: BookmarkRecord[]
    crawlMetadata: CrawlMetadataRecord[]
  }
}

/** 每批写入的最大条数 */
const HEALTH_WRITE_BATCH = 200

/**
 * 健康扫描 Worker 服务
 */
export class HealthScanWorkerService {
  private worker: Worker | null = null
  private progressCallbacks: Set<HealthProgressCallback> = new Set()
  private isScanning = false

  /**
   * 订阅进度更新
   *
   * @param callback - 进度回调函数
   * @returns 取消订阅的函数
   */
  onProgress(callback: HealthProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => {
      this.progressCallbacks.delete(callback)
    }
  }

  /**
   * 通知所有订阅者进度更新
   */
  private notifyProgress(progress: HealthScanProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress)
      } catch (error) {
        logger.error('HealthScanWorker', '进度回调执行失败', error)
      }
    })
  }

  /**
   * 检查是否正在扫描
   */
  isRunning(): boolean {
    return this.isScanning
  }

  /**
   * 开始健康度扫描
   *
   * @returns Promise，扫描完成时 resolve
   */
  async startScan(): Promise<void> {
    if (this.isScanning) {
      logger.warn('HealthScanWorker', '扫描已在进行中')
      return
    }

    this.isScanning = true
    logger.info('HealthScanWorker', '开始健康度扫描')

    try {
      // 1. 初始化 IndexedDB
      await indexedDBManager.initialize()

      // 2. 读取所有书签和爬虫元数据
      const [bookmarks, crawlMetadata] = await Promise.all([
        indexedDBManager.getAllBookmarks(),
        indexedDBManager.getAllCrawlMetadata()
      ])

      if (bookmarks.length === 0) {
        logger.info('HealthScanWorker', '没有书签需要扫描')
        this.isScanning = false
        return
      }

      // 3. 创建 Worker
      this.worker = new Worker(
        new URL('@/workers/health-scan-worker.ts', import.meta.url),
        { type: 'module' }
      )

      // 4. 监听 Worker 消息
      await new Promise<void>((resolve, reject) => {
        if (!this.worker) {
          reject(new Error('Worker 创建失败'))
          return
        }

        this.worker.onmessage = async (
          e: MessageEvent<WorkerOutputMessage>
        ) => {
          const { type, data } = e.data

          if (type === 'progress' && data) {
            // 进度更新
            this.notifyProgress({
              current: data.current ?? 0,
              total: data.total ?? 0,
              percentage: data.percentage ?? 0,
              message: data.message ?? ''
            })
          } else if (type === 'completed' && data?.results) {
            // 扫描完成，写回 IndexedDB
            try {
              await this.persistHealthEvaluations(data.results)
              logger.info('HealthScanWorker', '健康度扫描完成', {
                total: data.results.length
              })
              resolve()
            } catch (error) {
              logger.error('HealthScanWorker', '写入健康度数据失败', error)
              reject(error)
            } finally {
              this.cleanup()
            }
          } else if (type === 'error' && data?.error) {
            // 扫描失败
            logger.error('HealthScanWorker', '健康度扫描失败', data.error)
            this.cleanup()
            reject(new Error(data.error))
          } else if (type === 'cancelled') {
            // 扫描已取消
            logger.info('HealthScanWorker', '健康度扫描已取消')
            this.cleanup()
            resolve()
          }
        }

        this.worker.onerror = error => {
          logger.error('HealthScanWorker', 'Worker 错误', error)
          this.cleanup()
          reject(error)
        }

        // 5. 发送扫描任务
        const message: WorkerInputMessage = {
          type: 'scan',
          data: {
            bookmarks,
            crawlMetadata
          }
        }
        this.worker.postMessage(message)
      })
    } catch (error) {
      this.isScanning = false
      throw error
    }
  }

  /**
   * 取消扫描
   */
  cancel(): void {
    if (!this.isScanning || !this.worker) {
      return
    }

    logger.info('HealthScanWorker', '取消健康度扫描')

    const message: WorkerInputMessage = {
      type: 'cancel'
    }
    this.worker.postMessage(message)
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.isScanning = false
  }

  /**
   * 将评估结果批量写入 IndexedDB
   */
  private async persistHealthEvaluations(
    evaluations: BookmarkHealthEvaluation[]
  ): Promise<void> {
    const batches: BookmarkHealthEvaluation[][] = []
    for (let i = 0; i < evaluations.length; i += HEALTH_WRITE_BATCH) {
      batches.push(evaluations.slice(i, i + HEALTH_WRITE_BATCH))
    }

    for (const batch of batches) {
      await indexedDBManager.updateBookmarksHealth(
        batch.map(item => ({
          id: item.id,
          healthTags: item.tags,
          healthMetadata: item.metadata
        }))
      )
    }
  }
}

/**
 * 全局单例实例
 */
export const healthScanWorkerService = new HealthScanWorkerService()
