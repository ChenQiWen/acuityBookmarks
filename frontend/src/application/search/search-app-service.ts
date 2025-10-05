import { indexedDBManager, type SearchResult } from '@/infrastructure/indexeddb/manager';
import { SearchEngine } from '@/core/search/engine';
import { FuseSearchStrategy } from '@/core/search/strategies/fuse-strategy';

export class SearchAppService {
  private engine = new SearchEngine(new FuseSearchStrategy());

  async search(query: string): Promise<SearchResult[]> {
    await indexedDBManager.initialize();
    const data = await indexedDBManager.getAllBookmarks();
    return this.engine.search(query, data);
  }
}

export const searchAppService = new SearchAppService();
