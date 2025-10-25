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
import { DB_CONFIG } from './schema'
import {
  BookmarkRecordArraySchema,
  BookmarkRecordSchema,
  BookmarkSearchOptionsSchema,
  BookmarkSearchResultArraySchema
} from './validation/records'

import {
  withTransaction,
  type IDBTransactionMode,
  type TransactionOptions
} from './transaction-manager'
import { idbConnectionPool } from './connection-pool'
import { logger } from '@/infrastructure/logging/logger'

/**
 * IndexedDB 管理器
 *
 * 当前实现已逐步替换 legacy 逻辑，并直接落在基础设施层。
 */
export class IndexedDBManager {
  private readonly storeNames = Object.values(DB_CONFIG.STORES) as Array<
    (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES]
  >
  /** 各数据表的主键配置 */
  private readonly storePrimaryKeyMap: Record<
    (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES],
    IDBObjectStoreParameters | undefined
  > = {
    [DB_CONFIG.STORES.BOOKMARKS]: { keyPath: 'id' },
    [DB_CONFIG.STORES.GLOBAL_STATS]: { keyPath: 'key' },
    [DB_CONFIG.STORES.SETTINGS]: { keyPath: 'key' },
    [DB_CONFIG.STORES.SEARCH_HISTORY]: { keyPath: 'id', autoIncrement: true },
    [DB_CONFIG.STORES.FAVICON_CACHE]: { keyPath: 'domain' },
    [DB_CONFIG.STORES.FAVICON_STATS]: { keyPath: 'key' },
    [DB_CONFIG.STORES.CRAWL_METADATA]: { keyPath: 'bookmarkId' },
    [DB_CONFIG.STORES.EMBEDDINGS]: { keyPath: 'bookmarkId' },
    [DB_CONFIG.STORES.AI_JOBS]: { keyPath: 'id' }
  }

