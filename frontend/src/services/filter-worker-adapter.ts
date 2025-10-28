/**
 * 筛选 Worker 适配器
 *
 * 职责：
 * - 管理 Web Worker 生命周期与通信；
 * - 将 IndexedDB 记录转换为 WorkerDoc，以便在 Worker 内构建索引；
 * - 以“最新请求优先”的策略丢弃过期结果，提升交互响应；
 * - 同步内存缓存 byId，减少重复读取。
 */
import type {
  BookmarkRecord,
  SearchResult
} from '@/infrastructure/indexeddb/manager'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type {
  SearchWorkerCommand,
  SearchWorkerEvent,
  WorkerDoc
} from '@/workers/filter-worker-types'

import type { SearchWorkerAdapterOptions } from '@/types/application/service'
import { logger } from '@/infrastructure/logging/logger'

type WorkerHandle = Worker | null

/**
 * 筛选 Worker 适配器，实现 Offscreen、Worker 与主线程三种执行路径。
 */
export class FilterWorkerAdapter {
  private worker: WorkerHandle = null
  private reqCounter = 1
  /** 当前待完成请求的回调映射表 */
  private pending = new Map<
    number,
    (hits: Array<{ id: string; score: number }>) => void
  >()
  /** Worker 是否已完成初始化 */
  private inited = false
  private options: SearchWorkerAdapterOptions
  private byId: Map<string, BookmarkRecord> | null = null
  private currentReqId: number | null = null
  private workerSupported: boolean
  private offscreenSupported =
    typeof chrome !== 'undefined' && !!chrome.offscreen
  private offscreenInitialized = false
  private offscreenInitPromise: Promise<void> | null = null

