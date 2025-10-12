/**
 * 应用层：书签查询服务
 *
 * 职责：
 * - 对外提供书签记录读取接口（全部、按父节点、全局统计）；
 * - 依赖核心仓储 `bookmarkRepository`，保持应用层与数据访问的分离；
 * - 所有方法返回 `Result<T>`，便于统一错误处理与 UI 通知。
 */
import type { Result } from '@/core/common/result'
// 仅导入类型，不导入函数（此服务不直接使用 ok/err）
import { bookmarkRepository } from '@/core/bookmark/repositories/bookmark-repository'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'

export class BookmarkAppService {
  /**
   * 读取全部书签记录（含文件夹与书签），从 IndexedDB 仓储获取。
   */
  async getAllBookmarks(
    limit?: number,
    offset?: number
  ): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getAllBookmarks(limit, offset)
  }

  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getChildrenByParentId(parentId, offset, limit)
  }

  async getGlobalStats(): Promise<Result<unknown>> {
    return bookmarkRepository.getGlobalStats()
  }
}

export const bookmarkAppService = new BookmarkAppService()
