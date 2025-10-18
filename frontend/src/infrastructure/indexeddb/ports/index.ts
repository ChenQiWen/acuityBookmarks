/**
 * IndexedDB Port 接口
 *
 * 迁移阶段：先委托 legacy 实现，逐步替换方法体。
 */

import type {
  BatchOptions,
  BookmarkRecord,
  CrawlMetadataRecord,
  DatabaseHealth,
  DatabaseStats,
  FaviconCacheRecord,
  GlobalStats,
  SearchHistoryRecord,
  SearchOptions,
  SearchResult
} from '../types'
import type {
  IDBTransactionMode,
  TransactionOptions
} from '../transaction-manager'

import type { IndexedDBManager as LegacyIndexedDBManagerType } from '@/utils-legacy/indexeddb-manager'
import {
  IndexedDBManager as LegacyIndexedDBManager,
  indexedDBManager as legacyIndexedDBManager
} from '@/utils-legacy/indexeddb-manager'
import type {
  BatchOptions as LegacyBatchOptions,
  SearchResult as LegacySearchResult
} from '@/utils-legacy/indexeddb-schema'
import { withTransaction as withLegacyTransaction } from '../transaction-manager'

/**
 * 将基础批处理配置转换为 legacy 版本可识别的结构
 *
 * 说明：legacy 的 `errorCallback` 接受 `unknown`，而新版带有具体类型。
 * 这里通过包装函数向下兼容，同时保留类型安全提示。
 */
function mapBatchOptions<T>(
  options?: BatchOptions<T>
): LegacyBatchOptions | undefined {
  if (!options) return undefined
  const { errorCallback, ...rest } = options
  const normalized: LegacyBatchOptions = { ...rest }
  if (errorCallback) {
    normalized.errorCallback = (error, item) => {
      errorCallback(error, item as T)
    }
  }
  return normalized
}

/**
 * 将 legacy 搜索结果转换为新版结构
 *
 * 统一新增 `id` 字段，并把高亮映射为数组形式，便于前端消费。
 */
function mapSearchResults(results: LegacySearchResult[]): SearchResult[] {
  return results.map(result => {
    const highlightEntries = Object.entries(result.highlights ?? {}) as Array<
      [string, string[]]
    >
    const highlights = highlightEntries.flatMap(([field, matches]) =>
      matches.map(match => ({
        field: field as keyof BookmarkRecord,
        matchedText: match
      }))
    )

    return {
      id: result.bookmark.id,
      bookmark: result.bookmark,
      score: result.score,
      highlights: highlights.length > 0 ? highlights : undefined
    }
  })
}

export interface IndexedDBPort {
  initialize(): Promise<void>
  close(): void
  destroy(): void

  withTransaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    handler: (tx: IDBTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>

  insertBookmarks(
    bookmarks: BookmarkRecord[],
    options?: BatchOptions<BookmarkRecord>
  ): Promise<void>
  updateBookmark(bookmark: BookmarkRecord): Promise<void>
  deleteBookmark(id: string): Promise<void>
  deleteBookmarksBatch(
    ids: string[],
    options?: BatchOptions<string>
  ): Promise<void>

  getBookmarkById(id: string): Promise<BookmarkRecord | null>
  getAllBookmarks(limit?: number, offset?: number): Promise<BookmarkRecord[]>
  getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<BookmarkRecord[]>

  searchBookmarks(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>

  updateGlobalStats(stats: GlobalStats): Promise<void>
  getGlobalStats(): Promise<GlobalStats | null>
  getDatabaseStats(): Promise<DatabaseStats>
  checkDatabaseHealth(): Promise<DatabaseHealth>

  saveSetting(
    key: string,
    value: unknown,
    type?: string,
    description?: string
  ): Promise<void>
  getSetting<T>(key: string): Promise<T | null>
  deleteSetting(key: string): Promise<void>

  addSearchHistory(
    query: string,
    results: number,
    executionTime?: number,
    source?: SearchHistoryRecord['source']
  ): Promise<void>
  getSearchHistory(limit?: number): Promise<SearchHistoryRecord[]>
  clearSearchHistory(): Promise<void>

  saveFaviconCache(faviconRecord: FaviconCacheRecord): Promise<void>
  getFaviconCache(domain: string): Promise<FaviconCacheRecord | null>

  saveCrawlMetadata(metadata: CrawlMetadataRecord): Promise<void>
  getCrawlMetadata(bookmarkId: string): Promise<CrawlMetadataRecord | null>
  getAllCrawlMetadata(): Promise<CrawlMetadataRecord[]>
  getBatchCrawlMetadata(
    bookmarkIds: string[]
  ): Promise<Map<string, CrawlMetadataRecord>>
  deleteCrawlMetadata(bookmarkId: string): Promise<void>
}

export function createIndexedDBPort(): IndexedDBPort {
  const legacy: LegacyIndexedDBManagerType = legacyIndexedDBManager
  return {
    initialize: () => legacy.initialize(),
    close: () => legacy.close(),
    destroy: () => LegacyIndexedDBManager.destroy(),

    withTransaction: (stores, mode, handler, options) =>
      withLegacyTransaction(stores, mode, handler, options),

    insertBookmarks: (bookmarks, options) =>
      legacy.insertBookmarks(bookmarks, mapBatchOptions(options)),
    updateBookmark: bookmark => legacy.updateBookmark(bookmark),
    deleteBookmark: id => legacy.deleteBookmark(id),
    deleteBookmarksBatch: (ids, options) =>
      legacy.deleteBookmarksBatch(ids, mapBatchOptions(options)),

    getBookmarkById: id => legacy.getBookmarkById(id),
    getAllBookmarks: (limit, offset) => legacy.getAllBookmarks(limit, offset),
    getChildrenByParentId: (parentId, offset, limit) =>
      legacy.getChildrenByParentId(parentId, offset ?? 0, limit),

    searchBookmarks: async (query, options) =>
      mapSearchResults(await legacy.searchBookmarks(query, options)),

    updateGlobalStats: stats => legacy.updateGlobalStats(stats),
    getGlobalStats: () => legacy.getGlobalStats(),
    getDatabaseStats: () => legacy.getDatabaseStats(),
    checkDatabaseHealth: () => legacy.checkDatabaseHealth(),

    saveSetting: (key, value, type, description) =>
      legacy.saveSetting(key, value, type, description),
    getSetting: key => legacy.getSetting(key),
    deleteSetting: key => legacy.deleteSetting(key),

    addSearchHistory: (query, results, executionTime, source) =>
      legacy.addSearchHistory(query, results, executionTime, source),
    getSearchHistory: limit => legacy.getSearchHistory(limit),
    clearSearchHistory: () => legacy.clearSearchHistory(),

    saveFaviconCache: faviconRecord => legacy.saveFaviconCache(faviconRecord),
    getFaviconCache: domain => legacy.getFaviconCache(domain),

    saveCrawlMetadata: metadata => legacy.saveCrawlMetadata(metadata),
    getCrawlMetadata: bookmarkId => legacy.getCrawlMetadata(bookmarkId),
    getAllCrawlMetadata: () => legacy.getAllCrawlMetadata(),
    getBatchCrawlMetadata: bookmarkIds =>
      legacy.getBatchCrawlMetadata(bookmarkIds),
    deleteCrawlMetadata: bookmarkId => legacy.deleteCrawlMetadata(bookmarkId)
  }
}

export { LegacyIndexedDBManager }
