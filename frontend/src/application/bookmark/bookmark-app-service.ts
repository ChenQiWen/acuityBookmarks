import type { Result } from '@/core/common/result';
import { bookmarkRepository } from '@/core/bookmark/repositories/bookmark-repository';
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager';

export class BookmarkAppService {
  async getAllBookmarks(): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getAllBookmarks();
  }

  async getChildrenByParentId(parentId: string): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getChildrenByParentId(parentId);
  }
}

export const bookmarkAppService = new BookmarkAppService();