  private isServiceWorkerContext =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as unknown as ServiceWorkerGlobalScope).clients ===
      'object'

  constructor(options: SearchWorkerAdapterOptions = {}) {
    this.options = { workerUrl: '', cacheSize: 500, ...options }
    this.workerSupported = typeof Worker !== 'undefined'

    if (this.isServiceWorkerContext && this.offscreenSupported) {
      logger.info(
        'FilterWorkerAdapter',
        '🔀 将通过 Offscreen Document 代理筛选'
      )
    } else if (!this.workerSupported) {
      logger.warn(
        'FilterWorkerAdapter',
        '当前运行环境不支持 Worker，将退化为主线程筛选'
      )
    }
  }

  async ensureWorker(): Promise<void> {
    if (!this.workerSupported) return
    if (this.worker) return
    try {
      // Vite module worker
      this.worker = new Worker(
        new URL('@/workers/filter-worker.ts', import.meta.url),
        {
          type: 'module'
        }
      )
      this.worker.onmessage = e => this.onMessage(e.data as SearchWorkerEvent)
    } catch (error) {
      this.workerSupported = false
      this.worker = null
      logger.warn(
        'FilterWorkerAdapter',
        '创建 Worker 失败，退化为主线程筛选',
        error
      )
    }
  }

  private onMessage(evt: SearchWorkerEvent) {
    switch (evt.type) {
      case 'ready':
        break
      case 'inited':
        this.inited = true
        break
      case 'result': {
        // 仅处理最新的一次查询结果，其它丢弃
        if (this.currentReqId !== null && evt.reqId !== this.currentReqId) {
          // 丢弃过期请求
          this.pending.delete(evt.reqId)
          break
        }
        const cb = evt.reqId ? this.pending.get(evt.reqId) : undefined
        if (cb) {
          this.pending.delete(evt.reqId)
          cb(evt.hits)
        }
        break
      }
      case 'error':
        // 将错误反馈到对应的 pending 请求
        if (evt.reqId && this.pending.has(evt.reqId)) {
          const cb = this.pending.get(evt.reqId)!
          this.pending.delete(evt.reqId)
          cb([])
        }
        break
    }
  }

  private toDoc(rec: BookmarkRecord): WorkerDoc {
    return {
      id: String(rec.id),
      titleLower: rec.titleLower,
      urlLower: rec.urlLower,
      domain: rec.domain,
      keywords: rec.keywords,
      isFolder: rec.isFolder,
      url: rec.url ?? '',
      title: rec.title
    }
  }

  async initFromIDB(): Promise<void> {
    await this.ensureWorker()
    await indexedDBManager.initialize()

    if (!this.workerSupported || !this.worker) {
      this.inited = true
      return
    }

    // 先发送空初始化，随后分批 applyPatch(adds) 流式加载
    this.worker!.postMessage({ type: 'init', docs: [] } as SearchWorkerCommand)

    const pageSize = 2000
    let offset = 0
    let _totalLoaded = 0

    // 按页拉取，批次间让出事件循环，避免阻塞
    while (true) {
      const batch = await indexedDBManager.getAllBookmarks(pageSize, offset)
      if (!batch.length) break
      offset += batch.length
      _totalLoaded += batch.length

      // 维护 byId 的渐进式缓存（避免一次性占用大内存）
      if (!this.byId) this.byId = new Map<string, BookmarkRecord>()
      for (const b of batch) {
        this.byId.set(String(b.id), b)
      }

      const adds = batch
        .filter((b: BookmarkRecord) => !b.isFolder)
        .map((b: BookmarkRecord) => this.toDoc(b))
      if (adds.length) {
        const patch: SearchWorkerCommand = {
          type: 'applyPatch',
          adds
        }
        this.worker!.postMessage(patch)
      }

      // 批次间让步，提升交互响应
      await new Promise(r => setTimeout(r, 0))
    }
    // 标记初始化完成
    this.inited = true
  }

  async search(
    query: string,
    limit = this.options.limit ?? 100
  ): Promise<SearchResult[]> {
    if (!query.trim()) return []

    const canUseOffscreen =
      this.isServiceWorkerContext && this.offscreenSupported

    if (canUseOffscreen) {
      try {
        await this.ensureOffscreenInitialized()
        const { dispatchOffscreenRequest } = await import(
          '@/background/offscreen-manager'
        )
        const offscreenHits = await dispatchOffscreenRequest<
          Array<{ id: string; score: number }>
        >(
          {
            type: 'SEARCH_QUERY',
            payload: { query, limit }
          },
          { timeout: 5000 }
        )
        logger.info(
          'FilterWorkerAdapter',
          `Offscreen 返回命中: ${offscreenHits.length}`,
          offscreenHits.slice(0, 5)
        )
        const mappedResults = await this.mapHitsToResults(offscreenHits, query)
        logger.info(
          'FilterWorkerAdapter',
          `Offscreen 命中映射后: ${mappedResults.length}`,
          mappedResults.slice(0, 3).map(item => ({
            id: item.id,
            score: item.score,
            title: item.bookmark.title,
            url: item.bookmark.url
          }))
        )
        if (!mappedResults.length) {
          logger.warn('FilterWorkerAdapter', `Offscreen 命中为空: ${query}`)
        }
        return mappedResults
      } catch (error) {
        logger.warn(
          'FilterWorkerAdapter',
          'Offscreen 筛选失败，退回本地 fallback',
          error
        )
      }
    }

    if (!this.workerSupported) {
      return this.fallbackSearch(query, limit)
    }
    await this.ensureWorker()
    if (!this.workerSupported || !this.worker) {
      return this.fallbackSearch(query, limit)
    }
    if (!this.inited) {
      await this.initFromIDB()
    }

    if (this.currentReqId && this.pending.has(this.currentReqId)) {
      const prev = this.pending.get(this.currentReqId)!
      this.pending.delete(this.currentReqId)
      prev([])
    }
    const reqId = this.reqCounter++
    this.currentReqId = reqId
    const cmd: SearchWorkerCommand = { type: 'query', q: query, limit, reqId }

    const hits = await new Promise<Array<{ id: string; score: number }>>(
      resolve => {
        this.pending.set(reqId, resolve)
        this.worker!.postMessage(cmd)
      }
    )

    return this.mapHitsToResults(hits, query)
  }

  private async fallbackSearch(
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    logger.info(
      'FilterWorkerAdapter',
      `⚠️ 使用主线程 fallback 筛选: "${query}"`
    )
    await indexedDBManager.initialize()
    const results = await indexedDBManager.searchBookmarks(query, {
      query,
      limit,
      includeDomain: true,
      includeUrl: true,
      includeKeywords: true,
      includeTags: true
    })
    return results
  }

  private async mapHitsToResults(
    hits: Array<{ id: string; score: number }>,
    query: string
  ): Promise<SearchResult[]> {
    if (!hits.length) return []

    let byId = this.byId
    if (!byId) {
      await indexedDBManager.initialize()
      const data = await indexedDBManager.getAllBookmarks()
      byId = new Map<string, BookmarkRecord>(
        data.map((b: BookmarkRecord) => [String(b.id), b])
      )
      this.byId = byId
    }

    const normalizedQuery = query.trim().toLowerCase()
    const results: SearchResult[] = []
    for (const h of hits) {
      const rec = byId.get(h.id)
      if (rec && !rec.isFolder) {
        results.push({
          id: rec.id,
          bookmark: rec,
          score: h.score,
          highlights: [],
          pathString: rec.pathString
        })
      }
    }
    if (normalizedQuery.length < 4) {
      return results
    }
    return results.filter(result =>
      this.includesQuery(result.bookmark, normalizedQuery)
    )
  }

  private includesQuery(bookmark: BookmarkRecord, query: string): boolean {
    if (bookmark.titleLower.includes(query)) return true
    if (bookmark.urlLower?.includes(query)) return true
    if (bookmark.domain?.includes(query)) return true
    if (bookmark.keywords?.some(keyword => keyword.includes(query))) return true
    return false
  }

  async applyPatch(delta: {
    adds?: BookmarkRecord[]
    updates?: BookmarkRecord[]
    removes?: string[]
  }): Promise<void> {
    await this.ensureWorker()
    const cmd: SearchWorkerCommand = {
      type: 'applyPatch',
      adds: delta.adds?.map(b => this.toDoc(b)),
      updates: delta.updates?.map(b => this.toDoc(b)),
      removes: delta.removes
    }
    this.worker!.postMessage(cmd)

    // 同步内存缓存
    if (!this.byId) this.byId = new Map<string, BookmarkRecord>()
    if (delta.removes?.length) {
      for (const id of delta.removes) this.byId.delete(String(id))
    }
    if (delta.updates?.length) {
      for (const b of delta.updates) this.byId.set(String(b.id), b)
    }
    if (delta.adds?.length) {
      for (const b of delta.adds) this.byId.set(String(b.id), b)
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' } as SearchWorkerCommand)
      this.worker.terminate()
      this.worker = null

      this.inited = false
    }
  }

  private async ensureOffscreenInitialized(): Promise<void> {
    if (!this.isServiceWorkerContext || !this.offscreenSupported) {
      return
    }

    if (this.offscreenInitialized) {
      return
    }

    if (!this.offscreenInitPromise) {
      this.offscreenInitPromise = (async () => {
        try {
          const { dispatchOffscreenRequest } = await import(
            '@/background/offscreen-manager'
          )
          await dispatchOffscreenRequest(
            { type: 'SEARCH_INIT' },
            { timeout: 10000 }
          )
          this.offscreenInitialized = true
        } catch (error) {
          this.offscreenInitialized = false
          throw error
        } finally {
          this.offscreenInitPromise = null
        }
      })()
    }

    try {
      await this.offscreenInitPromise
    } catch (_error) {
      // 初始化失败：继续后续 fallback
    }
  }
}

export const filterWorkerAdapter = new FilterWorkerAdapter()

// 兼容旧名称（废弃）
/** @deprecated 请使用 filterWorkerAdapter */
export const searchWorkerAdapter = filterWorkerAdapter
