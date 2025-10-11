/**
 * 核心搜索引擎
 *
 * 设计：
 * - 通过策略接口 `SearchStrategy` 解耦具体实现；
 * - 统一处理输入规范（trim/空串），保持上层调用简洁；
 * - 与数据来源无关，仅接收 BookmarkRecord 列表进行检索。
 */
import type {
  BookmarkRecord,
  SearchResult
} from '@/infrastructure/indexeddb/manager'

export interface SearchStrategy {
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[]
}

export class SearchEngine {
  constructor(private strategy: SearchStrategy) {}

  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[] {
    const q = String(query || '').trim()
    if (!q) return []
    return this.strategy.search(q, bookmarks)
  }
}
