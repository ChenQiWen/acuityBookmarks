/**
 * IndexedDB 书签仓库 - 核心业务逻辑
 *
 * 职责：
 * - 提供书签数据的持久化操作
 * - 实现高性能的批量操作
 * - 支持复杂的查询和搜索
 */

import type { BookmarkNode } from '../domain/bookmark'
import type {
  BookmarkRecord,
  SearchOptions,
  SearchResult,
  BatchResult
} from '../../../infrastructure/indexeddb/schema'
import type { Result } from '../../common/result'
import { ok, err } from '../../common/result'

/**
 * 书签仓库接口
 */
export interface BookmarkRepository {
  /**
   * 保存书签
   */
  save(bookmark: BookmarkNode): Promise<Result<void, Error>>

  /**
   * 批量保存书签
   */
  saveBatch(
    bookmarks: BookmarkNode[]
  ): Promise<Result<BatchResult<void>, Error>>

  /**
   * 根据ID获取书签
   */
  findById(id: string): Promise<Result<BookmarkNode | null, Error>>

  /**
   * 根据父ID获取子书签
   */
  findByParentId(parentId: string): Promise<Result<BookmarkNode[], Error>>

  /**
   * 搜索书签
   */
  search(options: SearchOptions): Promise<Result<SearchResult[], Error>>

  /**
   * 删除书签
   */
  delete(id: string): Promise<Result<void, Error>>

  /**
   * 批量删除书签
   */
  deleteBatch(ids: string[]): Promise<Result<BatchResult<void>, Error>>

  /**
   * 获取所有书签
   */
  findAll(): Promise<Result<BookmarkNode[], Error>>

  /**
   * 清空所有数据
   */
  clear(): Promise<Result<void, Error>>
}

/**
 * IndexedDB 书签仓库实现
 */
export class IndexedDBBookmarkRepository implements BookmarkRepository {
  private db: IDBDatabase | null = null
  private isInitialized = false

  constructor() {
    // 初始化将在外部完成
  }

  /**
   * 设置数据库连接
   */
  setDatabase(db: IDBDatabase): void {
    this.db = db
    this.isInitialized = true
  }

  /**
   * 检查是否已初始化
   */
  private ensureInitialized(): Result<void, Error> {
    if (!this.isInitialized || !this.db) {
      return err(new Error('Repository not initialized'))
    }
    return ok(undefined)
  }

  /**
   * 保存书签
   */
  async save(bookmark: BookmarkNode): Promise<Result<void, Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      const record = this.nodeToRecord(bookmark)

      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readwrite')
        const store = transaction.objectStore('bookmarks')
        const request = store.put(record)

        request.onsuccess = () => {
          resolve(ok(undefined))
        }

