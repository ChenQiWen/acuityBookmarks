/**
 * 清理应用服务
 * 
 * 职责：
 * - 提供一键清理功能（重复书签、失效书签）
 * - 协调特征查询服务和书签删除服务
 * - 返回清理结果统计
 * 
 * 设计原则：
 * - 业务中立：不判断是否应该清理，只执行清理操作
 * - 串行删除：简单可靠，性能可接受
 * - 详细反馈：返回成功/失败统计
 * 
 * @example
 * ```typescript
 * // 清理重复书签
 * const result = await cleanupAppService.cleanupDuplicates()
 * console.log(`删除 ${result.deleted} 条，失败 ${result.failed} 条`)
 * 
 * // 清理失效书签
 * const result = await cleanupAppService.cleanupInvalid()
 * ```
 */

import { bookmarkTraitQueryService } from '@/domain/bookmark/bookmark-trait-query-service'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 清理结果
 */
export interface CleanupResult {
  /** 成功删除的书签数量 */
  deleted: number
  /** 删除失败的书签数量 */
  failed: number
  /** 总共尝试删除的书签数量 */
  total: number
  /** 失败的书签 ID 列表 */
  failedIds: string[]
}

/**
 * 清理应用服务
 */
class CleanupAppService {
  /**
   * 清理重复书签
   * 
   * 流程：
   * 1. 查询所有具有 'duplicate' 特征的书签 ID
   * 2. 串行删除每个书签
   * 3. 统计成功/失败数量
   * 
   * @returns 清理结果统计
   * 
   * @example
   * ```typescript
   * const result = await cleanupAppService.cleanupDuplicates()
   * if (result.deleted > 0) {
   *   console.log(`成功清理 ${result.deleted} 条重复书签`)
   * }
   * if (result.failed > 0) {
   *   console.warn(`${result.failed} 条书签删除失败`)
   * }
   * ```
   */
  async cleanupDuplicates(): Promise<CleanupResult> {
    try {
      logger.info('CleanupAppService', '开始清理重复书签...')
      
      // 1. 查询所有重复书签的 ID
      const queryResult = await bookmarkTraitQueryService.queryByTrait('duplicate')
      const ids = queryResult.ids
      
      if (ids.length === 0) {
        logger.info('CleanupAppService', '没有重复书签需要清理')
        return {
          deleted: 0,
          failed: 0,
          total: 0,
          failedIds: []
        }
      }
      
      logger.info('CleanupAppService', `找到 ${ids.length} 条重复书签，开始删除...`)
      
      // 2. 串行删除每个书签
      const result = await this.deleteBookmarksSerially(ids)
      
      logger.info('CleanupAppService', `清理完成: 成功 ${result.deleted} 条，失败 ${result.failed} 条`)
      
      return result
    } catch (error) {
      logger.error('CleanupAppService', '清理重复书签失败', error)
      throw error
    }
  }
  
  /**
   * 清理失效书签
   * 
   * 流程：
   * 1. 查询所有具有 'invalid' 特征的书签 ID
   * 2. 串行删除每个书签
   * 3. 统计成功/失败数量
   * 
   * @returns 清理结果统计
   * 
   * @example
   * ```typescript
   * const result = await cleanupAppService.cleanupInvalid()
   * if (result.deleted > 0) {
   *   console.log(`成功清理 ${result.deleted} 条失效书签`)
   * }
   * ```
   */
  async cleanupInvalid(): Promise<CleanupResult> {
    try {
      logger.info('CleanupAppService', '开始清理失效书签...')
      
      // 1. 查询所有失效书签的 ID
      const queryResult = await bookmarkTraitQueryService.queryByTrait('invalid')
      const ids = queryResult.ids
      
      if (ids.length === 0) {
        logger.info('CleanupAppService', '没有失效书签需要清理')
        return {
          deleted: 0,
          failed: 0,
          total: 0,
          failedIds: []
        }
      }
      
      logger.info('CleanupAppService', `找到 ${ids.length} 条失效书签，开始删除...`)
      
      // 2. 串行删除每个书签
      const result = await this.deleteBookmarksSerially(ids)
      
      logger.info('CleanupAppService', `清理完成: 成功 ${result.deleted} 条，失败 ${result.failed} 条`)
      
      return result
    } catch (error) {
      logger.error('CleanupAppService', '清理失效书签失败', error)
      throw error
    }
  }
  
  /**
   * 串行删除书签
   * 
   * 采用串行删除策略：
   * - 简单可靠：不会因为并发导致竞态条件
   * - 性能可接受：即使 100 条书签，也只需要几秒钟
   * - 易于调试：可以清楚地看到每一步的执行情况
   * 
   * @private
   * @param ids - 要删除的书签 ID 列表
   * @returns 删除结果统计
   */
  private async deleteBookmarksSerially(ids: string[]): Promise<CleanupResult> {
    let deleted = 0
    let failed = 0
    const failedIds: string[] = []
    
    for (const id of ids) {
      try {
        const result = await bookmarkAppService.deleteBookmark(id)
        
        if (result.ok) {
          deleted++
          logger.debug('CleanupAppService', `删除成功: ${id}`)
        } else {
          failed++
          failedIds.push(id)
          logger.warn('CleanupAppService', `删除失败: ${id}`, result.error)
        }
      } catch (error) {
        failed++
        failedIds.push(id)
        logger.error('CleanupAppService', `删除异常: ${id}`, error)
      }
    }
    
    return {
      deleted,
      failed,
      total: ids.length,
      failedIds
    }
  }
}

export const cleanupAppService = new CleanupAppService()
