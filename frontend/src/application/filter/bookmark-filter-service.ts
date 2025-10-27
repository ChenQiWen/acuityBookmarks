/**
 * 书签筛选服务（Application 层）
 *
 * 统一的筛选服务，支持多种数据源：
 * - IndexedDB（异步）
 * - 内存数据（同步）
 * - 自定义数据源
 *
 * @module application/filter/bookmark-filter-service
 */

import { searchAppService } from '@/application/search/search-app-service'
import {
  filterBookmarkNodes,
  flattenFilterResults,
  highlightMatches,
  type BookmarkFilterOptions,
  type FilteredBookmarkNode
} from '@/core/filter/bookmark-filter'
import type { BookmarkNode } from '@/types'
import type { EnhancedSearchResult } from '@/types/domain/search'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 筛选模式
 */
export type FilterMode = 'indexeddb' | 'memory'

/**
 * 筛选结果（带元数据）
 */
export interface FilterResult {
  /** 筛选后的节点 */
  nodes: FilteredBookmarkNode[]

  /** 总结果数 */
  total: number

  /** 执行时间（毫秒） */
  executionTime: number

  /** 数据源 */
  source: FilterMode
}

/**
 * 书签筛选服务类
 */
class BookmarkFilterService {
  /**
   * 从 IndexedDB 筛选（异步）
   *
   * 使用 searchAppService 进行高性能筛选
   *
   * @param query - 筛选条件
   * @param options - 筛选选项
   * @returns 筛选结果
   */
  async filterFromIndexedDB(
    query: string,
    options: BookmarkFilterOptions = {}
  ): Promise<FilterResult> {
    const startTime = performance.now()

    try {
      // 使用 searchAppService 进行高性能筛选
      const response = await searchAppService.searchWithMetadata(query, {
        limit: options.limit || 100,
        highlight: true,
        filterFolders: options.filterFolders,
        fuzzyThreshold: options.threshold
      })

      // 转换为 FilteredBookmarkNode
      const nodes: FilteredBookmarkNode[] = response.results.map(
        (result: EnhancedSearchResult) => {
          const { bookmark } = result
          return {
            id: bookmark.id,
            title: bookmark.title || '无标题',
            url: bookmark.url,
            dateAdded: bookmark.dateAdded || 0,
            dateGroupModified: bookmark.dateGroupModified,
            parentId: bookmark.parentId,
            index: bookmark.index || 0,
            children: !bookmark.url ? [] : undefined,
            matchedFields: result.matchedFields,
            filterScore: result.score,
            // 添加 BookmarkRecord 所需的其他必填字段
            path: bookmark.path || [],
            pathString: bookmark.pathString || '',
            pathIds: bookmark.pathIds || [],
            pathIdsString: bookmark.pathIdsString || '',
            ancestorIds: bookmark.ancestorIds || [],
            siblingIds: bookmark.siblingIds || [],
            depth: bookmark.depth || 0,
            titleLower:
              bookmark.titleLower || bookmark.title?.toLowerCase() || '',
            urlLower: bookmark.urlLower || bookmark.url?.toLowerCase(),
            domain: bookmark.domain,
            keywords: bookmark.keywords || [],
            isFolder: !bookmark.url,
            childrenCount: bookmark.childrenCount || 0,
            bookmarksCount: bookmark.bookmarksCount || 0,
            folderCount: bookmark.folderCount || 0
          } as FilteredBookmarkNode
        }
      )

      const executionTime = Math.round(performance.now() - startTime)

      logger.info(
        'BookmarkFilterService',
        `从 IndexedDB 筛选完成: "${query}"`,
        {
          total: response.metadata.totalResults,
          executionTime
        }
      )

      return {
        nodes,
        total: response.metadata.totalResults,
        executionTime,
        source: 'indexeddb'
      }
    } catch (error) {
      logger.error('BookmarkFilterService', '从 IndexedDB 筛选失败', error)
      throw error
    }
  }

  /**
   * 从内存数据筛选（同步）
   *
   * 适用于：
   * - 已编辑但未保存的数据
   * - LLM 返回的数据
   * - 任何内存中的书签数据
   *
   * @param nodes - 书签节点数组
   * @param query - 筛选条件
   * @param options - 筛选选项
   * @returns 筛选结果
   */
  filterFromMemory(
    nodes: BookmarkNode[],
    query: string,
    options: BookmarkFilterOptions = {}
  ): FilterResult {
    const startTime = performance.now()

    try {
      // 使用核心筛选函数
      const filteredNodes = filterBookmarkNodes(nodes, query, options)

      const executionTime = Math.round(performance.now() - startTime)

      logger.info('BookmarkFilterService', `从内存筛选完成: "${query}"`, {
        total: filteredNodes.length,
        executionTime
      })

      return {
        nodes: filteredNodes,
        total: filteredNodes.length,
        executionTime,
        source: 'memory'
      }
    } catch (error) {
      logger.error('BookmarkFilterService', '从内存筛选失败', error)
      throw error
    }
  }

  /**
   * 统一筛选接口（自动选择数据源）
   *
   * @param query - 筛选条件
   * @param mode - 筛选模式
   * @param data - 内存数据（mode='memory' 时必需）
   * @param options - 筛选选项
   * @returns 筛选结果
   */
  async filter(
    query: string,
    mode: FilterMode,
    data?: BookmarkNode[],
    options: BookmarkFilterOptions = {}
  ): Promise<FilterResult> {
    if (mode === 'memory') {
      if (!data) {
        throw new Error('内存模式下必须提供 data 参数')
      }
      return this.filterFromMemory(data, query, options)
    } else {
      return await this.filterFromIndexedDB(query, options)
    }
  }

  /**
   * 扁平化筛选结果
   *
   * @param nodes - 筛选后的树形节点
   * @returns 扁平化的节点数组
   */
  flatten(nodes: FilteredBookmarkNode[]): FilteredBookmarkNode[] {
    return flattenFilterResults(nodes)
  }

  /**
   * 高亮匹配文本
   *
   * @param text - 原始文本
   * @param query - 查询字符串
   * @param caseSensitive - 是否区分大小写
   * @returns 带高亮标记的文本段落
   */
  highlight(
    text: string,
    query: string,
    caseSensitive = false
  ): Array<{ text: string; highlighted: boolean }> {
    return highlightMatches(text, query, caseSensitive)
  }
}

// 导出单例
export const bookmarkFilterService = new BookmarkFilterService()

// 导出类型
export type { BookmarkFilterOptions, FilteredBookmarkNode }