        request.onerror = () => {
          resolve(
            err(new Error(`Failed to save bookmark: ${request.error?.message}`))
          )
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 批量保存书签
   */
  async saveBatch(
    bookmarks: BookmarkNode[]
  ): Promise<Result<BatchResult<void>, Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      const records = bookmarks.map(bookmark => this.nodeToRecord(bookmark))
      const result: BatchResult<void> = {
        success: true,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
        results: []
      }

      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readwrite')
        const store = transaction.objectStore('bookmarks')

        let completed = 0
        const total = records.length

        for (const record of records) {
          const request = store.put(record)

          request.onsuccess = () => {
            result.successful++
            result.results.push(undefined)
            completed++

            if (completed === total) {
              result.processed = total
              resolve(ok(result))
            }
          }

          request.onerror = () => {
            const error = new Error(
              `Failed to save bookmark ${record.id}: ${request.error?.message}`
            )
            result.errors.push(error)
            result.failed++
            completed++

            if (completed === total) {
              result.processed = total
              result.success = result.failed === 0
              resolve(ok(result))
            }
          }
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 根据ID获取书签
   */
  async findById(id: string): Promise<Result<BookmarkNode | null, Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readonly')
        const store = transaction.objectStore('bookmarks')
        const request = store.get(id)

        request.onsuccess = () => {
          const record = request.result as BookmarkRecord | undefined
          if (record) {
            const node = this.recordToNode(record)
            resolve(ok(node))
          } else {
            resolve(ok(null))
          }
        }

        request.onerror = () => {
          resolve(
            err(new Error(`Failed to find bookmark: ${request.error?.message}`))
          )
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 根据父ID获取子书签
   */
  async findByParentId(
    parentId: string
  ): Promise<Result<BookmarkNode[], Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readonly')
        const store = transaction.objectStore('bookmarks')
        const index = store.index('parentId')
        const request = index.getAll(parentId)

        request.onsuccess = () => {
          const records = request.result as BookmarkRecord[]
          const nodes = records.map(record => this.recordToNode(record))
          resolve(ok(nodes))
        }

        request.onerror = () => {
          resolve(
            err(
              new Error(
                `Failed to find bookmarks by parent: ${request.error?.message}`
              )
            )
          )
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 搜索书签
   */
  async search(
    _options: SearchOptions
  ): Promise<Result<SearchResult[], Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      // 这里实现搜索逻辑
      // 由于搜索逻辑比较复杂，这里先返回空结果
      // 实际实现需要根据搜索选项构建查询
      return ok([])
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 删除书签
   */
  async delete(id: string): Promise<Result<void, Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readwrite')
        const store = transaction.objectStore('bookmarks')
        const request = store.delete(id)

        request.onsuccess = () => {
          resolve(ok(undefined))
        }

        request.onerror = () => {
          resolve(
            err(
              new Error(`Failed to delete bookmark: ${request.error?.message}`)
            )
          )
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 批量删除书签
   */
  async deleteBatch(ids: string[]): Promise<Result<BatchResult<void>, Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      const result: BatchResult<void> = {
        success: true,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
        results: []
      }

      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readwrite')
        const store = transaction.objectStore('bookmarks')

        let completed = 0
        const total = ids.length

        for (const id of ids) {
          const request = store.delete(id)

          request.onsuccess = () => {
            result.successful++
            result.results.push(undefined)
            completed++

            if (completed === total) {
              result.processed = total
              resolve(ok(result))
            }
          }

          request.onerror = () => {
            const error = new Error(
              `Failed to delete bookmark ${id}: ${request.error?.message}`
            )
            result.errors.push(error)
            result.failed++
            completed++

            if (completed === total) {
              result.processed = total
              result.success = result.failed === 0
              resolve(ok(result))
            }
          }
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 获取所有书签
   */
  async findAll(): Promise<Result<BookmarkNode[], Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readonly')
        const store = transaction.objectStore('bookmarks')
        const request = store.getAll()

        request.onsuccess = () => {
          const records = request.result as BookmarkRecord[]
          const nodes = records.map(record => this.recordToNode(record))
          resolve(ok(nodes))
        }

        request.onerror = () => {
          resolve(
            err(
              new Error(
                `Failed to find all bookmarks: ${request.error?.message}`
              )
            )
          )
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<Result<void, Error>> {
    const initResult = this.ensureInitialized()
    if (!initResult.ok) return initResult

    try {
      return new Promise(resolve => {
        const transaction = this.db!.transaction(['bookmarks'], 'readwrite')
        const store = transaction.objectStore('bookmarks')
        const request = store.clear()

        request.onsuccess = () => {
          resolve(ok(undefined))
        }

        request.onerror = () => {
          resolve(
            err(
              new Error(`Failed to clear bookmarks: ${request.error?.message}`)
            )
          )
        }
      })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 将 BookmarkNode 转换为 BookmarkRecord
   */
  private nodeToRecord(node: BookmarkNode): BookmarkRecord {
    return {
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      url: node.url,
      dateAdded: node.dateAdded,
      index: node.index || 0,

      // 层级关系字段
      path: [],
      pathString: '',
      pathIds: [],
      pathIdsString: '',
      ancestorIds: [],
      siblingIds: [],
      depth: 0,

      // 搜索优化字段
      titleLower: node.title.toLowerCase(),
      urlLower: node.url?.toLowerCase(),
      domain: node.url ? new URL(node.url).hostname : undefined,
      keywords: [],

      // 类型和统计字段
      isFolder: !node.url,
      childrenCount: node.children?.length || 0,
      bookmarksCount: 0,
      folderCount: 0,

      // 扩展属性
      tags: [],

      // 元数据
      createdYear: node.dateAdded
        ? new Date(node.dateAdded).getFullYear()
        : new Date().getFullYear(),
      createdMonth: node.dateAdded
        ? new Date(node.dateAdded).getMonth()
        : new Date().getMonth(),

      // 版本控制
      dataVersion: 1,
      lastCalculated: Date.now()
    }
  }

  /**
   * 将 BookmarkRecord 转换为 BookmarkNode
   */
  private recordToNode(record: BookmarkRecord): BookmarkNode {
    return {
      id: record.id,
      parentId: record.parentId,
      title: record.title,
      url: record.url,
      dateAdded: record.dateAdded,
      index: record.index,
      children: record.isFolder ? [] : undefined
    }
  }
}