  /** 各数据表的索引配置 */
  private readonly storeIndexConfigMap: Record<
    (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES],
    Array<{
      name: string
      keyPath: string | string[]
      options?: IDBIndexParameters
    }>
  > = {
    [DB_CONFIG.STORES.BOOKMARKS]: [
      { name: 'parentId', keyPath: 'parentId' },
      { name: 'url', keyPath: 'url' },
      { name: 'urlLower', keyPath: 'urlLower' },
      { name: 'domain', keyPath: 'domain' },
      { name: 'titleLower', keyPath: 'titleLower' },
      { name: 'parentId_index', keyPath: ['parentId', 'index'] },
      { name: 'pathIds', keyPath: 'pathIds', options: { multiEntry: true } },
      { name: 'keywords', keyPath: 'keywords', options: { multiEntry: true } },
      { name: 'tags', keyPath: 'tags', options: { multiEntry: true } },
      {
        name: 'healthTags',
        keyPath: 'healthTags',
        options: { multiEntry: true }
      },
      { name: 'dateAdded', keyPath: 'dateAdded' }
    ],
    [DB_CONFIG.STORES.GLOBAL_STATS]: [
      { name: 'key', keyPath: 'key' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.SETTINGS]: [
      { name: 'updatedAt', keyPath: 'updatedAt' },
      { name: 'type', keyPath: 'type' }
    ],
    [DB_CONFIG.STORES.SEARCH_HISTORY]: [
      { name: 'query', keyPath: 'query' },
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'source', keyPath: 'source' }
    ],
    [DB_CONFIG.STORES.FAVICON_CACHE]: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'lastAccessed', keyPath: 'lastAccessed' },
      { name: 'accessCount', keyPath: 'accessCount' },
      { name: 'bookmarkCount', keyPath: 'bookmarkCount' },
      { name: 'isPopular', keyPath: 'isPopular' },
      { name: 'quality', keyPath: 'quality' },
      { name: 'expiresAt', keyPath: 'expiresAt' }
    ],
    [DB_CONFIG.STORES.FAVICON_STATS]: [
      { name: 'key', keyPath: 'key' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.CRAWL_METADATA]: [
      { name: 'bookmarkId', keyPath: 'bookmarkId' },
      { name: 'domain', keyPath: 'domain' },
      { name: 'source', keyPath: 'source' },
      { name: 'httpStatus', keyPath: 'httpStatus' },
      { name: 'statusGroup', keyPath: 'statusGroup' },
      { name: 'lastCrawled', keyPath: 'lastCrawled' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.EMBEDDINGS]: [
      { name: 'bookmarkId', keyPath: 'bookmarkId' },
      { name: 'domain', keyPath: 'domain' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.AI_JOBS]: [
      { name: 'status', keyPath: 'status' },
      { name: 'type', keyPath: 'type' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ]
  }
  private db: IDBDatabase | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null

  /**
   * 将原生 IDBRequest 封装为 Promise。
   *
   * @description
   * IndexedDB 的 API 以事件回调为主，不便于统一错误处理。
   * 通过该方法可将成功与失败回调转换为 Promise，便于上层逻辑使用 async/await。
   *
   * @param request 需要监听的 IDBRequest 实例
   * @returns 成功时返回请求结果，失败时抛出错误
   */
  private async wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB 请求失败'))
    })
  }

  /**
   * 初始化数据库连接。
   *
   * - 避免重复初始化：若已经完成直接返回，若存在正在进行的初始化则复用同一个 Promise。
   * - 初始化失败时会重置状态，防止 db 保持在半初始化状态。
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      try {
        await this.openDatabase()
      } catch (error) {
        logger.error('IndexedDBManager', 'initialize 失败', error)
        this.isInitialized = false
        if (this.db) {
          this.db.close()
          this.db = null
        }
        throw error
      } finally {
        this.initPromise = null
      }
    })()

    await this.initPromise
    await this.autoEnsureGlobalStats()
  }

  /**
   * 打开数据库并在版本升级时创建/迁移对象存储。
   *
   * @throws 初始化超时、失败或升级阻塞时抛出错误
   */
  private async openDatabase(): Promise<void> {
    const { NAME, VERSION } = DB_CONFIG

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION)
      const openTimeout = globalThis.setTimeout(() => {
        const timeoutError = new Error('IndexedDB 初始化超时')
        logger.error('IndexedDBManager', 'openDatabase 超时', timeoutError)
        reject(timeoutError)
      }, 10_000)

      request.onerror = () => {
        globalThis.clearTimeout(openTimeout)
        const error = request.error ?? new Error('IndexedDB 初始化失败')
        logger.error('IndexedDBManager', 'openDatabase onerror', error)
        reject(error)
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (!tx) {
          const upgradeError = new Error('IndexedDB 升级事务缺失')
          logger.error(
            'IndexedDBManager',
            'openDatabase 升级事务缺失',
            upgradeError
          )
          reject(upgradeError)
          return
        }
        this.createStores(db, tx)
      }

      request.onsuccess = () => {
        globalThis.clearTimeout(openTimeout)
        this.db = request.result
        idbConnectionPool.setDB(this.db)
        this.isInitialized = true
        logger.info('IndexedDBManager', 'openDatabase 成功', {
          name: NAME,
          version: VERSION,
          stores: Array.from(this.db.objectStoreNames)
        })
        resolve()
      }

      request.onblocked = () => {
        globalThis.clearTimeout(openTimeout)
        const blockedError = new Error('IndexedDB 升级被阻塞')
        logger.warn('IndexedDBManager', 'openDatabase 升级被阻塞')
        reject(blockedError)
      }
    })
  }

  /**
   * 根据 schema 创建或修复对象存储与索引。
   *
   * - 首次升级时按配置创建缺失的 store。
   * - 若 store 已存在，继续校验其索引配置，确保与最新 schema 对齐。
   */
  private createStores(db: IDBDatabase, tx: IDBTransaction): void {
    this.storeNames.forEach(storeName => {
      const primaryKeyOptions = this.storePrimaryKeyMap[storeName]

      if (!db.objectStoreNames.contains(storeName)) {
        const store = primaryKeyOptions
          ? db.createObjectStore(storeName, primaryKeyOptions)
          : db.createObjectStore(storeName)
        this.ensureIndexes(storeName, store)
        return
      }

      const store = tx.objectStore(storeName)
      this.ensureIndexes(storeName, store)
    })
  }

  /**
   * 为指定对象存储补齐缺失索引并移除废弃索引。
   *
   * @param storeName 对象存储名称
   * @param store 对象存储实例
   */
  private ensureIndexes(
    storeName: (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES],
    store: IDBObjectStore
  ): void {
    const indexConfigs = this.storeIndexConfigMap[storeName]
    if (!indexConfigs) return

    const existingIndexes = new Set(Array.from(store.indexNames))
    indexConfigs.forEach(indexConfig => {
      if (!existingIndexes.has(indexConfig.name)) {
        store.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      }
    })

    existingIndexes.forEach(indexName => {
      if (!indexConfigs.some(indexConfig => indexConfig.name === indexName)) {
        store.deleteIndex(indexName)
      }
    })
  }

  /**
   * 确保数据库连接已准备完成。
   *
   * @throws 若初始化尚未完成或初始化失败，主动抛错提醒调用方
   */
  private async ensureReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.db || !this.isInitialized) {
      throw new Error('IndexedDBManager 未能成功初始化数据库连接')
    }
  }

  /**
   * 通用事务封装。
   *
   * @description
   * 所有访问逻辑均需通过该方法运行，以确保：
   * 1. 数据库已初始化。
   * 2. 统一使用 transaction-manager 中的重试/回退策略。
   *
   * @param stores 参与事务的对象存储列表
   * @param mode 事务模式（readonly/readwrite）
   * @param handler 事务执行逻辑，由调用方传入
   * @param options 可选的事务配置（重试次数、超时等）
   */
  private async runTransaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    handler: (tx: IDBTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    await this.ensureReady()
    return withTransaction(stores, mode, handler, options)
  }

  /**
   * 只读事务的快捷调用。
   */
  private async runReadTransaction<T>(
    store: string,
    handler: (tx: IDBTransaction, objectStore: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    return this.runTransaction([store], 'readonly', async tx => {
      const objectStore = tx.objectStore(store)
      return handler(tx, objectStore)
    })
  }

  /**
   * 可写事务的快捷调用。
   */
  private async runWriteTransaction<T>(
    store: string,
    handler: (tx: IDBTransaction, objectStore: IDBObjectStore) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.runTransaction(
      [store],
      'readwrite',
      async tx => {
        const objectStore = tx.objectStore(store)
        return handler(tx, objectStore)
      },
      options
    )
  }

  /**
   * 批量操作工具。
   *
   * @description
   * 将大批量数据按指定批次执行写事务，同时提供进度与错误回调，
   * 便于调用方实现可视化进度刷新与错误兜底。
   */
  private async runBatchOperation<T>(
    items: T[],
    storeName: string,
    executor: (store: IDBObjectStore, item: T) => Promise<void>,
    options: BatchOptions<T> = {}
  ): Promise<void> {
    if (items.length === 0) return

    const total = items.length
    const batchSize = this.resolveBatchSize(total, options.batchSize)
    let processed = 0

    for (let start = 0; start < total; start += batchSize) {
      const chunk = items.slice(start, Math.min(start + batchSize, total))

      try {
        await this.runWriteTransaction(storeName, async (_tx, store) => {
          await Promise.all(
            chunk.map(async item => {
              try {
                await executor(store, item)
              } catch (error) {
                const normalizedError =
                  error instanceof Error
                    ? error
                    : new Error(String(error ?? '未知错误'))
                options.errorCallback?.(normalizedError, item)
                throw normalizedError
              }
            })
          )
        })

        processed += chunk.length
        options.progressCallback?.(processed, total)
      } catch (error) {
        throw error
      }

      if (options.delayBetweenBatches) {
        await new Promise(resolve =>
          setTimeout(resolve, options.delayBetweenBatches)
        )
      }
    }
  }

  private resolveBatchSize(total: number, preferred?: number): number {
    if (preferred && preferred > 0) {
      return preferred
    }
    return this.calculateOptimalBatchSize(total)
  }

  private calculateOptimalBatchSize(totalRecords: number): number {
    const memoryGB = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory
    const baseBatchSize = (memoryGB || 4) >= 8 ? 5000 : 2000

    if (totalRecords < 1000) return totalRecords
    if (totalRecords > 100_000) return Math.min(baseBatchSize, 1000)
    return baseBatchSize
  }

  /**
   * 让出事件循环控制权
   *
   * 在长时间运行的操作中定期调用，避免阻塞 UI
   *
   * @example
   * ```ts
   * for (let i = 0; i < largeArray.length; i++) {
   *   processItem(largeArray[i])
   *   if (i % 100 === 0) await this.yieldToEventLoop()
   * }
   * ```
   *
   * @internal 预留方法，供未来性能优化使用
   */
  // @ts-expect-error - 预留方法，供未来性能优化使用
  private async yieldToEventLoop(): Promise<void> {
    await new Promise<void>(resolve => {
      const idle = (
        globalThis as typeof globalThis & {
          requestIdleCallback?: (
            callback: IdleRequestCallback,
            options?: IdleRequestOptions
          ) => number
        }
      ).requestIdleCallback

      if (typeof idle === 'function') {
        idle(() => resolve())
      } else {
        globalThis.setTimeout(resolve, 0)
      }
    })
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.isInitialized = false
    this.initPromise = null
  }

  async withTransaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    handler: (tx: IDBTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.runTransaction(stores, mode, handler, options)
  }

  /**
   * 批量导入书签数据。
   *
   * @param bookmarks 待写入的书签集合
   * @param options 批量处理配置
   */
  async insertBookmarks(
    bookmarks: BookmarkRecord[],
    options?: BatchOptions<BookmarkRecord>
  ): Promise<void> {
    if (bookmarks.length === 0) return

    const parsed = BookmarkRecordArraySchema.safeParse(bookmarks)
    if (!parsed.success) {
      logger.error(
        'IndexedDBManager',
        'insertBookmarks 数据校验失败',
        parsed.error
      )
      throw parsed.error
    }

    await this.runBatchOperation(
      parsed.data.map(record => ({
        ...record,
        healthTags: record.healthTags ?? [],
        healthMetadata: record.healthMetadata ?? []
      })),
      DB_CONFIG.STORES.BOOKMARKS,
      async (store, bookmark) => {
        await this.wrapRequest(store.put(bookmark))
      },
      options
    )
  }

  /**
   * 更新单条书签信息。
   */
  async updateBookmark(bookmark: BookmarkRecord): Promise<void> {
    const parsed = BookmarkRecordSchema.safeParse(bookmark)
    if (!parsed.success) {
      logger.error(
        'IndexedDBManager',
        'updateBookmark 数据校验失败',
        parsed.error
      )
      throw parsed.error
    }

    await this.runWriteTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => {
        const record: BookmarkRecord = {
          ...parsed.data,
          healthTags: parsed.data.healthTags ?? [],
          healthMetadata: parsed.data.healthMetadata ?? []
        }
        await this.wrapRequest(store.put(record))
      }
    )
  }

  async updateBookmarksHealth(
    updates: Array<{
      id: string
      healthTags: string[]
      healthMetadata?: BookmarkRecord['healthMetadata']
    }>
  ): Promise<void> {
    if (updates.length === 0) return

    await this.runWriteTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => {
        for (const update of updates) {
          try {
            const existing = (await this.wrapRequest(store.get(update.id))) as
              | BookmarkRecord
              | undefined
            if (!existing) continue

            const nextRecord: BookmarkRecord = {
              ...existing,
              healthTags: update.healthTags,
              healthMetadata: update.healthMetadata ?? []
            }

            const parsed = BookmarkRecordSchema.safeParse(nextRecord)
            if (!parsed.success) {
              logger.error(
                'IndexedDBManager',
                'updateBookmarksHealth 数据校验失败',
                {
                  bookmarkId: update.id,
                  error: parsed.error
                }
              )
              continue
            }

            await this.wrapRequest(store.put(parsed.data))
          } catch (error) {
            logger.error('IndexedDBManager', '更新健康标签失败', {
              bookmarkId: update.id,
              error
            })
          }
        }
      }
    )
  }

  /**
   * 删除指定书签。
   */
  async deleteBookmark(id: string): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => {
        await this.wrapRequest(store.delete(id))
      }
    )
  }

  /**
   * 批量删除书签。
   */
  async deleteBookmarksBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    await this.runWriteTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => {
        await Promise.all(
          ids.map(async id => await this.wrapRequest(store.delete(id)))
        )
      }
    )
  }

  /**
   * 根据主键读取书签。
   */
  async getBookmarkById(id: string): Promise<BookmarkRecord | null> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => await this.wrapRequest(store.get(id))
    )

    if (!result) return null

    const parsed = BookmarkRecordSchema.safeParse(result)
    if (!parsed.success) {
      logger.error('IndexedDBManager', 'getBookmarkById 校验失败', {
        id,
        error: parsed.error
      })
      return null
    }

    return {
      ...parsed.data,
      healthTags: parsed.data.healthTags ?? [],
      healthMetadata: parsed.data.healthMetadata ?? []
    }
  }

  /**
   * 读取所有书签
   *
   * @param limit - 可选的返回数量限制
   * @param offset - 可选的偏移量（用于分页）
   * @returns 书签记录数组
   */
  async getAllBookmarks(
    limit?: number,
    offset?: number
  ): Promise<BookmarkRecord[]> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => await this.wrapRequest(store.getAll())
    )

    const parsed = BookmarkRecordArraySchema.safeParse(result)
    if (!parsed.success) {
      logger.error('IndexedDBManager', 'getAllBookmarks 校验失败', parsed.error)
      throw parsed.error
    }

    // 应用分页
    let data = parsed.data.map(record => ({
      ...record,
      healthTags: record.healthTags ?? [],
      healthMetadata: record.healthMetadata ?? []
    }))
    if (offset !== undefined && offset > 0) {
      data = data.slice(offset)
    }
    if (limit !== undefined && limit > 0) {
      data = data.slice(0, limit)
    }

    return data
  }

  /**
   * 获取指定父节点下的直接子节点
   *
   * @param parentId - 父节点ID
   * @param offset - 可选的偏移量，默认为 0
   * @param limit - 可选的返回数量限制
   * @returns 子节点记录数组
   */
  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<BookmarkRecord[]> {
    const allChildren = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) =>
        await new Promise<BookmarkRecord[]>((resolve, reject) => {
          const index = store.index('parentId')
          const request = index.openCursor(IDBKeyRange.only(parentId))
          const results: BookmarkRecord[] = []

          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor) {
              resolve(results)
              return
            }

            const parsed = BookmarkRecordSchema.safeParse(cursor.value)
            if (!parsed.success) {
              reject(parsed.error)
              return
            }

            results.push({
              ...parsed.data,
              healthTags: parsed.data.healthTags ?? [],
              healthMetadata: parsed.data.healthMetadata ?? []
            })
            cursor.continue()
          }

          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB 游标遍历失败'))
          }
        })
    )

    // 应用分页
    let data = allChildren
    const effectiveOffset = offset ?? 0
    if (effectiveOffset > 0) {
      data = data.slice(effectiveOffset)
    }
    if (limit !== undefined && limit > 0) {
      data = data.slice(0, limit)
    }

    return data
  }

  /**
   * 书签搜索。
   *
   * @description
   * 综合使用多种索引（标题、URL、标签等）获取候选结果，再按评分排序返回。
   * 支持精确/模糊匹配、最小得分过滤等。
   */
  async searchBookmarks(
    query: string,
    options: SearchOptions = { query }
  ): Promise<SearchResult[]> {
    const parsedOptions = BookmarkSearchOptionsSchema.safeParse({
      query,
      limit: options.limit,
      includeDomain: options.includeDomain,
      includeUrl: options.includeUrl,
      includeKeywords: options.includeKeywords,
      includeTags: options.includeTags,
      includeContent: options.includeContent,
      minScore: options.minScore,
      sortBy: options.sortBy,
      exactMatch: options.exactMatch,
      fuzzyMatch: options.fuzzyMatch
    })

    if (!parsedOptions.success) {
      logger.error(
        'IndexedDBManager',
        'searchBookmarks 参数校验失败',
        parsedOptions.error
      )
      throw parsedOptions.error
    }

    const normalized = parsedOptions.data
    const matches = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => {
        const candidateMap = new Map<string, BookmarkRecord>()
        const terms = normalized.query
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)

        if (terms.length === 0) return []

        const indexes: string[] = ['titleLower']
        if (normalized.includeDomain && store.indexNames.contains('domain')) {
          indexes.push('domain')
        }
        if (normalized.includeUrl && store.indexNames.contains('urlLower')) {
          indexes.push('urlLower')
        }
        if (
          normalized.includeKeywords &&
          store.indexNames.contains('keywords')
        ) {
          indexes.push('keywords')
        }
        if (normalized.includeTags && store.indexNames.contains('tags')) {
          indexes.push('tags')
        }

        const perIndexCap = Math.max(200, (normalized.limit ?? 100) * 3)

        for (const term of terms) {
          for (const indexName of indexes) {
            const index = store.index(indexName)
            const range =
              indexName === 'keywords' || indexName === 'tags'
                ? IDBKeyRange.only(term)
                : IDBKeyRange.bound(term, `${term}\uffff`)

            await new Promise<void>((resolve, reject) => {
              let collected = 0
              const request = index.openCursor(range)
              request.onsuccess = () => {
                const cursor = request.result
                if (!cursor || collected >= perIndexCap) {
                  resolve()
                  return
                }

                const parsed = BookmarkRecordSchema.safeParse(cursor.value)
                if (!parsed.success) {
                  reject(parsed.error)
                  return
                }

                candidateMap.set(parsed.data.id, {
                  ...parsed.data,
                  healthTags: parsed.data.healthTags ?? [],
                  healthMetadata: parsed.data.healthMetadata ?? []
                })
                collected++
                cursor.continue()
              }

              request.onerror = () => {
                reject(request.error ?? new Error('IndexedDB 游标遍历失败'))
              }
            })
          }
        }

        const scored: SearchResult[] = []
        for (const record of candidateMap.values()) {
          const normalizedRecord: BookmarkRecord = {
            ...record,
            healthTags: record.healthTags ?? [],
            healthMetadata: record.healthMetadata ?? []
          }
          const score = this.calculateSearchScore(
            normalizedRecord,
            terms,
            normalized
          )
          if (score <= (normalized.minScore ?? 0)) continue

          scored.push({
            id: record.id,
            score,
            bookmark: normalizedRecord
          })
        }

        if (normalized.sortBy === 'title') {
          scored.sort((a, b) =>
            a.bookmark.title.localeCompare(b.bookmark.title)
          )
        } else if (normalized.sortBy === 'dateAdded') {
          scored.sort(
            (a, b) => (b.bookmark.dateAdded ?? 0) - (a.bookmark.dateAdded ?? 0)
          )
        } else if (normalized.sortBy === 'visitCount') {
          scored.sort(
            (a, b) =>
              (b.bookmark.visitCount ?? 0) - (a.bookmark.visitCount ?? 0)
          )
        } else {
          scored.sort((a, b) => b.score - a.score)
        }

        const limited =
          normalized.limit && normalized.limit > 0
            ? scored.slice(0, normalized.limit)
            : scored
        return limited
      }
    )

    const validated = BookmarkSearchResultArraySchema.safeParse(matches)
    if (!validated.success) {
      logger.error(
        'IndexedDBManager',
        'searchBookmarks 结果校验失败',
        validated.error
      )
      throw validated.error
    }

    return validated.data.map(result => ({
      ...result,
      bookmark: {
        ...result.bookmark,
        healthTags: result.bookmark.healthTags ?? [],
        healthMetadata: result.bookmark.healthMetadata ?? []
      }
    }))
  }

  private calculateSearchScore(
    record: BookmarkRecord,
    terms: string[],
    options: SearchOptions
  ): number {
    let score = 0

    for (const term of terms) {
      if (record.titleLower.includes(term)) {
        score += record.titleLower.startsWith(term) ? 100 : 50
      }

      if (options.includeUrl && record.urlLower?.includes(term)) {
        score += 30
      }

      if (options.includeDomain && record.domain?.includes(term)) {
        score += 20
      }

      if (options.includeKeywords) {
        if (record.keywords.some(keyword => keyword.includes(term))) {
          score += 15
        }
      }

      if (options.includeTags) {
        if (record.tags.some(tag => tag.toLowerCase().includes(term))) {
          score += 10
        }
      }
    }

    return score
  }

  async updateGlobalStats(stats: GlobalStats): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.GLOBAL_STATS,
      async (_tx, store) => {
        const normalized: GlobalStats = {
          key: stats.key ?? 'basic',
          id: stats.id ?? stats.key ?? 'basic',
          totalBookmarks: stats.totalBookmarks ?? 0,
          totalFolders: stats.totalFolders ?? 0,
          totalDomains: stats.totalDomains ?? 0,
          lastUpdated: Date.now(),
          dataVersion: stats.dataVersion ?? DB_CONFIG.VERSION
        }

        await this.wrapRequest(store.put(normalized))
      }
    )
  }

  async getGlobalStats(): Promise<GlobalStats> {
    const result = (await this.runReadTransaction(
      DB_CONFIG.STORES.GLOBAL_STATS,
      async (_tx, store) => await this.wrapRequest(store.get('basic'))
    )) as GlobalStats | null

    if (result && typeof result.totalBookmarks === 'number') {
      return {
        key: result.key ?? 'basic',
        id: result.id ?? result.key ?? 'basic',
        totalBookmarks: result.totalBookmarks,
        totalFolders: result.totalFolders ?? 0,
        totalDomains: result.totalDomains ?? 0,
        lastUpdated: result.lastUpdated ?? Date.now(),
        dataVersion: result.dataVersion ?? DB_CONFIG.VERSION
      }
    }

    return {
      key: 'basic',
      id: 'basic',
      totalBookmarks: 0,
      totalFolders: 0,
      totalDomains: 0,
      lastUpdated: Date.now(),
      dataVersion: DB_CONFIG.VERSION
    }
  }

  private async autoEnsureGlobalStats(): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.GLOBAL_STATS,
      async (_tx, store) => {
        const existing = (await this.wrapRequest(store.get('basic'))) as
          | GlobalStats
          | undefined

        if (existing && typeof existing.totalBookmarks === 'number') {
          return
        }

        await this.wrapRequest(
          store.put({
            key: 'basic',
            id: 'basic',
            totalBookmarks: 0,
            totalFolders: 0,
            totalDomains: 0,
            lastUpdated: Date.now(),
            dataVersion: DB_CONFIG.VERSION
          })
        )
      }
    )
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    const [
      bookmarkCount,
      faviconCount,
      searchHistoryCount,
      settingsCount,
      crawlMetadataCount
    ] = await Promise.all([
      this.getStoreCount(DB_CONFIG.STORES.BOOKMARKS),
      this.getStoreCount(DB_CONFIG.STORES.FAVICON_CACHE),
      this.getStoreCount(DB_CONFIG.STORES.SEARCH_HISTORY),
      this.getStoreCount(DB_CONFIG.STORES.SETTINGS),
      this.getStoreCount(DB_CONFIG.STORES.CRAWL_METADATA)
    ])

    const totalSize =
      bookmarkCount * 1000 +
      faviconCount * 2000 +
      searchHistoryCount * 100 +
      settingsCount * 50 +
      crawlMetadataCount * 1500

    return {
      bookmarkCount,
      faviconCount,
      searchHistoryCount,
      settingsCount,
      crawlMetadataCount,
      totalSize,
      indexSize: Math.round(totalSize * 0.1),
      lastOptimized: Date.now()
    }
  }

  async checkDatabaseHealth(): Promise<DatabaseHealth> {
    try {
      await this.ensureReady()
      const db = this.db!
      const expectedStores = this.storeNames
      const existingStores = Array.from(db.objectStoreNames)

      const missingStores = expectedStores.filter(
        store => !existingStores.includes(store)
      )
      const extraStores = existingStores.filter(
        store =>
          !expectedStores.includes(
            store as (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES]
          )
      )

      return {
        isHealthy: missingStores.length === 0 && extraStores.length === 0,
        expectedStores,
        existingStores,
        missingStores,
        extraStores,
        lastCheck: Date.now(),
        errors: []
      }
    } catch (error) {
      return {
        isHealthy: false,
        expectedStores: this.storeNames,
        existingStores: [],
        missingStores: this.storeNames,
        extraStores: [],
        lastCheck: Date.now(),
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  async saveSetting(
    key: string,
    value: unknown,
    type?: string,
    description?: string
  ): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.SETTINGS,
      async (_tx, store) => {
        const record: AppSettings = {
          key,
          value,
          type: (type || typeof value) as AppSettings['type'],
          description,
          updatedAt: Date.now()
        }

        await this.wrapRequest(store.put(record))
      }
    )
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.SETTINGS,
      async (_tx, store) => await this.wrapRequest(store.get(key))
    )

    return result ? ((result.value as T) ?? null) : null
  }

  async deleteSetting(key: string): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.SETTINGS,
      async (_tx, store) => {
        await this.wrapRequest(store.delete(key))
      }
    )
  }

  async addSearchHistory(
    query: string,
    results: number,
    executionTime?: number,
    source?: SearchHistoryRecord['source']
  ): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.SEARCH_HISTORY,
      async (_tx, store) => {
        const record: Omit<SearchHistoryRecord, 'id'> = {
          query,
          results,
          executionTime: executionTime ?? 0,
          source: source ?? 'management',
          timestamp: Date.now()
        }

        await this.wrapRequest(store.add(record))
      }
    )
  }

  async getSearchHistory(limit?: number): Promise<SearchHistoryRecord[]> {
    const cappedLimit = Math.max(0, limit ?? 20)

    return await this.runReadTransaction(
      DB_CONFIG.STORES.SEARCH_HISTORY,
      async (_tx, store) =>
        await new Promise<SearchHistoryRecord[]>((resolve, reject) => {
          const index = store.index('timestamp')
          const results: SearchHistoryRecord[] = []
          const request = index.openCursor(undefined, 'prev')

          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor || results.length >= cappedLimit) {
              resolve(results)
              return
            }

            results.push(cursor.value as SearchHistoryRecord)
            cursor.continue()
          }

          request.onerror = () => {
            reject(request.error ?? new Error('读取搜索历史失败'))
          }
        })
    )
  }

  async clearSearchHistory(): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.SEARCH_HISTORY,
      async (_tx, store) => {
        await this.wrapRequest(store.clear())
      }
    )
  }

  async saveFaviconCache(record: FaviconCacheRecord): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.FAVICON_CACHE,
      async (_tx, store) => {
        const now = Date.now()
        await this.wrapRequest(
          store.put({
            ...record,
            timestamp: record.timestamp ?? now,
            lastAccessed: record.lastAccessed ?? now,
            updatedAt: record.updatedAt ?? now
          })
        )
      }
    )
  }

  async getFaviconCache(domain: string): Promise<FaviconCacheRecord | null> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.FAVICON_CACHE,
      async (_tx, store) => await this.wrapRequest(store.get(domain))
    )

    return (result ?? null) as FaviconCacheRecord | null
  }

  async saveCrawlMetadata(metadata: CrawlMetadataRecord): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.CRAWL_METADATA,
      async (_tx, store) => {
        await this.wrapRequest(
          store.put({
            ...metadata,
            updatedAt: Date.now()
          })
        )
      }
    )
  }

  async getCrawlMetadata(
    bookmarkId: string
  ): Promise<CrawlMetadataRecord | null> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.CRAWL_METADATA,
      async (_tx, store) => await this.wrapRequest(store.get(bookmarkId))
    )

    return (result ?? null) as CrawlMetadataRecord | null
  }

  async getAllCrawlMetadata(): Promise<CrawlMetadataRecord[]> {
    return await this.runReadTransaction(
      DB_CONFIG.STORES.CRAWL_METADATA,
      async (_tx, store) =>
        (await this.wrapRequest(store.getAll())) as CrawlMetadataRecord[]
    )
  }

  async getBatchCrawlMetadata(
    bookmarkIds: string[]
  ): Promise<Map<string, CrawlMetadataRecord>> {
    const result = new Map<string, CrawlMetadataRecord>()

    for (const id of bookmarkIds) {
      try {
        const record = await this.getCrawlMetadata(id)
        if (record) {
          result.set(id, record)
        }
      } catch (error) {
        logger.warn('IndexedDBManager', '获取爬取元数据失败，已跳过', {
          bookmarkId: id,
          error
        })
      }
    }

    return result
  }

  async deleteCrawlMetadata(bookmarkId: string): Promise<void> {
    await this.runWriteTransaction(
      DB_CONFIG.STORES.CRAWL_METADATA,
      async (_tx, store) => {
        await this.wrapRequest(store.delete(bookmarkId))
      }
    )
  }

  private async getStoreCount(
    storeName: (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES]
  ): Promise<number> {
    return await this.runReadTransaction(storeName, async (_tx, store) => {
      const request = store.count()
      return await this.wrapRequest(request)
    })
  }
}

export const indexedDBManager = new IndexedDBManager()
