/**
 * 应用层：健康概览服务
 *
 * 目标：
 * - 汇总抓取的 HTTP 状态数据与书签重复情况；
 * - 仅做轻量聚合与统计，避免与 UI/Store 耦合；
 * - 所有返回值以 Result 包裹，统一错误处理路径。
 */
import type { Result } from '@/core/common/result'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { HealthOverview } from '@/types/application/health'

class HealthAppService {
  async getHealthOverview(): Promise<Result<HealthOverview, Error>> {
    try {
      await indexedDBManager.initialize()

      // Pull all bookmarks and crawl metadata; compute simple health aggregates
      const [bookmarks, crawlMeta] = await Promise.all([
        indexedDBManager.getAllBookmarks(),
        indexedDBManager.getAllCrawlMetadata()
      ])

      const counts = {
        totalScanned: 0,
        http404: 0,
        http500: 0,
        other4xx: 0,
        other5xx: 0
      }

      for (const m of crawlMeta) {
        counts.totalScanned += 1
        const s = Number(m.httpStatus || 0)
        if (s === 404) counts.http404 += 1
        else if (s === 500) counts.http500 += 1
        else if (s >= 400 && s < 500) counts.other4xx += 1
        else if (s >= 500 && s < 600) counts.other5xx += 1
      }

      // Duplicate URLs among bookmarks (only those with url)
      const urlMap = new Map<string, number>()
      for (const b of bookmarks) {
        if (b.url) {
          urlMap.set(b.url, (urlMap.get(b.url) || 0) + 1)
        }
      }
      const duplicateCount = Array.from(urlMap.values()).filter(
        n => n > 1
      ).length

      return Ok({
        totalScanned: counts.totalScanned,
        http404: counts.http404,
        http500: counts.http500,
        other4xx: counts.other4xx,
        other5xx: counts.other5xx,
        duplicateCount
      })
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  // No-op: legacy fallback removed in favor of getAllCrawlMetadata
}

export const healthAppService = new HealthAppService()
