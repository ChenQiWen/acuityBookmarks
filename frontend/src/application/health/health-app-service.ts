/**
 * 健康概览应用服务
 *
 * 职责：
 * - 汇总书签健康状况数据
 * - 统计 HTTP 状态错误和重复书签
 * - 提供书签数据库的健康概览
 *
 * 目标：
 * - 汇总抓取的 HTTP 状态数据与书签重复情况
 * - 仅做轻量聚合与统计，避免与 UI/Store 耦合
 * - 所有返回值以 Result 包裹，统一错误处理路径
 */
import type { Result } from '@/core/common/result'
import { ok as Ok, err as Err } from '@/core/common/result'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { HealthOverview } from '@/types/application/health'

/**
 * 健康概览应用服务类
 *
 * @remarks
 * 负责协调 IndexedDB 中的书签、抓取元数据，输出可供 UI 使用的聚合结果。
 */
class HealthAppService {
  /**
   * 初始化服务
   *
   * 确保 IndexedDB 已准备就绪
   */
  async initialize(): Promise<void> {
    await indexedDBManager.initialize()
  }

  /**
   * 获取书签健康概览
   *
   * 统计各类 HTTP 状态错误和重复书签数量
   *
   * @returns 包含健康概览数据的 Result 对象
   */
  async getHealthOverview(): Promise<Result<HealthOverview, Error>> {
    try {
      await indexedDBManager.initialize()

      // Pull all bookmarks and crawl metadata; compute simple health aggregates
      const bookmarks = await indexedDBManager.getAllBookmarks()

      /**
       * HTTP 状态聚合统计
       *
       * @description
       * 通过遍历抓取元数据，累计各类 HTTP 状态数量。
       */
      const counts: {
        totalScanned: number
        dead: number
      } = {
        totalScanned: 0,
        dead: 0
      }

      for (const bookmark of bookmarks) {
        if (bookmark.healthTags?.includes('404')) {
          counts.dead += 1
        }
        if (bookmark.healthMetadata?.some(entry => entry.tag === '404')) {
          counts.totalScanned += 1
        }
      }

      // Duplicate URLs among bookmarks (only those with url)
      /**
       * URL 出现次数映射，用于统计重复书签数量。
       */
      const urlMap = new Map<string, number>()
      for (const b of bookmarks) {
        if (!b.url) continue
        if (b.healthTags?.includes('duplicate')) {
          urlMap.set(b.url, (urlMap.get(b.url) || 0) + 1)
        }
      }
      const duplicateCount = Array.from(urlMap.values()).reduce(
        (total, count) => total + count,
        0
      )

      return Ok({
        totalScanned: counts.totalScanned,
        dead: counts.dead,
        duplicateCount
      })
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  // No-op: legacy fallback removed in favor of getAllCrawlMetadata
}

export const healthAppService = new HealthAppService()
