import { Ok, Err, type Result } from '@/core/common/result';
import { indexedDBManager, type BookmarkRecord } from '@/infrastructure/indexeddb/manager';
import { logger } from '@/infrastructure/logging/logger';

export class BookmarkRepository {
  async getAllBookmarks(): Promise<Result<BookmarkRecord[]>> {
    try {
      await indexedDBManager.initialize();
      const data = await indexedDBManager.getAllBookmarks();
      return Ok(data);
    } catch (e: any) {
      logger.error('BookmarkRepository', 'getAllBookmarks failed', e);
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getChildrenByParentId(parentId: string): Promise<Result<BookmarkRecord[]>> {
    try {
      await indexedDBManager.initialize();
      const data = await indexedDBManager.getChildrenByParentId(parentId);
      return Ok(data);
    } catch (e: any) {
      logger.error('BookmarkRepository', 'getChildrenByParentId failed', e);
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

export const bookmarkRepository = new BookmarkRepository();
