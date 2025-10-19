/**
 * 书签仓储层
 *
 * 职责：
 * - 提供书签数据的访问接口，隔离核心业务与基础设施层
 * - 统一错误处理，将所有结果封装为 Result<T> 类型
 * - 管理 IndexedDB 的初始化和数据操作
 */

import type { Result } from '@/core/common/result'
import { ok as Ok, err as Err } from '@/core/common/result'
import {
  indexedDBManager,
  type BookmarkRecord
} from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签仓储类
 *
 * 负责书签数据的持久化操作，是核心层与基础设施层的桥梁
 */
export class BookmarkRepository {
  /**
   * 获取所有书签记录
   *
   * @param limit - 可选的返回数量限制
   * @param offset - 可选的偏移量（用于分页）
   * @returns 包含书签记录数组的 Result 对象
   */
  async getAllBookmarks(
    limit?: number,
    offset?: number
  ): Promise<Result<BookmarkRecord[]>> {
    try {
      await indexedDBManager.initialize()
      const data = await indexedDBManager.getAllBookmarks(limit, offset)
      return Ok(data)
    } catch (e: unknown) {
      logger.error('BookmarkRepository', 'getAllBookmarks failed', e)
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  /**
   * 根据父节点ID获取子节点列表
   *
   * @param parentId - 父节点的唯一标识符
   * @param offset - 可选的偏移量，默认为 0
   * @param limit - 可选的返回数量限制
   * @returns 包含子节点记录数组的 Result 对象
   */
  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<Result<BookmarkRecord[]>> {
    try {
      await indexedDBManager.initialize()
      const data = await indexedDBManager.getChildrenByParentId(
        parentId,
        offset ?? 0,
        limit
      )
      return Ok(data)
    } catch (e: unknown) {
      logger.error(
        'Component',
        'BookmarkRepository',
        'getChildrenByParentId failed',
        e
      )
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  /**
   * 获取全局统计数据
   *
   * @returns 包含全局统计信息的 Result 对象
   */
  async getGlobalStats(): Promise<Result<unknown>> {
    try {
      await indexedDBManager.initialize()
      const data = await indexedDBManager.getGlobalStats()
      return Ok(data)
    } catch (e: unknown) {
      logger.error(
        'Component',
        'BookmarkRepository',
        'getGlobalStats failed',
        e
      )
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}

/**
 * 书签仓储单例实例
 *
 * 全局共享的仓储实例，避免重复创建
 */
export const bookmarkRepository = new BookmarkRepository()
