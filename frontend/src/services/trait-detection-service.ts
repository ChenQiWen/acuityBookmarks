/**
 * 特征检测 Worker 服务
 *
 * 职责：
 * - 管理 trait-detection-worker 的生命周期
 * - 提供进度回调接口
 * - 支持取消检测
 * - 将检测结果写回 IndexedDB
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type {
  BookmarkRecord,
  CrawlMetadataRecord
} from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'

/** 特征检测进度数据 */
export interface TraitDetectionProgress {
  current: number
  total: number
  percentage: number
  message: string
}

/** 进度回调函数类型 */
export type TraitProgressCallback = (progress: TraitDetectionProgress) => void

/** 单条书签的特征检测结果 */
interface BookmarkTraitEvaluation {
  id: string
  tags: Array<'duplicate' | 'invalid' | 'internal'>
  metadata: BookmarkRecord['traitMetadata']
}

/** Worker 发送的消息类型 */
interface WorkerOutputMessage {
  type: 'progress' | 'completed' | 'error' | 'cancelled'
  data?: {
    current?: number
    total?: number
    percentage?: number
    message?: string
    results?: BookmarkTraitEvaluation[]
    error?: string
  }
}

/** Worker 接收的消息类型 */
interface WorkerInputMessage {
  type: 'detect' | 'cancel'
  data?: {
    bookmarks: BookmarkRecord[]
    crawlMetadata: CrawlMetadataRecord[]
  }
}

/** 每批写入的最大条数 */
const TRAIT_WRITE_BATCH = 200

/**
 * 特征检测 Worker 服务
 */
export class TraitDetectionService {
  private worker: Worker | null = null
  private progressCallbacks: Set<TraitProgressCallback> = new Set()
  private isDetecting = false

  /**
   * 订阅进度更新
   *
   * @param callback - 进度回调函数
   * @returns 取消订阅的函数
   */
  onProgress(callback: TraitProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => {
      this.progressCallbacks.delete(callback)
    }
  }

  /**
   * 通知所有订阅者进度更新
   */
  private notifyProgress(progress: TraitDetectionProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress)
      } catch (error) {
        logger.error('TraitDetection', '进度回调执行失败', error)
      }
    })
  }

  /**
   * 检查是否正在检测
   */
  isRunning(): boolean {
    return this.isDetecting
  }

  /**
   * 开始特征检测
   *
   * @returns Promise，检测完成时 resolve
   */
  async startDetection(): Promise<void> {
    if (this.isDetecting) {
      logger.warn('TraitDetection', '⚠️ 检测已在进行中，跳过')
      return
    }

    this.isDetecting = true
    logger.info('TraitDetection', '🚀 开始特征检测')

    try {
      // 1. 初始化 IndexedDB
      logger.info('TraitDetection', '📦 初始化 IndexedDB...')
      await indexedDBManager.initialize()

      // 2. 读取所有书签和爬虫元数据
      logger.info('TraitDetection', '📖 读取书签和元数据...')
      const [bookmarks, crawlMetadata] = await Promise.all([
        indexedDBManager.getAllBookmarks(),
        indexedDBManager.getAllCrawlMetadata()
      ])

      logger.info(
        'TraitDetection',
        `✅ 数据加载完成：${bookmarks.length} 个书签，${crawlMetadata.length} 条元数据`
      )

      if (bookmarks.length === 0) {
        logger.info('TraitDetection', '没有书签需要检测')
        this.isDetecting = false
        return
      }

      // 3. 创建 Worker
      this.worker = new Worker(
        new URL('@/workers/trait-detection-worker.ts', import.meta.url),
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
            logger.debug(
              'TraitDetection',
              `📊 检测进度: ${data.current}/${data.total} (${data.percentage?.toFixed(1)}%)`
            )
            this.notifyProgress({
              current: data.current ?? 0,
              total: data.total ?? 0,
              percentage: data.percentage ?? 0,
              message: data.message ?? ''
            })
          } else if (type === 'completed' && data?.results) {
            // 检测完成，写回 IndexedDB
            logger.info(
              'TraitDetection',
              `✅ Worker 检测完成，开始写入 ${data.results.length} 条结果到 IndexedDB...`
            )
            try {
              await this.persistTraitEvaluations(data.results)
              logger.info('TraitDetection', '🎉 特征检测完成！', {
                total: data.results.length
              })

              // ✅ IndexedDB 写入完成后，发送最终的进度更新
              this.notifyProgress({
                current: data.results.length,
                total: data.results.length,
                percentage: 100,
                message: '检测完成'
              })

              resolve()
            } catch (error) {
              logger.error('TraitDetection', '❌ 写入特征数据失败', error)
              reject(error)
            } finally {
              this.cleanup()
            }
          } else if (type === 'error' && data?.error) {
            // 检测失败
            logger.error('TraitDetection', '❌ 特征检测失败', data.error)
            this.cleanup()
            reject(new Error(data.error))
          } else if (type === 'cancelled') {
            // 检测已取消
            logger.info('TraitDetection', '⏹️ 特征检测已取消')
            this.cleanup()
            resolve()
          }
        }

        this.worker.onerror = error => {
          logger.error('TraitDetection', 'Worker 错误', error)
          this.cleanup()
          reject(error)
        }

        // 5. 发送检测任务
        const message: WorkerInputMessage = {
          type: 'detect',
          data: {
            bookmarks,
            crawlMetadata
          }
        }
        this.worker.postMessage(message)
      })
    } catch (error) {
      this.isDetecting = false
      throw error
    }
  }

  /**
   * 取消检测
   */
  cancel(): void {
    if (!this.isDetecting || !this.worker) {
      return
    }

    logger.info('TraitDetection', '取消特征检测')

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
    this.isDetecting = false
  }

  /**
   * 将检测结果批量写入 IndexedDB
   */
  private async persistTraitEvaluations(
    evaluations: BookmarkTraitEvaluation[]
  ): Promise<void> {
    const batches: BookmarkTraitEvaluation[][] = []
    for (let i = 0; i < evaluations.length; i += TRAIT_WRITE_BATCH) {
      batches.push(evaluations.slice(i, i + TRAIT_WRITE_BATCH))
    }

    for (const batch of batches) {
      await indexedDBManager.updateBookmarksTraits(
        batch.map(item => ({
          id: item.id,
          traitTags: item.tags,
          traitMetadata: item.metadata
        }))
      )
    }
  }
}

/**
 * 全局单例实例
 */
export const traitDetectionService = new TraitDetectionService()
