/**
 * 应用层：搜索服务
 *
 * 职责：
 * - 封装对 IndexedDB 数据的检索与 Fuse 模糊搜索；
 * - 优先走 Worker 适配器以避免主线程阻塞；
 * - 提供 Hybrid 模式：结合 Fuse 与 Chrome 原生书签搜索进行权重合并；
 * - 对外仅暴露简单 search 接口与可选项，提升上层可用性。
 */
import {
  indexedDBManager,
  type SearchResult,
  type BookmarkRecord
} from '@/infrastructure/indexeddb/manager'
import { SearchEngine } from '@/core/search/engine'
import { FuseSearchStrategy } from '@/core/search/strategies/fuse-strategy'
import { searchWorkerAdapter } from '@/services/search-worker-adapter'

export type SearchStrategyName = 'fuse' | 'hybrid'
export interface SearchOptionsApp {
  strategy?: SearchStrategyName
  limit?: number
}

export class SearchAppService {
  private engine = new SearchEngine(new FuseSearchStrategy())

  async search(
    query: string,
    options: SearchOptionsApp = {}
  ): Promise<SearchResult[]> {
    const { strategy = 'fuse', limit = 100 } = options
    if (!query.trim()) return []

    await indexedDBManager.initialize()

    if (strategy === 'hybrid') {
      const data = await indexedDBManager.getAllBookmarks()
      return this.hybridSearch(query, data, limit)
    }

    // Prefer worker-based search for heavy fuse search
    try {
      return await searchWorkerAdapter.search(query, limit)
    } catch {
      // Fallback to in-thread search
      const data = await indexedDBManager.getAllBookmarks()
      const fuseResults = this.engine.search(query, data)
      return fuseResults.slice(0, limit)
    }
  }

  private async hybridSearch(
    query: string,
    data: BookmarkRecord[],
    limit: number
  ): Promise<SearchResult[]> {
    // 1) Fuse 本地模糊
    const fuseResults = this.engine.search(query, data)

    // 2) Chrome 原生检索（可能在某些环境不可用）
    let nativeIds: string[] = []
    try {
      if (typeof chrome !== 'undefined' && chrome?.bookmarks?.search) {
        const nodes = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
          resolve => {
            try {
              chrome.bookmarks.search(query, res => resolve(res || []))
            } catch {
              resolve([])
            }
          }
        )
        nativeIds = nodes.map(n => String(n?.id)).filter(Boolean)
      }
    } catch {
      // 忽略原生异常，退化为仅 Fuse
    }

    // 3) 将原生命中映射到 IDB 记录
    const byId = new Map<string, BookmarkRecord>()
    for (const r of data) byId.set(String(r.id), r)
    const nativeRecords: BookmarkRecord[] = []
    for (const id of nativeIds) {
      const rec = byId.get(id)
      if (rec && !rec.isFolder) nativeRecords.push(rec)
    }

    // 4) 构建 SearchResult，合并去重并选择更高分
    const outMap = new Map<string, SearchResult>()
    // 4.1 先放入 Fuse 结果（已带评分：越大越相关）
    for (const r of fuseResults) {
      const id = String(r.bookmark.id)
      if (!outMap.has(id)) outMap.set(id, { ...r })
      else if ((outMap.get(id)!.score ?? 0) < (r.score ?? 0))
        outMap.set(id, { ...r })
    }
    // 4.2 合并原生命中，给予较高基础分（例如 0.9），若已存在则取较大
    let bonus = 0.0
    for (const rec of nativeRecords) {
      const id = String(rec.id)
      const nativeScore = Math.min(1, 0.9 + Math.min(0.09, bonus))
      const current = outMap.get(id)
      if (!current || (current.score ?? 0) < nativeScore) {
        outMap.set(id, {
          bookmark: rec,
          score: nativeScore,
          matchedFields: [],
          highlights: {}
        })
      }
      bonus += 0.01
    }

    // 5) 输出排序与截断
    const merged = Array.from(outMap.values()).sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    )
    return merged.slice(0, limit)
  }
}

export const searchAppService = new SearchAppService()
