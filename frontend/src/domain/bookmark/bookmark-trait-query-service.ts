/**
 * 书签特征查询服务
 * 
 * 职责：
 * - 提供统一的书签特征查询接口
 * - 利用 IndexedDB 索引优化性能
 * - 业务中立：不关心查询结果的用途
 * 
 * 设计原则：
 * - 单一职责：只负责查询，不负责业务决策
 * - 高性能：优先使用索引
 * - 易扩展：支持新增特征类型
 * 
 * @example
 * ```typescript
 * // 查询所有重复书签
 * const duplicateIds = await bookmarkTraitQueryService.queryByTrait('duplicate')
 * 
 * // 业务层决定如何使用：
 * // - 清理业务：删除这些书签
 * // - 整理业务：移动到"待处理"文件夹
 * // - 导出业务：导出为 CSV
 * ```
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签特征类型
 * 
 * 特征是对书签的客观描述，不带价值判断：
 * - duplicate: 重复书签（URL 完全相同的书签，从第二个开始）
 * - invalid: 失效书签（无法正常访问的书签）
 * - internal: 内部书签（浏览器内部地址）
 */
export type BookmarkTrait = 
  | 'duplicate'    // 重复书签：URL 完全相同的书签（从第二个开始）
  | 'invalid'      // 失效书签：无法正常访问的书签
  | 'internal'     // 内部书签：浏览器内部地址

/**
 * 查询选项
 */
export interface TraitQueryOptions {
  /** 是否返回完整的书签对象（默认只返回 ID） */
  includeFullRecord?: boolean
  /** 排序字段 */
  sortBy?: 'dateAdded' | 'title' | 'url'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 查询结果
 */
export interface TraitQueryResult {
  ids: string[]
  records?: BookmarkRecord[]
  count: number
}

/**
 * 书签特征查询服务
 */
class BookmarkTraitQueryService {
  /**
   * 通过特征查询书签（使用 IndexedDB 索引优化）
   * 
   * 性能优化：
   * - 使用 IndexedDB 的 multiEntry 索引
   * - 避免全表扫描
   * - 只返回需要的数据（ID 或完整记录）
   * 
   * @param trait - 特征类型
   * @param options - 查询选项
   * @returns 查询结果
   * 
   * @example
   * ```typescript
   * // 只获取 ID（最快）
   * const result = await queryByTrait('duplicate')
   * console.log(result.ids)  // ['id1', 'id2', ...]
   * 
   * // 获取完整记录并排序
   * const result = await queryByTrait('duplicate', {
   *   includeFullRecord: true,
   *   sortBy: 'dateAdded',
   *   sortOrder: 'asc'
   * })
   * ```
   */
  async queryByTrait(
    trait: BookmarkTrait,
    options: TraitQueryOptions = {}
  ): Promise<TraitQueryResult> {
    try {
      // 获取所有书签，然后筛选具有指定特征的书签
      const allBookmarks = await indexedDBManager.getAllBookmarks()
      
      // 筛选具有指定特征的书签
      let records = allBookmarks.filter(record => 
        record.traitTags && record.traitTags.includes(trait)
      )
      
      // 排序
      if (options.sortBy) {
        records = this.sortRecords(records, options.sortBy, options.sortOrder)
      }
      
      const ids = records.map(r => r.id)
      
      logger.debug('TraitQueryService', `查询特征 "${trait}": ${records.length} 条`)
      
      return {
        ids,
        records: options.includeFullRecord ? records : undefined,
        count: records.length
      }
    } catch (error) {
      logger.error('TraitQueryService', '查询特征异常', error)
      throw error
    }
  }
  
  /**
   * 查询具有多个特征的书签（交集）
   * 
   * 用于查询同时具有多个特征的书签，例如：
   * - 既是重复又是失效的书签
   * - 既是内部又是未访问的书签
   * 
   * @param traits - 特征类型数组
   * @param options - 查询选项
   * @returns 同时具有所有特征的书签
   * 
   * @example
   * ```typescript
   * // 查询既是重复又是失效的书签
   * const result = await queryByTraits(['duplicate', 'invalid'])
   * ```
   */
  async queryByTraits(
    traits: BookmarkTrait[],
    options: TraitQueryOptions = {}
  ): Promise<TraitQueryResult> {
    if (traits.length === 0) {
      return { ids: [], count: 0 }
    }
    
    if (traits.length === 1) {
      return this.queryByTrait(traits[0], options)
    }
    
    // 查询每个特征的结果
    const results = await Promise.all(
      traits.map(trait => this.queryByTrait(trait, { includeFullRecord: true }))
    )
    
    // 计算交集
    const idSets = results.map(r => new Set(r.ids))
    const intersection = idSets.reduce((acc, set) => {
      return new Set([...acc].filter(id => set.has(id)))
    })
    
    const ids = Array.from(intersection)
    
    // 如果需要完整记录，从第一个结果中筛选
    let records: BookmarkRecord[] | undefined
    if (options.includeFullRecord && results[0].records) {
      records = results[0].records.filter(r => intersection.has(r.id))
      
      if (options.sortBy) {
        records = this.sortRecords(records, options.sortBy, options.sortOrder)
      }
    }
    
    return {
      ids,
      records,
      count: ids.length
    }
  }
  
  /**
   * 获取书签的所有特征
   * 
   * @param bookmarkId - 书签 ID
   * @returns 特征列表
   * 
   * @example
   * ```typescript
   * const traits = await getBookmarkTraits('bookmark-123')
   * console.log(traits)  // ['duplicate', 'invalid']
   * ```
   */
  async getBookmarkTraits(bookmarkId: string): Promise<BookmarkTrait[]> {
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const bookmark = allBookmarks.find(b => b.id === bookmarkId)
    return (bookmark?.traitTags || []) as BookmarkTrait[]
  }
  
  /**
   * 统计各特征的书签数量
   * 
   * 用于生成统计报告，例如：
   * - Popup 页面的"需要关注"区块
   * - Management 页面的筛选器统计
   * 
   * @returns 特征统计信息
   * 
   * @example
   * ```typescript
   * const stats = await getTraitStatistics()
   * console.log(stats)  // { duplicate: 42, invalid: 15, internal: 8 }
   * ```
   */
  async getTraitStatistics(): Promise<Record<BookmarkTrait, number>> {
    const traits: BookmarkTrait[] = ['duplicate', 'invalid', 'internal']
    
    const counts = await Promise.all(
      traits.map(async trait => {
        const result = await this.queryByTrait(trait)
        return result.count
      })
    )
    
    return {
      duplicate: counts[0],
      invalid: counts[1],
      internal: counts[2]
    }
  }
  
  /**
   * 排序书签记录
   * 
   * @private
   */
  private sortRecords(
    records: BookmarkRecord[],
    sortBy: 'dateAdded' | 'title' | 'url',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): BookmarkRecord[] {
    const sorted = [...records].sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'dateAdded':
          comparison = (a.dateAdded || 0) - (b.dateAdded || 0)
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'url':
          comparison = (a.url || '').localeCompare(b.url || '')
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    return sorted
  }
}

export const bookmarkTraitQueryService = new BookmarkTraitQueryService()
