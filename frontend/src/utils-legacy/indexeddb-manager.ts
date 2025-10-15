/**
 * 统一IndexedDB管理器
 * 提供标准化的IndexedDB操作接口
 * 支持十万条书签的高性能存储和查询
 * Service Worker和前端共享的核心组件
 */

import {
  DB_CONFIG,
  INDEX_CONFIG,
  type BookmarkRecord,
  type GlobalStats,
  type AppSettings,
  type SearchHistoryRecord,
  type FaviconCacheRecord,
  type DatabaseHealth,
  type DatabaseStats,
  type SearchOptions,
  type SearchResult,
  type BatchOptions,
  type CrawlMetadataRecord
} from './indexeddb-schema'
import { logger } from '@/infrastructure/logging/logger'
import { idbConnectionPool } from '@/infrastructure/indexeddb/connection-pool'
import { sendMessageToBackend } from '@/infrastructure/chrome-api/message-client'
import { withTransaction } from '@/infrastructure/indexeddb/transaction-manager'

/**
 * 统一IndexedDB管理器类
 */
export class IndexedDBManager {
  private static instance: IndexedDBManager | null = null
  private db: IDBDatabase | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null

  private constructor() {
    // Enforce singleton pattern.
  }

  /**
   * 单例模式获取实例
   */
  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager()
    }
    return IndexedDBManager.instance
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  private async _doInitialize(): Promise<void> {
    logger.info('IndexedDBManager', '初始化开始', {
      name: DB_CONFIG.NAME,
      version: DB_CONFIG.VERSION
    })
    console.log(
      `[IndexedDBManager] 🔧 准备打开数据库: ${DB_CONFIG.NAME} v${DB_CONFIG.VERSION}`
    )

    // 🔧 清理旧连接（如果存在），防止刷新时连接冲突
    if (this.db) {
      console.log('[IndexedDBManager] 🧹 检测到旧连接，先关闭...')
      try {
        this.db.close()
        this.db = null
        this.isInitialized = false
        console.log('[IndexedDBManager] ✅ 旧连接已关闭')
      } catch (e) {
        console.warn('[IndexedDBManager] ⚠️ 关闭旧连接失败（可能已关闭）:', e)
      }
    }

    return new Promise((resolve, reject) => {
      console.log('[IndexedDBManager] 📂 调用 indexedDB.open...')
      const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)
      console.log('[IndexedDBManager] ⏳ 等待数据库打开...')

      // 添加超时检测（10秒）- 更快失败，让用户重试
      const timeout = setTimeout(async () => {
        console.error('[IndexedDBManager] ❌ 数据库打开超时（10秒）！')
        console.error('[IndexedDBManager] ')
        console.error(
          '[IndexedDBManager] 💡 这通常是 Chrome IndexedDB 引擎卡住了'
        )
        console.error('[IndexedDBManager] ')
        console.error(
          '[IndexedDBManager] 🔧 【推荐】快速解决方案（选择其一）：'
        )
        console.error('[IndexedDBManager] ')
        console.error('[IndexedDBManager] 方案1（最快）：')
        console.error('[IndexedDBManager]   1. 禁用扩展（点击扩展开关）')
        console.error('[IndexedDBManager]   2. 等待2秒')
        console.error('[IndexedDBManager]   3. 启用扩展')
        console.error('[IndexedDBManager] ')
        console.error('[IndexedDBManager] 方案2（彻底）：')
        console.error('[IndexedDBManager]   1. 完全关闭 Chrome 浏览器')
        console.error('[IndexedDBManager]   2. 重新启动 Chrome')
        console.error('[IndexedDBManager]   3. 刷新扩展')
        console.error('[IndexedDBManager] ')
        console.error('[IndexedDBManager] 方案3（手动清理）：')
        console.error(
          '[IndexedDBManager]   1. 打开 chrome://settings/content/all'
        )
        console.error('[IndexedDBManager]   2. 搜索 "chrome-extension"')
        console.error('[IndexedDBManager]   3. 找到本扩展，点击"清除数据"')
        console.error('[IndexedDBManager]   4. 刷新扩展')
        console.error('[IndexedDBManager] ')
        console.error(
          '[IndexedDBManager] ⚠️ 如果是 DevTools Application 面板打开，请先关闭它'
        )

        // 🚀 激进恢复策略：直接尝试删除，不管数据库是否存在
        try {
          console.log(
            '[IndexedDBManager] 🔄 尝试强制删除数据库（即使不存在）...'
          )

          // 直接尝试删除，不检查是否存在（避免 databases() 也卡住）
          await new Promise<void>((resolveDelete, rejectDelete) => {
            const deleteRequest = indexedDB.deleteDatabase(DB_CONFIG.NAME)

            deleteRequest.onsuccess = () => {
              console.log('[IndexedDBManager] ✅ 旧数据库已删除')
              resolveDelete()
            }

            deleteRequest.onerror = () => {
              console.error('[IndexedDBManager] ❌ 删除数据库失败')
              rejectDelete(new Error('无法删除旧数据库'))
            }

            deleteRequest.onblocked = () => {
              console.error(
                '[IndexedDBManager] ⚠️ 删除被阻塞 - DevTools 正在占用！'
              )
              console.error('[IndexedDBManager] 🔧 请立即：')
              console.error(
                '[IndexedDBManager]   1. 关闭 DevTools 的 Application 标签页'
              )
              console.error('[IndexedDBManager]   2. 刷新扩展')
              rejectDelete(new Error('数据库被 DevTools 占用'))
            }

            // 删除操作设置 5 秒超时
            setTimeout(() => {
              console.error('[IndexedDBManager] ⏱️ 删除数据库超时（5秒）')
              console.error(
                '[IndexedDBManager] 🔧 Chrome IndexedDB 引擎可能卡住了，需要手动重启'
              )
              rejectDelete(
                new Error('删除数据库超时 - Chrome IndexedDB 引擎卡住')
              )
            }, 5000)
          })

          // 删除成功，重新打开（不递归调用 initialize）
          console.log('[IndexedDBManager] 🔄 重新打开数据库...')
          this.initPromise = null

          const retryRequest = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)

          retryRequest.onsuccess = () => {
            console.log('[IndexedDBManager] ✅ 重试成功！数据库已打开')
            this.db = retryRequest.result
            this.isInitialized = true
            resolve()
          }

          retryRequest.onerror = () => {
            console.error('[IndexedDBManager] ❌ 重试仍然失败')
            this.initPromise = null
            reject(new Error('重试打开数据库失败'))
          }

          retryRequest.onupgradeneeded = event => {
            console.log('[IndexedDBManager] 🔧 重建数据库架构...')
            const db = (event.target as IDBOpenDBRequest).result
            const tx = (event.target as IDBOpenDBRequest).transaction!
            this._createStores(db, tx)
          }
        } catch (recoverError) {
          console.error('[IndexedDBManager] ❌ 自动恢复失败:', recoverError)
          console.error('[IndexedDBManager] ')
          console.error('[IndexedDBManager] 🔧 请手动操作：')
          console.error(
            '[IndexedDBManager]   1. ❌ 关闭所有 DevTools 的 Application 标签页'
          )
          console.error('[IndexedDBManager]   2. 🔄 刷新扩展')
          console.error(
            '[IndexedDBManager]   3. 💡 如果还不行，完全关闭并重启 Chrome'
          )
          this.initPromise = null
          reject(new Error(`IndexedDB 自动恢复失败: ${recoverError}`))
        }
      }, 10000)

      request.onerror = async () => {
        clearTimeout(timeout)
        const error = request.error
        const errorMessage = error?.message || error?.name || 'Unknown error'

        console.error('[IndexedDBManager] ❌ 数据库打开失败:', error)
        console.error('[IndexedDBManager] 📋 错误详情:', {
          name: error?.name,
          message: error?.message,
          code: error?.code
        })
        logger.error('Component', 'IndexedDBManager', '初始化失败', error)

        // 🔧 检测是否为底层存储损坏错误，自动尝试修复
        const isBackingStoreError =
          errorMessage.includes('backing store') ||
          errorMessage.includes('Internal error') ||
          error?.name === 'UnknownError'

        if (isBackingStoreError) {
          console.error(
            '[IndexedDBManager] 💡 检测到底层存储错误，尝试自动修复...'
          )
          console.error(
            '[IndexedDBManager] 🔧 修复方案：删除损坏的数据库并重建'
          )

          try {
            this.initPromise = null

            // 删除损坏的数据库
            await new Promise<void>((resolveDelete, rejectDelete) => {
              console.log('[IndexedDBManager] 🗑️ 开始删除损坏的数据库...')
              const deleteRequest = indexedDB.deleteDatabase(DB_CONFIG.NAME)

              deleteRequest.onsuccess = () => {
                console.log('[IndexedDBManager] ✅ 损坏的数据库已删除')
                resolveDelete()
              }

              deleteRequest.onerror = () => {
                console.error('[IndexedDBManager] ❌ 删除数据库失败')
                rejectDelete(new Error('无法删除损坏的数据库'))
              }

              deleteRequest.onblocked = () => {
                console.error(
                  '[IndexedDBManager] ⚠️ 删除被阻塞 - 有其他连接占用'
                )
                rejectDelete(new Error('数据库删除被阻塞'))
              }

              // 5 秒超时
              setTimeout(() => {
                rejectDelete(new Error('删除数据库超时'))
              }, 5000)
            })

            // 删除成功，重新打开
            console.log('[IndexedDBManager] 🔄 重新创建数据库...')
            const retryRequest = indexedDB.open(
              DB_CONFIG.NAME,
              DB_CONFIG.VERSION
            )

            retryRequest.onsuccess = () => {
              console.log('[IndexedDBManager] ✅ 数据库修复成功！')
              this.db = retryRequest.result
              this.isInitialized = true
              try {
                idbConnectionPool.setDB(this.db)
              } catch {}
              resolve()
            }

            retryRequest.onerror = () => {
              console.error('[IndexedDBManager] ❌ 修复后仍然失败')
              this.initPromise = null
              reject(new Error('数据库修复失败 - 请重启浏览器后重试'))
            }

            retryRequest.onupgradeneeded = event => {
              console.log('[IndexedDBManager] 🔧 重建数据库架构...')
              const db = (event.target as IDBOpenDBRequest).result
              const tx = (event.target as IDBOpenDBRequest).transaction!
              this._createStores(db, tx)
            }
          } catch (repairError) {
            console.error('[IndexedDBManager] ❌ 自动修复失败:', repairError)
            console.error('[IndexedDBManager] 🔧 请手动操作：')
            console.error('[IndexedDBManager]   1. 完全关闭 Chrome 浏览器')
            console.error('[IndexedDBManager]   2. 重新启动 Chrome')
            console.error('[IndexedDBManager]   3. 刷新扩展')
            console.error(
              '[IndexedDBManager]   4. 如果仍然失败，可能需要清除浏览器数据'
            )
            this.initPromise = null
            reject(
              new Error(`IndexedDB 底层存储损坏且无法自动修复: ${repairError}`)
            )
          }
        } else {
          // 其他类型的错误，直接拒绝
          this.initPromise = null
          reject(new Error(`IndexedDB初始化失败: ${errorMessage}`))
        }
      }

      request.onsuccess = () => {
        clearTimeout(timeout)
        console.log('[IndexedDBManager] ✅ 数据库打开成功')
        this.db = request.result
        this.isInitialized = true
        this.initPromise = null

        // 注册到连接池，供 withTransaction 统一复用
        try {
          idbConnectionPool.setDB(this.db)
        } catch {}

        const stores = Array.from(this.db.objectStoreNames)
        console.log(
          `[IndexedDBManager] 🎉 初始化完成，版本: ${this.db.version}，表数: ${stores.length}`
        )
        logger.info('IndexedDBManager', '初始化成功', {
          version: this.db.version,
          stores
        })

        resolve()
      }

      request.onupgradeneeded = event => {
        clearTimeout(timeout)
        console.log('[IndexedDBManager] 🔄 数据库需要升级...')
        const openReq = event.target as IDBOpenDBRequest
        const db = openReq.result
        const oldVersion = event.oldVersion
        const newVersion = event.newVersion

        console.log(
          `[IndexedDBManager] 📈 升级版本: ${oldVersion} → ${newVersion}`
        )
        logger.info('IndexedDBManager', '数据库升级', {
          from: oldVersion,
          to: newVersion
        })

        try {
          console.log('[IndexedDBManager] 🏗️ 开始创建表结构...')
          const tx = openReq.transaction as IDBTransaction
          this._createStores(db, tx)
          console.log('[IndexedDBManager] ✅ 表结构创建完成')
          logger.info('IndexedDBManager', '表结构创建完成')
        } catch (error) {
          console.error('[IndexedDBManager] ❌ 表结构创建失败:', error)
          logger.error('Component', 'IndexedDBManager', '表结构创建失败', error)
          throw error
        }
      }

      request.onblocked = () => {
        clearTimeout(timeout)
        console.error('[IndexedDBManager] 🚫 数据库升级被阻塞！')
        console.error('[IndexedDBManager] 💡 解决方案：')
        console.error('[IndexedDBManager]   1. 关闭所有书签管理页面')
        console.error('[IndexedDBManager]   2. 关闭所有设置页面')
        console.error('[IndexedDBManager]   3. 刷新扩展后重试')
        logger.warn(
          'IndexedDBManager',
          '升级被阻塞，其他标签页可能正在使用数据库'
        )
        this.initPromise = null
        reject(new Error('IndexedDB 升级被阻塞 - 请关闭所有扩展页面后重试'))
      }
    })
  }

  /**
   * 创建所有存储表和索引
   */
  private _createStores(db: IDBDatabase, tx: IDBTransaction): void {
    console.log('[IndexedDBManager] 📋 开始创建存储表...')

    // 创建书签表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOOKMARKS)) {
      console.log(
        `[IndexedDBManager] 📚 创建书签表: ${DB_CONFIG.STORES.BOOKMARKS}`
      )
      logger.info('IndexedDBManager', '创建书签表...')
      const bookmarkStore = db.createObjectStore(DB_CONFIG.STORES.BOOKMARKS, {
        keyPath: 'id'
      })

      // 创建所有索引
      const indexCount = INDEX_CONFIG[DB_CONFIG.STORES.BOOKMARKS].length
      console.log(`[IndexedDBManager] 🔑 创建 ${indexCount} 个索引...`)
      INDEX_CONFIG[DB_CONFIG.STORES.BOOKMARKS].forEach((indexConfig, idx) => {
        bookmarkStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
        console.log(
          `[IndexedDBManager]   ✓ 索引 ${idx + 1}/${indexCount}: ${indexConfig.name}`
        )
      })

      console.log('[IndexedDBManager] ✅ 书签表创建完成')
      logger.info('IndexedDBManager', '书签表创建完成')
    } else {
      console.log('[IndexedDBManager] 📚 书签表已存在，检查索引...')
      const store = tx.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const existing = Array.from(store.indexNames)
      const desired = INDEX_CONFIG[DB_CONFIG.STORES.BOOKMARKS].map(i => i.name)
      // 使用 Set 提升查找效率并避免联合类型 includes 参数不匹配
      const desiredSet = new Set<string>(desired as unknown as string[])
      // 添加缺失索引
      INDEX_CONFIG[DB_CONFIG.STORES.BOOKMARKS].forEach(indexConfig => {
        if (!existing.includes(indexConfig.name)) {
          store.createIndex(
            indexConfig.name,
            indexConfig.keyPath,
            indexConfig.options
          )
        }
      })
      // 删除冗余索引（仅在升级事务中可用）
      existing.forEach(name => {
        if (!desiredSet.has(name)) {
          try {
            store.deleteIndex(name)
            logger.info('IndexedDBManager', `🧹 删除废弃索引: ${name}`)
          } catch (e) {
            logger.warn('IndexedDBManager', `⚠️ 删除索引失败: ${name}`, e)
          }
        }
      })
    }

    // 创建全局统计表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.GLOBAL_STATS)) {
      logger.info('IndexedDBManager', '创建全局统计表...')
      db.createObjectStore(DB_CONFIG.STORES.GLOBAL_STATS, {
        keyPath: 'key'
      })
      logger.info('IndexedDBManager', '✅ 全局统计表创建完成')
    }

    // 创建设置表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SETTINGS)) {
      logger.info('IndexedDBManager', '📊 创建设置表...')
      const settingsStore = db.createObjectStore(DB_CONFIG.STORES.SETTINGS, {
        keyPath: 'key'
      })

      INDEX_CONFIG[DB_CONFIG.STORES.SETTINGS].forEach(indexConfig => {
        settingsStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      })

      logger.info('IndexedDBManager', '✅ 设置表创建完成')
    }

    // 创建搜索历史表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SEARCH_HISTORY)) {
      logger.info('IndexedDBManager', '📊 创建搜索历史表...')
      const historyStore = db.createObjectStore(
        DB_CONFIG.STORES.SEARCH_HISTORY,
        {
          keyPath: 'id',
          autoIncrement: true
        }
      )

      INDEX_CONFIG[DB_CONFIG.STORES.SEARCH_HISTORY].forEach(indexConfig => {
        historyStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      })

      logger.info('IndexedDBManager', '✅ 搜索历史表创建完成')
    }

    // 创建图标缓存表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_CACHE)) {
      logger.info('IndexedDBManager', '📊 创建图标缓存表...')
      const faviconStore = db.createObjectStore(
        DB_CONFIG.STORES.FAVICON_CACHE,
        {
          keyPath: 'domain'
        }
      )

      INDEX_CONFIG[DB_CONFIG.STORES.FAVICON_CACHE].forEach(indexConfig => {
        faviconStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      })

      logger.info('IndexedDBManager', '✅ 图标缓存表创建完成')
    }

    // 创建图标统计表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_STATS)) {
      logger.info('IndexedDBManager', '📊 创建图标统计表...')
      const faviconStatsStore = db.createObjectStore(
        DB_CONFIG.STORES.FAVICON_STATS,
        {
          keyPath: 'key'
        }
      )

      INDEX_CONFIG[DB_CONFIG.STORES.FAVICON_STATS].forEach(indexConfig => {
        faviconStatsStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      })

      logger.info('IndexedDBManager', '✅ 图标统计表创建完成')
    }
    // 创建网页元数据缓存表（爬虫/Chrome）
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.CRAWL_METADATA)) {
      logger.info('IndexedDBManager', '📊 创建网页元数据缓存表...')
      const metaStore = db.createObjectStore(DB_CONFIG.STORES.CRAWL_METADATA, {
        keyPath: 'bookmarkId'
      })

      INDEX_CONFIG[DB_CONFIG.STORES.CRAWL_METADATA].forEach(indexConfig => {
        metaStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      })

      logger.info('IndexedDBManager', '✅ 网页元数据缓存表创建完成')
    }

    // 创建嵌入向量表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.EMBEDDINGS)) {
      logger.info('IndexedDBManager', '📊 创建嵌入向量表...')
      const embeddingStore = db.createObjectStore(DB_CONFIG.STORES.EMBEDDINGS, {
        keyPath: 'bookmarkId'
      })

      INDEX_CONFIG[DB_CONFIG.STORES.EMBEDDINGS].forEach(indexConfig => {
        embeddingStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      })

      logger.info('IndexedDBManager', '✅ 嵌入向量表创建完成')
    }

    // 创建AI作业表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.AI_JOBS)) {
      logger.info('IndexedDBManager', '📊 创建AI作业表...')
      const jobStore = db.createObjectStore(DB_CONFIG.STORES.AI_JOBS, {
        keyPath: 'id'
      })

      INDEX_CONFIG[DB_CONFIG.STORES.AI_JOBS].forEach(indexConfig => {
        jobStore.createIndex(
          indexConfig.name,
          indexConfig.keyPath,
          indexConfig.options
        )
      })

      logger.info('IndexedDBManager', '✅ AI作业表创建完成')
    }
  }

  /**
   * 确保数据库已初始化
   */
  private _ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('IndexedDB未初始化，请先调用initialize()')
    }
    return this.db
  }

  /**
   * 根据设备性能和数据量动态计算最佳批次大小
   * @param totalRecords 总记录数
   */
  private calculateOptimalBatchSize(totalRecords: number): number {
    // 基于可用内存估算
    const memoryGB = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory
    const baseBatchSize = (memoryGB || 4) >= 8 ? 5000 : 2000

    // 小数据集不分批
    if (totalRecords < 1000) return totalRecords

    // 大数据集使用更小批次避免阻塞
    if (totalRecords > 100000) return Math.min(baseBatchSize, 1000)

    return baseBatchSize
  }

  // ==================== 书签操作 ====================

  /**
   * 批量插入书签 - 支持十万条高性能插入
   */
  async insertBookmarks(
    bookmarks: BookmarkRecord[],
    options: BatchOptions = {}
  ): Promise<void> {
    const { progressCallback, errorCallback } = options
    const totalRecords = bookmarks.length
    if (totalRecords === 0) return

    logger.info('IndexedDBManager', `📥 开始批量插入 ${totalRecords} 条书签...`)
    const startTime = performance.now()

    const batchSize = this.calculateOptimalBatchSize(totalRecords)

    let processedCount = 0

    for (let i = 0; i < totalRecords; i += batchSize) {
      const chunk = bookmarks.slice(i, i + batchSize)

      try {
        await withTransaction(
          [DB_CONFIG.STORES.BOOKMARKS],
          'readwrite',
          async tx => {
            const store = tx.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const promises = chunk.map(bookmark => {
              return new Promise<void>((resolve, reject) => {
                const req = store.put(bookmark)
                req.onsuccess = () => {
                  processedCount++
                  resolve()
                }
                req.onerror = () => {
                  const error = new Error(`插入书签失败: ${bookmark.id}`)
                  if (errorCallback) {
                    errorCallback(error, bookmark)
                  }
                  reject(req.error)
                }
              })
            })
            await Promise.all(promises)
          },
          { retries: 2, retryDelayMs: 50 }
        )

        if (progressCallback) {
          progressCallback(processedCount, totalRecords)
        }

        if (i + batchSize < totalRecords) {
          // Service Worker 不支持 requestIdleCallback，使用 setTimeout
          await new Promise(r => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(r as () => void, { timeout: 100 })
            } else {
              setTimeout(r, 0) // 在 Service Worker 中使用 setTimeout
            }
          })
        }
      } catch (error) {
        logger.error(
          'Component',
          'IndexedDBManager',
          `❌ 批次 [${i}, ${i + batchSize}] 插入失败`,
          error
        )
        // Optionally, re-throw or handle error to stop the entire process
      }
    }

    const duration = performance.now() - startTime
    logger.info(
      'IndexedDBManager',
      `✅ 批量插入完成: ${processedCount}/${totalRecords} 条书签, 耗时: ${duration.toFixed(
        2
      )}ms`
    )
  }

  /**
   * 根据ID获取书签
   */
  async getBookmarkById(id: string): Promise<BookmarkRecord | null> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 获取所有书签（支持分页）
   */
  async getAllBookmarks(
    limit?: number,
    offset?: number
  ): Promise<BookmarkRecord[]> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)

      const results: BookmarkRecord[] = []
      let skipped = 0
      const targetOffset = offset || 0
      const targetLimit = limit || Infinity

      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result

        if (cursor && results.length < targetLimit) {
          if (skipped < targetOffset) {
            skipped++
            cursor.continue()
          } else {
            results.push(cursor.value)
            cursor.continue()
          }
        } else {
          resolve(results)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 根据父ID获取子书签（支持分页）
   */
  async getChildrenByParentId(
    parentId: string,
    offset: number = 0,
    limit?: number
  ): Promise<BookmarkRecord[]> {
    console.log(
      `[IndexedDBManager] 🔍 getChildrenByParentId: parentId=${parentId}, offset=${offset}, limit=${limit}`
    )
    const startTime = performance.now()

    try {
      const db = this._ensureDB()
      console.log(`[IndexedDBManager] ✅ 数据库连接正常`)

      return new Promise((resolve, reject) => {
        console.log(`[IndexedDBManager] 📂 创建只读事务...`)
        const transaction = db.transaction(
          [DB_CONFIG.STORES.BOOKMARKS],
          'readonly'
        )
        const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)

        console.log(
          `[IndexedDBManager] 🔍 检查索引: parentId_index 存在=${store.indexNames.contains('parentId_index')}`
        )

        if (store.indexNames.contains('parentId_index')) {
          console.log(`[IndexedDBManager] ✅ 使用复合索引 parentId_index`)
          const index = store.index('parentId_index')
          const range = IDBKeyRange.bound(
            [parentId, Number.MIN_SAFE_INTEGER],
            [parentId, Number.MAX_SAFE_INTEGER]
          )
          const results: BookmarkRecord[] = []

          console.log(`[IndexedDBManager] 📋 准备打开游标，range:`, {
            lower: [parentId, Number.MIN_SAFE_INTEGER],
            upper: [parentId, Number.MAX_SAFE_INTEGER]
          })

          const req = index.openCursor(range)
          let advanced = false
          const skip = Math.max(0, Number(offset) || 0)
          const max =
            typeof limit === 'number' ? Math.max(0, Number(limit)) : Infinity
          let cursorCallCount = 0

          console.log(
            `[IndexedDBManager] 🔄 开始游标遍历: skip=${skip}, max=${max}`
          )
          console.log(`[IndexedDBManager] ⏳ 等待游标 onsuccess 回调...`)

          // 添加超时检测（5秒）
          const cursorTimeout = setTimeout(() => {
            console.error(`[IndexedDBManager] ⏱️ 游标操作超时（5秒）！`)
            console.error(`[IndexedDBManager] 📊 超时时的状态:`, {
              parentId,
              cursorCallCount,
              resultsLength: results.length,
              advanced,
              skip,
              max
            })
            console.error(`[IndexedDBManager] 💡 这通常表示：`)
            console.error(`[IndexedDBManager]   1. 数据库索引损坏`)
            console.error(`[IndexedDBManager]   2. 数据记录损坏`)
            console.error(`[IndexedDBManager]   3. 事务被意外阻塞`)
            console.error(`[IndexedDBManager] `)
            console.error(`[IndexedDBManager] 🔧 建议解决方案：`)
            console.error(`[IndexedDBManager]   1. 禁用扩展`)
            console.error(
              `[IndexedDBManager]   2. 手动删除 IndexedDB（DevTools → Application → IndexedDB → 右键删除）`
            )
            console.error(
              `[IndexedDBManager]   3. 启用扩展（会自动重建数据库）`
            )
            reject(new Error(`游标操作超时 - parentId=${parentId}`))
          }, 5000)

          req.onsuccess = () => {
            cursorCallCount++
            console.log(
              `[IndexedDBManager] 🎯 游标回调触发 #${cursorCallCount}`
            )

            const cursor = req.result
            if (!cursor) {
              clearTimeout(cursorTimeout)
              const elapsed = performance.now() - startTime
              console.log(
                `[IndexedDBManager] ✅ 查询完成: 返回 ${results.length} 条数据，耗时 ${elapsed.toFixed(1)}ms`
              )
              resolve(results)
              return
            }

            const record = cursor.value as BookmarkRecord
            console.log(`[IndexedDBManager] 📄 游标位置:`, {
              key: cursor.key,
              primaryKey: cursor.primaryKey,
              valueId: record?.id,
              valueTitle: record?.title
            })

            if (skip && !advanced) {
              console.log(`[IndexedDBManager] ⏭️ 跳过前 ${skip} 条记录...`)
              advanced = true
              cursor.advance(skip)
              return
            }
            if (results.length < max) {
              results.push(record)
              console.log(
                `[IndexedDBManager] ➕ 添加记录 #${results.length}: ${record?.title}`
              )
              cursor.continue()
            } else {
              clearTimeout(cursorTimeout)
              const elapsed = performance.now() - startTime
              console.log(
                `[IndexedDBManager] ✅ 达到限制: 返回 ${results.length} 条数据，耗时 ${elapsed.toFixed(1)}ms`
              )
              resolve(results)
            }
          }
          req.onerror = () => {
            clearTimeout(cursorTimeout)
            console.error(`[IndexedDBManager] ❌ 游标遍历失败:`, req.error)
            reject(req.error)
          }
          return
        }

        console.log(`[IndexedDBManager] ⚠️ 使用旧索引 parentId（无复合索引）`)
        const index = store.index('parentId')
        const request = index.getAll(parentId)

        request.onsuccess = () => {
          const elapsed = performance.now() - startTime
          // 按 index 字段排序并在内存中分页
          const all = (request.result as BookmarkRecord[]).sort(
            (a: BookmarkRecord, b: BookmarkRecord) => a.index - b.index
          )
          const start = Math.max(0, Number(offset) || 0)
          const end =
            typeof limit === 'number' && Number.isFinite(limit)
              ? start + Math.max(0, Number(limit))
              : undefined
          const sliced = typeof end === 'number' ? all.slice(start, end) : all
          console.log(
            `[IndexedDBManager] ✅ 查询完成（旧索引）: 返回 ${sliced.length} 条数据，耗时 ${elapsed.toFixed(1)}ms`
          )
          resolve(sliced)
        }

        request.onerror = () => {
          console.error(
            `[IndexedDBManager] ❌ 查询失败（旧索引）:`,
            request.error
          )
          reject(request.error)
        }
      })
    } catch (error) {
      console.error(`[IndexedDBManager] ❌ getChildrenByParentId 异常:`, error)
      throw error
    }
  }

  /**
   * 高性能搜索书签
   */
  async searchBookmarks(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const db = this._ensureDB()
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0)

    if (searchTerms.length === 0) {
      return []
    }

    const { limit = 100, sortBy = 'relevance', minScore = 0 } = options

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)

      const candidateMap = new Map<string, BookmarkRecord>()
      const perIndexCap = Math.max(200, limit * 3)

      const addCandidatesFromIndex = (indexName: string, term: string) => {
        return new Promise<void>((r, j) => {
          if (!store.indexNames.contains(indexName)) return r()
          const index = store.index(indexName)
          const upper = term + '\uffff'
          const range = IDBKeyRange.bound(term, upper)
          let collected = 0
          const req = index.openCursor(range)
          req.onsuccess = () => {
            const cursor = req.result
            if (cursor && collected < perIndexCap) {
              const rec = cursor.value as BookmarkRecord
              candidateMap.set(rec.id, rec)
              collected++
              cursor.continue()
            } else {
              r()
            }
          }
          req.onerror = () => j(req.error)
        })
      }

      const tasks: Array<Promise<void>> = []
      for (const term of searchTerms) {
        tasks.push(addCandidatesFromIndex('titleLower', term))
        if (options.includeDomain)
          tasks.push(addCandidatesFromIndex('domain', term))
        if (options.includeUrl) {
          const idx = store.indexNames.contains('urlLower')
            ? 'urlLower'
            : undefined
          if (idx) tasks.push(addCandidatesFromIndex(idx, term))
        }
      }

      Promise.all(tasks)
        .then(() => {
          const results: SearchResult[] = []
          if (candidateMap.size === 0) {
            const req = store.openCursor()
            req.onsuccess = () => {
              const cursor = req.result
              if (cursor && results.length < limit) {
                const bookmark = cursor.value as BookmarkRecord
                const sr = this._calculateSearchScore(
                  bookmark,
                  searchTerms,
                  options
                )
                if (sr.score > minScore) results.push(sr)
                cursor.continue()
              } else {
                if (sortBy === 'relevance') {
                  results.sort((a, b) => b.score - a.score)
                } else if (sortBy === 'title') {
                  results.sort((a, b) =>
                    a.bookmark.title.localeCompare(b.bookmark.title)
                  )
                } else if (sortBy === 'dateAdded') {
                  results.sort(
                    (a, b) =>
                      (b.bookmark.dateAdded || 0) - (a.bookmark.dateAdded || 0)
                  )
                } else if (sortBy === 'visitCount') {
                  results.sort(
                    (a, b) =>
                      (b.bookmark.visitCount || 0) -
                      (a.bookmark.visitCount || 0)
                  )
                }
                resolve(results.slice(0, limit))
              }
            }
            req.onerror = () => reject(req.error)
            return
          }

          for (const rec of candidateMap.values()) {
            const sr = this._calculateSearchScore(rec, searchTerms, options)
            if (sr.score > minScore) results.push(sr)
          }

          if (sortBy === 'relevance') {
            results.sort((a, b) => b.score - a.score)
          } else if (sortBy === 'title') {
            results.sort((a, b) =>
              a.bookmark.title.localeCompare(b.bookmark.title)
            )
          } else if (sortBy === 'dateAdded') {
            results.sort(
              (a, b) =>
                (b.bookmark.dateAdded || 0) - (a.bookmark.dateAdded || 0)
            )
          } else if (sortBy === 'visitCount') {
            results.sort(
              (a, b) =>
                (b.bookmark.visitCount || 0) - (a.bookmark.visitCount || 0)
            )
          }

          resolve(results.slice(0, limit))
        })
        .catch(err => reject(err))
    })
  }

  /**
   * 计算搜索匹配分数和高亮
   */
  private _calculateSearchScore(
    bookmark: BookmarkRecord,
    searchTerms: string[],
    options: SearchOptions
  ): SearchResult {
    let score = 0
    const matchedFields: string[] = []
    const highlights: Record<string, string[]> = {}

    for (const term of searchTerms) {
      // 标题匹配（权重最高）
      if (bookmark.titleLower.includes(term)) {
        const weight = bookmark.titleLower.startsWith(term) ? 100 : 50
        score += weight
        matchedFields.push('title')
        if (!highlights.title) highlights.title = []
        highlights.title.push(term)
      }

      // URL匹配
      if (options.includeUrl && bookmark.urlLower?.includes(term)) {
        score += 30
        matchedFields.push('url')
        if (!highlights.url) highlights.url = []
        highlights.url.push(term)
      }

      // 域名匹配
      if (options.includeDomain && bookmark.domain?.includes(term)) {
        score += 20
        matchedFields.push('domain')
        if (!highlights.domain) highlights.domain = []
        highlights.domain.push(term)
      }

      // 爬虫元数据加权匹配（本地派生字段）
      const metaBoost =
        typeof bookmark.metaBoost === 'number'
          ? bookmark.metaBoost
          : (() => {
              if (!bookmark.metadataUpdatedAt) return 1.0
              const ageDays =
                (Date.now() - bookmark.metadataUpdatedAt) /
                (24 * 60 * 60 * 1000)
              if (ageDays > 180) return 0.6
              if (ageDays > 90) return 0.8
              return 1.0
            })()

      if (bookmark.metaTitleLower?.includes(term)) {
        score += Math.round(40 * metaBoost)
        matchedFields.push('meta_title')
        if (!highlights.meta_title) highlights.meta_title = []
        highlights.meta_title.push(term)
      }

      const metaKeywordsTokens: string[] | undefined =
        bookmark.metaKeywordsTokens
      if (metaKeywordsTokens?.some(k => k.includes(term))) {
        score += Math.round(25 * metaBoost)
        matchedFields.push('meta_keywords')
        if (!highlights.meta_keywords) highlights.meta_keywords = []
        highlights.meta_keywords.push(term)
      }

      if (bookmark.metaDescriptionLower?.includes(term)) {
        score += Math.round(10 * metaBoost)
        matchedFields.push('meta_desc')
        if (!highlights.meta_desc) highlights.meta_desc = []
        highlights.meta_desc.push(term)
      }

      // 关键词匹配
      if (
        options.includeKeywords &&
        bookmark.keywords.some(keyword => keyword.includes(term))
      ) {
        score += 15
        matchedFields.push('keywords')
        if (!highlights.keywords) highlights.keywords = []
        highlights.keywords.push(term)
      }

      // 标签匹配
      if (
        options.includeTags &&
        bookmark.tags.some(tag => tag.toLowerCase().includes(term))
      ) {
        score += 10
        matchedFields.push('tags')
        if (!highlights.tags) highlights.tags = []
        highlights.tags.push(term)
      }
    }

    return {
      bookmark,
      score,
      matchedFields: [...new Set(matchedFields)], // 去重
      highlights
    }
  }

  /**
   * 更新书签
   */
  async updateBookmark(bookmark: BookmarkRecord): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const request = store.put(bookmark)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 删除书签
   */
  async deleteBookmark(id: string): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 清空所有书签
   */
  async clearAllBookmarks(): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const request = store.clear()

      request.onsuccess = () => {
        logger.info('IndexedDBManager', '✅ 所有书签已清空')
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 批量更新书签（分批事务、进度回调、动态批次大小）
   */
  async updateBookmarksBatch(
    bookmarks: BookmarkRecord[],
    options: BatchOptions = {}
  ): Promise<void> {
    const db = this._ensureDB()
    const { progressCallback } = options
    const total = bookmarks.length
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(total)

    logger.info(
      'IndexedDBManager',
      `✏️ 开始批量更新 ${total} 条书签（每批 ${batchSize}）...`
    )

    let processed = 0

    const processBatch = (start: number, end: number) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
        const store = tx.objectStore(DB_CONFIG.STORES.BOOKMARKS)

        for (let i = start; i < end; i++) {
          const req = store.put(bookmarks[i])
          req.onerror = () => {
            logger.error(
              'Component',
              'IndexedDBManager',
              `❌ 批量更新失败: ${bookmarks[i]?.id}`,
              req.error
            )
          }
        }

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })

    for (let start = 0; start < total; start += batchSize) {
      const end = Math.min(start + batchSize, total)
      await processBatch(start, end)
      processed = end
      if (progressCallback) {
        try {
          progressCallback(processed, total)
        } catch {}
      }
    }

    logger.info('IndexedDBManager', `✅ 批量更新完成: ${processed}/${total}`)
  }

  /**
   * 批量删除书签（分批事务、进度回调、动态批次大小）
   */
  async deleteBookmarksBatch(
    ids: string[],
    options: BatchOptions = {}
  ): Promise<void> {
    const db = this._ensureDB()
    const { progressCallback } = options
    const total = ids.length
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(total)

    logger.info(
      'IndexedDBManager',
      `🗑️ 开始批量删除 ${total} 条书签（每批 ${batchSize}）...`
    )

    let processed = 0

    const processBatch = (start: number, end: number) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
        const store = tx.objectStore(DB_CONFIG.STORES.BOOKMARKS)

        for (let i = start; i < end; i++) {
          const req = store.delete(ids[i])
          req.onerror = () => {
            logger.error(
              'Component',
              'IndexedDBManager',
              `❌ 批量删除失败: ${ids[i]}`,
              req.error
            )
          }
        }

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })

    for (let start = 0; start < total; start += batchSize) {
      const end = Math.min(start + batchSize, total)
      await processBatch(start, end)
      processed = end
      if (progressCallback) {
        try {
          progressCallback(processed, total)
        } catch {}
      }
    }

    logger.info('IndexedDBManager', `✅ 批量删除完成: ${processed}/${total}`)
  }

  // ==================== 统计信息操作 ====================

  /**
   * 更新全局统计
   */
  async updateGlobalStats(stats: GlobalStats): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.GLOBAL_STATS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.GLOBAL_STATS)

      const statsRecord = {
        key: 'basic',
        ...stats,
        lastUpdated: Date.now()
      }

      const request = store.put(statsRecord)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 获取全局统计
   */
  async getGlobalStats(): Promise<GlobalStats | null> {
    const response = (await sendMessageToBackend({
      type: 'get-global-stats'
    })) as { ok: boolean; value?: GlobalStats; error?: string }
    if (response && response.ok) {
      return response.value || null
    }
    throw new Error(response?.error || 'Failed to get global stats')
  }

  // ==================== 设置操作 ====================

  /**
   * 保存设置
   */
  async saveSetting(
    key: string,
    value: unknown,
    type?: string,
    description?: string
  ): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SETTINGS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)

      const setting: AppSettings = {
        key,
        value,
        type: (type || typeof value) as
          | 'string'
          | 'number'
          | 'boolean'
          | 'object',
        description,
        updatedAt: Date.now()
      }

      const request = store.put(setting)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 获取设置
   */
  async getSetting<T>(key: string): Promise<T | null> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SETTINGS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.value : null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 删除设置
   */
  async deleteSetting(key: string): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SETTINGS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // ==================== 搜索历史操作 ====================

  /**
   * 添加搜索历史
   */
  async addSearchHistory(
    query: string,
    results: number,
    executionTime: number = 0,
    source: SearchHistoryRecord['source'] = 'management'
  ): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SEARCH_HISTORY],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)

      const historyRecord: Omit<SearchHistoryRecord, 'id'> = {
        query,
        results,
        executionTime,
        source,
        timestamp: Date.now()
      }

      const request = store.add(historyRecord)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 获取搜索历史
   */
  async getSearchHistory(limit: number = 20): Promise<SearchHistoryRecord[]> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SEARCH_HISTORY],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)
      const index = store.index('timestamp')

      const results: SearchHistoryRecord[] = []
      const request = index.openCursor(null, 'prev') // 按时间倒序

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor && results.length < limit) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 清空搜索历史
   */
  async clearSearchHistory(): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SEARCH_HISTORY],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // ==================== 图标缓存操作 ====================

  /**
   * 保存图标缓存
   */
  async saveFaviconCache(faviconRecord: FaviconCacheRecord): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.FAVICON_CACHE],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.FAVICON_CACHE)
      const request = store.put(faviconRecord)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 获取图标缓存
   */
  async getFaviconCache(domain: string): Promise<FaviconCacheRecord | null> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.FAVICON_CACHE],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.FAVICON_CACHE)
      const request = store.get(domain)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 保存网页爬虫/Chrome提取的元数据，并更新书签的关联状态
   */
  async saveCrawlMetadata(metadata: CrawlMetadataRecord): Promise<void> {
    await withTransaction(
      [DB_CONFIG.STORES.CRAWL_METADATA, DB_CONFIG.STORES.BOOKMARKS],
      'readwrite',
      async tx => {
        const metaStore = tx.objectStore(DB_CONFIG.STORES.CRAWL_METADATA)
        const bookmarkStore = tx.objectStore(DB_CONFIG.STORES.BOOKMARKS)

        // 写入元数据
        await new Promise<void>((resolve, reject) => {
          const req = metaStore.put({
            ...metadata,
            updatedAt: Date.now()
          } as CrawlMetadataRecord)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })

        // 读取并回写书签衍生字段（若存在）
        const bookmark = await new Promise<BookmarkRecord | undefined>(
          (resolve, reject) => {
            const getReq = bookmarkStore.get(metadata.bookmarkId)
            getReq.onsuccess = () =>
              resolve(getReq.result as BookmarkRecord | undefined)
            getReq.onerror = () => reject(getReq.error)
          }
        )

        if (!bookmark) return

        const normalizeText = (s?: string) =>
          (s || '')
            .toLowerCase()
            .normalize('NFKC')
            .replace(/[^\p{L}\p{N}\s\u4e00-\u9fff]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        const normalizeKeywords = (s?: string) =>
          (s || '')
            .toLowerCase()
            .normalize('NFKC')
            .split(/[\s,;|、，；]+/)
            .map(t => t.trim())
            .filter(t => t.length > 1)

        const metaTitleLower = normalizeText(
          metadata.pageTitle || metadata.ogTitle || ''
        )
        const metaDescriptionLower = normalizeText(
          metadata.description || metadata.ogDescription || ''
        )
        const metaKeywordsTokens = normalizeKeywords(metadata.keywords)

        const ageDays =
          typeof metadata.lastCrawled === 'number'
            ? (Date.now() - metadata.lastCrawled) / (24 * 60 * 60 * 1000)
            : 0
        let metaBoost = 1.0
        if (ageDays > 180) metaBoost = 0.6
        else if (ageDays > 90) metaBoost = 0.8
        if (metadata.status === 'failed') metaBoost *= 0.5

        const updated: BookmarkRecord = {
          ...bookmark,
          hasMetadata: true,
          metadataSource: metadata.source,
          metadataUpdatedAt: Date.now(),
          metaTitleLower,
          metaDescriptionLower,
          metaKeywordsTokens,
          metaBoost
        }

        await new Promise<void>((resolve, reject) => {
          const putReq = bookmarkStore.put(updated)
          putReq.onsuccess = () => resolve()
          putReq.onerror = () => reject(putReq.error)
        })
      },
      {
        retries: 2,
        retryDelayMs: 30,
        onRetry: attempt =>
          logger.warn(
            'IndexedDBManager',
            `saveCrawlMetadata 第 ${attempt} 次重试`
          )
      }
    )
  }

  /**
   * 读取书签对应的爬虫/Chrome元数据
   */
  async getCrawlMetadata(
    bookmarkId: string
  ): Promise<CrawlMetadataRecord | null> {
    return await withTransaction(
      [DB_CONFIG.STORES.CRAWL_METADATA],
      'readonly',
      async tx => {
        return await new Promise<CrawlMetadataRecord | null>(
          (resolve, reject) => {
            const metaStore = tx.objectStore(DB_CONFIG.STORES.CRAWL_METADATA)
            const req = metaStore.get(bookmarkId)
            req.onsuccess = () => resolve(req.result || null)
            req.onerror = () => reject(req.error)
          }
        )
      }
    )
  }

  /**
   * 读取所有爬虫/Chrome提取的元数据
   */
  async getAllCrawlMetadata(): Promise<CrawlMetadataRecord[]> {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([DB_CONFIG.STORES.CRAWL_METADATA], 'readonly')
      const store = tx.objectStore(DB_CONFIG.STORES.CRAWL_METADATA)
      const req = store.getAll()
      req.onsuccess = () =>
        resolve(
          Array.isArray(req.result) ? (req.result as CrawlMetadataRecord[]) : []
        )
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * 批量获取爬取元数据
   */
  async getBatchCrawlMetadata(
    bookmarkIds: string[]
  ): Promise<Map<string, CrawlMetadataRecord>> {
    const result = new Map<string, CrawlMetadataRecord>()

    for (const id of bookmarkIds) {
      try {
        const metadata = await this.getCrawlMetadata(id)
        if (metadata) {
          result.set(id, metadata)
        }
      } catch (error) {
        logger.warn(
          'IndexedDBManager',
          `跳过获取元数据失败的书签: ${id}`,
          error
        )
      }
    }

    return result
  }

  /**
   * 删除爬取元数据
   */
  async deleteCrawlMetadata(bookmarkId: string): Promise<void> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.CRAWL_METADATA],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.CRAWL_METADATA)
      const request = store.delete(bookmarkId)

      request.onsuccess = () => {
        logger.debug('IndexedDBManager', `✅ 删除爬取元数据: ${bookmarkId}`)
        resolve()
      }

      request.onerror = () => {
        logger.error('IndexedDBManager', '❌ 删除爬取元数据失败', request.error)
        reject(request.error)
      }
    })
  }

  // ==================== 数据库维护 ====================

  /**
   * 检查数据库健康状态
   */
  async checkDatabaseHealth(): Promise<DatabaseHealth> {
    try {
      const db = this._ensureDB()
      const expectedStores = Object.values(DB_CONFIG.STORES)
      const existingStores = Array.from(db.objectStoreNames)

      const missingStores = expectedStores.filter(
        store => !existingStores.includes(store)
      )
      const extraStores = existingStores.filter(
        store => !(expectedStores as string[]).includes(store)
      )

      const isHealthy = missingStores.length === 0 && extraStores.length === 0

      return {
        isHealthy,
        version: db.version,
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
        version: 0,
        expectedStores: Object.values(DB_CONFIG.STORES),
        existingStores: [],
        missingStores: Object.values(DB_CONFIG.STORES),
        extraStores: [],
        lastCheck: Date.now(),
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    const [
      bookmarkCount,
      faviconCount,
      searchHistoryCount,
      settingsCount,
      crawlMetadataCount
    ] = await Promise.all([
      this._getStoreCount(DB_CONFIG.STORES.BOOKMARKS),
      this._getStoreCount(DB_CONFIG.STORES.FAVICON_CACHE),
      this._getStoreCount(DB_CONFIG.STORES.SEARCH_HISTORY),
      this._getStoreCount(DB_CONFIG.STORES.SETTINGS),
      this._getStoreCount(DB_CONFIG.STORES.CRAWL_METADATA)
    ])

    // 估算总大小（粗略计算）
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
      indexSize: totalSize * 0.1, // 估算索引大小为数据的10%
      lastOptimized: Date.now()
    }
  }

  /**
   * 获取指定存储的记录数
   */
  private async _getStoreCount(storeName: string): Promise<number> {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [storeName as keyof typeof DB_CONFIG.STORES],
        'readonly'
      )
      const store = transaction.objectStore(storeName)
      const request = store.count()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isInitialized = false
      try {
        idbConnectionPool.close()
      } catch {}
      logger.info('IndexedDBManager', '✅ 数据库连接已关闭')
    }
  }

  /**
   * 销毁实例
   */
  static destroy(): void {
    if (IndexedDBManager.instance) {
      IndexedDBManager.instance.close()
      IndexedDBManager.instance = null
    }
  }
}

// 导出单例实例
export const indexedDBManager = IndexedDBManager.getInstance()
