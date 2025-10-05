// 基础设施桥接：IndexedDB 管理器
// 保持现有 API，不破坏调用方；后续可逐步收敛到接口
export { IndexedDBManager, indexedDBManager } from '@/utils/indexeddb-manager';
export type {
  BookmarkRecord,
  GlobalStats,
  SearchOptions,
  SearchResult,
  DatabaseHealth,
  DatabaseStats,
  SearchHistoryRecord,
  FaviconCacheRecord,
  BatchOptions,
  CrawlMetadataRecord
} from '@/utils/indexeddb-schema';
export { DB_CONFIG as IDB_CONFIG } from '@/utils/indexeddb-schema';
