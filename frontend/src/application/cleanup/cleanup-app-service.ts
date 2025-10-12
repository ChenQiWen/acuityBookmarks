/**
 * cleanup-app-service
 * 应用层：封装清理执行（批量删除书签/文件夹）。
 *
 * 设计约束：
 * - 不直接依赖 Pinia/UI，只提供纯业务能力与最小进度回调。
 * - 使用 Chrome Bookmarks 原生 API，按节点类型选择 remove / removeTree。
 * - 失败项记录错误，整体返回统计信息，便于 UI 通知。
 */

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

export class CleanupAppService {
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
