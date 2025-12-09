/**
 * 书签查询服务（Application 层）
 *
 * 统一的查询服务，支持多种数据源：
 * - IndexedDB（异步）
 * - 内存数据（同步）
 * - 自定义数据源
 *
 * @module application/query/bookmark-query-service
 */

import { queryAppService as queryAppService } from '@/application/query/query-app-service'
import {
  filterBookmarkNodes,
  flattenFilterResults,
  highlightMatches,
  recalculateChildrenCount,
  type BookmarkFilterOptions,
  type FilteredBookmarkNode
} from '@/core/filter/bookmark-filter'
import type { BookmarkNode } from '@/types'
import type { EnhancedSearchResult } from '@/types/domain/query'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 查询模式
 */
export type FilterMode = 'indexeddb' | 'memory'

/**
 * 查询结果（带元数据）
 */
export interface FilterResult {
  /** 查询后的节点 */
  nodes: FilteredBookmarkNode[]

  /** 总结果数 */
  total: number

  /** 执行时间（毫秒） */
  executionTime: number

  /** 数据源 */
  source: FilterMode
}

/**
 * 书签查询服务类
 */
class BookmarkFilterService {
  /**
   * 从 IndexedDB 查询（异步）
   *
   * 使用 queryAppService 进行高性能查询
   *
   * @param query - 查询条件
   * @param options - 查询选项
   * @returns 查询结果
   */
  async filterFromIndexedDB(
    query: string,
    options: BookmarkFilterOptions = {}
  ): Promise<FilterResult> {
    const startTime = performance.now()

    try {
      // 使用 queryAppService 进行高性能查询
      const response = await queryAppService.searchWithMetadata(query, {
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
        `从 IndexedDB 查询完成: "${query}"`,
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
      logger.error('BookmarkFilterService', '从 IndexedDB 查询失败', error)
      throw error
    }
  }

  /**
   * 从内存数据查询（同步）
   *
   * 适用于：
   * - 已编辑但未保存的数据
   * - LLM 返回的数据
   * - 任何内存中的书签数据
   *
   * @param nodes - 书签节点数组
   * @param query - 查询条件
   * @param options - 查询选项
   * @returns 查询结果
   */
  filterFromMemory(
    nodes: BookmarkNode[],
    query: string,
    options: BookmarkFilterOptions = {}
  ): FilterResult {
    const startTime = performance.now()

    try {
      // 使用核心查询函数
      let filteredNodes = filterBookmarkNodes(nodes, query, options)

      // 重新计算每个节点的 childrenCount（基于筛选后的结果）
      filteredNodes = recalculateChildrenCount(filteredNodes)

      // 扁平化结果，获取所有实际匹配的节点数量
      const flattenedResults = flattenFilterResults(filteredNodes)
      const actualTotal = flattenedResults.length

      const executionTime = Math.round(performance.now() - startTime)

      logger.info('BookmarkFilterService', `从内存查询完成: "${query}"`, {
        total: actualTotal,
        executionTime
      })

      return {
        nodes: filteredNodes,
        total: actualTotal, // 使用实际匹配的书签数量
        executionTime,
        source: 'memory'
      }
    } catch (error) {
      logger.error('BookmarkFilterService', '从内存查询失败', error)
      throw error
    }
  }

  /**
   * 统一查询接口（自动选择数据源）
   *
   * @param query - 查询条件
   * @param mode - 查询模式
   * @param data - 内存数据（mode='memory' 时必需）
   * @param options - 查询选项
   * @returns 查询结果
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
   * 扁平化查询结果
   *
   * @param nodes - 查询后的树形节点
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
