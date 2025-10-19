/**
 * Fuse.js 模糊搜索策略
 *
 * 职责：
 * - 实现基于 Fuse.js 的模糊匹配搜索
 * - 对书签记录构建搜索索引
 * - 按字段权重匹配（标题、URL、域名、关键词）
 * - 提供相关性评分
 *
 * 说明：
 * - 对 BookmarkRecord 构建 Fuse 索引，按权重匹配标题/URL/域名/关键词
 * - 数据量变化时按长度散列触发索引重建，兼顾性能与准确性
 * - 输出标准化的 SearchResult，得分统一归一化为 [0,1]，越大越相关
 *
 * 权重配置：
 * - 标题：60%
 * - URL：30%
 * - 域名：20%
 * - 关键词：20%
 */
import Fuse from 'fuse.js'
import type {
  BookmarkRecord,
  SearchResult
} from '@/infrastructure/indexeddb/manager'
import type { SearchStrategy } from '../engine'

/**
 * Fuse 搜索策略类
 *
 * 实现 SearchStrategy 接口，提供模糊搜索能力
 */
export class FuseSearchStrategy implements SearchStrategy {
  /** Fuse 搜索引擎实例 */
  private fuse: Fuse<BookmarkRecord> | null = null
  /** 上次数据的哈希值（用于检测数据变化） */
  private lastDataHash = ''

  /**
   * 确保搜索索引已构建
   *
   * 当数据变化时自动重建索引
   *
   * @param data - 书签记录数组
   */
  private ensureIndex(data: BookmarkRecord[]) {
    const hash = String(data?.length || 0)
    if (!this.fuse || this.lastDataHash !== hash) {
      this.fuse = new Fuse(data, {
        includeScore: true,
        threshold: 0.3,
        keys: [
          { name: 'titleLower', weight: 0.6 },
          { name: 'urlLower', weight: 0.3 },
          { name: 'domain', weight: 0.2 },
          { name: 'keywords', weight: 0.2 }
        ]
      })
      this.lastDataHash = hash
    }
  }

  /**
   * 执行搜索
   *
   * @param query - 搜索查询字符串
   * @param bookmarks - 待搜索的书签记录数组
   * @returns 搜索结果数组，按相关性排序，最多返回 100 条
   */
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[] {
    this.ensureIndex(bookmarks)
    const fuse = this.fuse!
    const hits = fuse.search(query).slice(0, 100)
    return hits.map(h => ({
      id: h.item.id,
      bookmark: h.item,
      score: Math.max(1e-6, 1 - (h.score ?? 1)),
      highlights: []
    }))
  }
}
