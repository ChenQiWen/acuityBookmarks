/**
 * 核心筛选引擎
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
 * 筛选策略接口
 *
 * 定义筛选算法的标准契约，允许灵活切换不同的筛选实现
 */
export interface SearchStrategy {
  /**
   * 执行筛选操作
   *
   * @param query - 筛选查询字符串
   * @param bookmarks - 待筛选的书签记录列表
   * @returns 匹配的筛选结果数组，按相关性排序
   */
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[]
}

/**
 * 筛选引擎类
 *
 * 使用策略模式实现可插拔的筛选算法，支持多种筛选策略
 */
export class SearchEngine {
  /**
   * 构造函数
   *
   * @param strategy - 具体的筛选策略实现
   */
  constructor(private strategy: SearchStrategy) {}

  /**
   * 执行筛选
   *
   * @param query - 筛选查询字符串
   * @param bookmarks - 待筛选的书签记录列表
   * @returns 匹配的筛选结果数组，如果查询为空则返回空数组
   */
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[] {
    const q = String(query || '').trim()
    if (!q) return []
    return this.strategy.search(q, bookmarks)
  }
}
