/**
 * 搜索策略：Fuse.js 模糊匹配
 *
 * 说明：
 * - 对 BookmarkRecord 构建 Fuse 索引，按权重匹配标题/URL/域名/关键词；
 * - 数据量变化时按长度散列触发索引重建，兼顾性能与准确性；
 * - 输出标准化的 SearchResult，得分统一归一化为 [0,1]，越大越相关。
 */
import Fuse from 'fuse.js'
import type {
  BookmarkRecord,
  SearchResult
} from '@/infrastructure/indexeddb/manager'
import type { SearchStrategy } from '../engine'

export class FuseSearchStrategy implements SearchStrategy {
  private fuse: Fuse<BookmarkRecord> | null = null
  private lastDataHash = ''

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
