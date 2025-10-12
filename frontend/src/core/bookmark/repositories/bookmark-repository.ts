import type { Result } from '@/core/common/result'
import {
  indexedDBManager,
  type BookmarkRecord
} from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

export class BookmarkRepository {
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
      logger.error('BookmarkRepository', 'getChildrenByParentId failed', e)
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async getGlobalStats(): Promise<Result<unknown>> {
    try {
      await indexedDBManager.initialize()
      const data = await indexedDBManager.getGlobalStats()
      return Ok(data)
    } catch (e: unknown) {
      logger.error('BookmarkRepository', 'getGlobalStats failed', e)
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}

export const bookmarkRepository = new BookmarkRepository()
