/**
 * IndexedDB 管理器（架构迁移版）
 *
 * 职责：
 * - 向上提供统一的数据库访问接口；
 * - 当前阶段通过 `ports` 适配 legacy 实现，逐步替换为原生实现；
 * - 在迁移过程中保持 API 稳定，便于 DDD 各层调用。
 */

import type {
  AppSettings,
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
} from './types'

export type {
  AppSettings,
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
}

export { DB_CONFIG, INDEX_CONFIG } from './schema'

import type {
  IDBTransactionMode,
  TransactionOptions
} from './transaction-manager'
import type { IndexedDBPort } from './ports'
import { createIndexedDBPort } from './ports'

/**
 * IndexedDB 管理器
 *
 * 目前所有方法均委托给 `IndexedDBPort`（即 legacy 实现）。
 * 后续会在此文件中逐项替换为新的基础设施代码。
 */
export class IndexedDBManager implements IndexedDBPort {
  private readonly port: IndexedDBPort = createIndexedDBPort()

  async initialize(): Promise<void> {
    return this.port.initialize()
  }

  close(): void {
    this.port.close()
  }

  destroy(): void {
    this.port.destroy()
  }

  async withTransaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    handler: (tx: IDBTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.port.withTransaction(stores, mode, handler, options)
  }

  async insertBookmarks(
    bookmarks: BookmarkRecord[],
    options: BatchOptions<BookmarkRecord> = {}
  ): Promise<void> {
    return this.port.insertBookmarks(bookmarks, options)
  }

  async updateBookmark(bookmark: BookmarkRecord): Promise<void> {
    return this.port.updateBookmark(bookmark)
  }

  async deleteBookmark(id: string): Promise<void> {
    return this.port.deleteBookmark(id)
  }

  async deleteBookmarksBatch(
    ids: string[],
    options: BatchOptions<string> = {}
  ): Promise<void> {
    return this.port.deleteBookmarksBatch(ids, options)
  }

  async getBookmarkById(id: string): Promise<BookmarkRecord | null> {
    return this.port.getBookmarkById(id)
  }

  async getAllBookmarks(
    limit?: number,
    offset?: number
  ): Promise<BookmarkRecord[]> {
    return this.port.getAllBookmarks(limit, offset)
  }

  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<BookmarkRecord[]> {
    return this.port.getChildrenByParentId(parentId, offset, limit)
  }

  async searchBookmarks(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.port.searchBookmarks(query, options)
  }

  async updateGlobalStats(stats: GlobalStats): Promise<void> {
    return this.port.updateGlobalStats(stats)
  }

  async getGlobalStats(): Promise<GlobalStats | null> {
    return this.port.getGlobalStats()
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    return this.port.getDatabaseStats()
  }

  async checkDatabaseHealth(): Promise<DatabaseHealth> {
    return this.port.checkDatabaseHealth()
  }

  async saveSetting(
    key: string,
    value: unknown,
    type?: string,
    description?: string
  ): Promise<void> {
    return this.port.saveSetting(key, value, type, description)
  }

  async getSetting<T>(key: string): Promise<T | null> {
    return this.port.getSetting<T>(key)
  }

  async deleteSetting(key: string): Promise<void> {
    return this.port.deleteSetting(key)
  }

  async addSearchHistory(
    query: string,
    results: number,
    executionTime?: number,
    source?: SearchHistoryRecord['source']
  ): Promise<void> {
    return this.port.addSearchHistory(query, results, executionTime, source)
  }

  async getSearchHistory(limit?: number): Promise<SearchHistoryRecord[]> {
    return this.port.getSearchHistory(limit)
  }

  async clearSearchHistory(): Promise<void> {
    return this.port.clearSearchHistory()
  }

  async saveFaviconCache(record: FaviconCacheRecord): Promise<void> {
    return this.port.saveFaviconCache(record)
  }

  async getFaviconCache(domain: string): Promise<FaviconCacheRecord | null> {
    return this.port.getFaviconCache(domain)
  }

  async saveCrawlMetadata(metadata: CrawlMetadataRecord): Promise<void> {
    return this.port.saveCrawlMetadata(metadata)
  }

  async getCrawlMetadata(
    bookmarkId: string
  ): Promise<CrawlMetadataRecord | null> {
    return this.port.getCrawlMetadata(bookmarkId)
  }

  async getAllCrawlMetadata(): Promise<CrawlMetadataRecord[]> {
    return this.port.getAllCrawlMetadata()
  }

  async getBatchCrawlMetadata(
    bookmarkIds: string[]
  ): Promise<Map<string, CrawlMetadataRecord>> {
    return this.port.getBatchCrawlMetadata(bookmarkIds)
  }

  async deleteCrawlMetadata(bookmarkId: string): Promise<void> {
    return this.port.deleteCrawlMetadata(bookmarkId)
  }
}

export const indexedDBManager = new IndexedDBManager()
