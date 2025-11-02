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
   * @description
   * ⚠️ 统一从 healthTags 字段读取，确保与 Management 页面筛选逻辑一致。
   * 这是唯一可靠的数据源，因为：
   * 1. healthTags 在书签同步时就会设置
   * 2. isDuplicate/isInvalid 字段可能因为数据迁移不完整而缺失
   * 3. 必须保证 Popup 统计和 Management 筛选的数据来源一致
   *
   * @returns 包含健康概览数据的 Result 对象
   *
   * @example
   * ```typescript
   * const result = await healthAppService.getHealthOverview()
   * if (result.ok) {
   *   console.log(`重复书签: ${result.value.duplicateCount}`)
   *   console.log(`失效书签: ${result.value.dead}`)
   * }
   * ```
   */
  async getHealthOverview(): Promise<Result<HealthOverview, Error>> {
    try {
      await indexedDBManager.initialize()

      // ✅ 加载所有书签，从 healthTags 字段统计（与 Management 页面逻辑一致）
      const allBookmarks = await indexedDBManager.getAllBookmarks()

      // 统计已扫描书签（有 healthTags 字段的）
      const totalScanned = allBookmarks.filter(
        b => b.healthTags !== undefined
      ).length

      // ✅ 统计重复书签：从 healthTags 读取（与筛选逻辑一致）
      const duplicateCount = allBookmarks.filter(
        b => b.healthTags && b.healthTags.includes('duplicate')
      ).length

      // ✅ 统计失效书签：从 healthTags 读取（与筛选逻辑一致）
      const invalidCount = allBookmarks.filter(
        b => b.healthTags && b.healthTags.includes('invalid')
      ).length

      return Ok({
        totalScanned,
        dead: invalidCount,
        duplicateCount
      })
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  // No-op: legacy fallback removed in favor of getAllCrawlMetadata
}

export const healthAppService = new HealthAppService()
