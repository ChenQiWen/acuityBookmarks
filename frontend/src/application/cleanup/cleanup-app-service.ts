/**
 * cleanup-app-service
 * 应用层：封装清理执行（批量删除书签/文件夹）。
 *
 * 设计约束：
 * - 不直接依赖 Pinia/UI，只提供纯业务能力与最小进度回调。
 * - 使用 Chrome Bookmarks 原生 API，按节点类型选择 remove / removeTree。
 * - 失败项记录错误，整体返回统计信息，便于 UI 通知。
 */

import type { Result } from '@/core/common/result'
import { ok, err } from '@/core/common/result'
import { logger } from '@/infrastructure/logging/logger'

// 临时保留本地类型定义，供内部使用
// TODO: 考虑将这些类型统一到 @/types/domain/cleanup
interface CleanupProgress {
  total: number
  completed: number
  failed: number
  currentId?: string
}

interface CleanupExecuteResult {
  success: number
  failed: number
  errors: Array<{ id: string; error: string }>
}

export interface CleanupSettings {
  removeDuplicates: boolean
  removeDeadLinks: boolean
  removeEmptyFolders: boolean
}

export class CleanupAppService {
  private initialized = false

  /**
   * 初始化服务
   */
  async initialize(): Promise<Result<void>> {
    try {
      if (this.initialized) {
        return ok(undefined)
      }

      logger.info('CleanupAppService', '初始化清理服务...')
      this.initialized = true
      return ok(undefined)
    } catch (error) {
      logger.error('CleanupAppService', '初始化失败', error)
      return err(new Error('初始化清理服务失败'))
    }
  }

  /**
   * 执行清理操作
   */
  async performCleanup(
    settings: CleanupSettings,
    onProgress?: (progress: number, step: string) => void
  ): Promise<Result<unknown[]>> {
    try {
      logger.info('CleanupAppService', '开始清理...', settings)

      const results: unknown[] = []

      // 这里应该根据 settings 执行实际的清理逻辑
      // 当前仅作为占位符实现
      onProgress?.(0, '准备清理...')

      // 示例：检测重复书签
      if (settings.removeDuplicates) {
        onProgress?.(30, '检测重复书签...')
        // TODO: 实现重复书签检测
      }

      // 示例：检测失效链接
      if (settings.removeDeadLinks) {
        onProgress?.(60, '检测失效链接...')
        // TODO: 实现失效链接检测
      }

      // 示例：清理空文件夹
      if (settings.removeEmptyFolders) {
        onProgress?.(90, '清理空文件夹...')
        // TODO: 实现空文件夹清理
      }

      onProgress?.(100, '清理完成')

      logger.info('CleanupAppService', '清理完成', {
        resultCount: results.length
      })
      return ok(results)
    } catch (error) {
      logger.error('Component', 'CleanupAppService', error)
      return err(error instanceof Error ? error : new Error('清理失败'))
    }
  }

  /**
   * 批量删除书签或文件夹（自动判断 remove 与 removeTree）。
   */
  async deleteBookmarks(
    ids: string[],
    opts: { onProgress?: (p: CleanupProgress) => void } = {}
  ): Promise<CleanupExecuteResult> {
    const total = ids.length
    let completed = 0
    let failed = 0
    const errors: Array<{ id: string; error: string }> = []

    for (const id of ids) {
      try {
        await this.deleteSingle(id)
      } catch (e: unknown) {
        failed++
        errors.push({ id, error: e instanceof Error ? e.message : String(e) })
      } finally {
        completed++
        opts.onProgress?.({ total, completed, failed, currentId: id })
      }
    }

    return { success: total - failed, failed, errors }
  }

  private async deleteSingle(id: string): Promise<void> {
    // 查询节点类型，决定 remove 还是 removeTree
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode | null>(
      (resolve, reject) => {
        try {
          chrome.bookmarks.get([id], results => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(results?.[0] ?? null)
            }
          })
        } catch (err) {
          reject(err)
        }
      }
    )

    if (!node) throw new Error('未找到书签节点')

    if (node.url) {
      // 普通书签
      await new Promise<void>((resolve, reject) => {
        try {
          chrome.bookmarks.remove(id, () => {
            if (chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message))
            else resolve()
          })
        } catch (err) {
          reject(err)
        }
      })
    } else {
      // 文件夹
      await new Promise<void>((resolve, reject) => {
        try {
          chrome.bookmarks.removeTree(id, () => {
            if (chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message))
            else resolve()
          })
        } catch (err) {
          reject(err)
        }
      })
    }
  }
}

export const cleanupAppService = new CleanupAppService()
