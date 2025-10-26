/**
 * 应用层：书签查询服务
 *
 * 职责：
 * - 对外提供书签记录读取接口（全部、按父节点、全局统计）；
 * - 依赖核心仓储 `bookmarkRepository`，保持应用层与数据访问的分离；
 * - 所有方法返回 `Result<T>`，便于统一错误处理与 UI 通知。
 */
import type { Result } from '@/core/common/result'
import { ok, err } from '@/core/common/result'
import { bookmarkRepository } from '@/core/bookmark/repositories/bookmark-repository'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签应用服务，负责协调仓储层与上层调用的交互。
 */
export class BookmarkAppService {
  /** 服务是否已初始化 */
  private initialized = false

  /**
   * 初始化服务
   */
  async initialize(): Promise<Result<void>> {
    try {
      if (this.initialized) {
        return ok(undefined)
      }

      logger.info('BookmarkAppService', '初始化书签服务...')
      this.initialized = true
      return ok(undefined)
    } catch (error) {
      logger.error('BookmarkAppService', '初始化失败', error)
      return err(new Error('初始化书签服务失败'))
    }
  }

  /**
   * 读取全部书签记录（含文件夹与书签），从 IndexedDB 仓储获取。
   */
  async getAllBookmarks(
    limit?: number,
    offset?: number
  ): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getAllBookmarks(limit, offset)
  }

  /**
   * 根据ID获取单个书签记录
   *
   * @param id - 书签的唯一标识符
   * @returns 包含书签记录的 Result 对象，如果不存在则返回 null
   */
  async getBookmarkById(id: string): Promise<Result<BookmarkRecord | null>> {
    return bookmarkRepository.getBookmarkById(id)
  }

  /**
   * 获取根节点
   */
  async getRootNodes(): Promise<Result<BookmarkNode[]>> {
    try {
      const result = await bookmarkRepository.getChildrenByParentId('0', 0, 100)
      if (result.ok && result.value) {
        // 转换 BookmarkRecord 为 BookmarkNode
        const nodes: BookmarkNode[] = result.value.map(
          (record: BookmarkRecord) => ({
            id: String(record.id),
            title: record.title,
            url: record.url,
            parentId: record.parentId ? String(record.parentId) : undefined,
            index: record.index,
            dateAdded: record.dateAdded,
            children: [],
            childrenCount: record.childrenCount,
            _childrenLoaded: false
          })
        )
        return ok(nodes)
      }
      return err(new Error('获取根节点失败'))
    } catch (error) {
      logger.error('BookmarkAppService', '获取根节点失败', error)
      return err(new Error('获取根节点失败'))
    }
  }

  /**
   * 获取子节点
   */
  async getChildren(
    parentId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<BookmarkNode[]>> {
    try {
      const result = await bookmarkRepository.getChildrenByParentId(
        parentId,
        options?.offset || 0,
        options?.limit || 100
      )
      if (result.ok && result.value) {
        // 转换 BookmarkRecord 为 BookmarkNode
        const nodes: BookmarkNode[] = result.value.map(
          (record: BookmarkRecord) => ({
            id: String(record.id),
            title: record.title,
            url: record.url,
            parentId: record.parentId ? String(record.parentId) : undefined,
            index: record.index,
            dateAdded: record.dateAdded,
            children: [],
            childrenCount: record.childrenCount,
            _childrenLoaded: false
          })
        )
        return ok(nodes)
      }
      return err(new Error('获取子节点失败'))
    } catch (error) {
      logger.error('BookmarkAppService', '获取子节点失败', error)
      return err(new Error('获取子节点失败'))
    }
  }

  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getChildrenByParentId(parentId, offset, limit)
  }

  /**
   * 创建书签
   *
   * 🆕 架构改进：通过 Background Script 统一处理
   * Chrome API → Background → IndexedDB → UI
   */
  async createBookmark(data: {
    title: string
    url?: string
    parentId?: string
  }): Promise<Result<BookmarkNode>> {
    try {
      // ✅ 通过消息传递给 Background Script
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_BOOKMARK',
        data: {
          title: data.title,
          url: data.url,
          parentId: data.parentId || '1'
        }
      })

      if (!response.success) {
        throw new Error(response.error || '创建书签失败')
      }

      const node = response.bookmark
      const bookmarkNode: BookmarkNode = {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: node.parentId,
        index: node.index,
        dateAdded: node.dateAdded,
        children: []
      }

      return ok(bookmarkNode)
    } catch (error) {
      logger.error('BookmarkAppService', '创建书签失败', error)
      return err(error instanceof Error ? error : new Error('创建书签失败'))
    }
  }

  /**
   * 更新书签
   *
   * 🆕 架构改进：通过 Background Script 统一处理
   * Chrome API → Background → IndexedDB → UI
   */
  async updateBookmark(
    id: string,
    data: { title?: string; url?: string; parentId?: string }
  ): Promise<Result<BookmarkNode>> {
    try {
      // ✅ 通过消息传递给 Background Script
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_BOOKMARK',
        data: {
          id,
          title: data.title,
          url: data.url
        }
      })

      if (!response.success) {
        throw new Error(response.error || '更新书签失败')
      }

      const node = response.bookmark
      const bookmarkNode: BookmarkNode = {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: node.parentId,
        index: node.index,
        dateAdded: node.dateAdded,
        children: []
      }

      return ok(bookmarkNode)
    } catch (error) {
      logger.error('BookmarkAppService', '更新书签失败', error)
      return err(error instanceof Error ? error : new Error('更新书签失败'))
    }
  }

  /**
   * 删除书签
   *
   * 🆕 架构改进：通过 Background Script 统一处理
   * Chrome API → Background → IndexedDB → UI
   */
  async deleteBookmark(id: string): Promise<Result<void>> {
    try {
      // ✅ 通过消息传递给 Background Script
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_BOOKMARK',
        data: { id }
      })

      if (!response.success) {
        throw new Error(response.error || '删除书签失败')
      }

      return ok(undefined)
    } catch (error) {
      logger.error('BookmarkAppService', '删除书签失败', error)
      return err(error instanceof Error ? error : new Error('删除书签失败'))
    }
  }

  async getGlobalStats(): Promise<Result<unknown>> {
    return bookmarkRepository.getGlobalStats()
  }
}

export const bookmarkAppService = new BookmarkAppService()
