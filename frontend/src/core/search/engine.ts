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

/**
 * 搜索策略接口
 *
 * 定义搜索算法的标准契约，允许灵活切换不同的搜索实现
 */
export interface SearchStrategy {
  /**
   * 执行搜索操作
   *
   * @param query - 搜索查询字符串
   * @param bookmarks - 待搜索的书签记录列表
   * @returns 匹配的搜索结果数组，按相关性排序
   */
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[]
}

/**
 * 搜索引擎类
 *
 * 使用策略模式实现可插拔的搜索算法，支持多种搜索策略
 */
export class SearchEngine {
  /**
   * 构造函数
   *
   * @param strategy - 具体的搜索策略实现
   */
  constructor(private strategy: SearchStrategy) {}

  /**
   * 执行搜索
   *
   * @param query - 搜索查询字符串
   * @param bookmarks - 待搜索的书签记录列表
   * @returns 匹配的搜索结果数组，如果查询为空则返回空数组
   */
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[] {
    const q = String(query || '').trim()
    if (!q) return []
    return this.strategy.search(q, bookmarks)
  }
}
