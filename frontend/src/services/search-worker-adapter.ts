/**
 * 搜索 Worker 适配器
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
} from '@/workers/search-worker-types'

import type { SearchWorkerAdapterOptions } from '@/types/application/service'

type WorkerHandle = Worker | null

export class SearchWorkerAdapter {
  private worker: WorkerHandle = null
  private reqCounter = 1
  private pending = new Map<
    number,
    (hits: Array<{ id: string; score: number }>) => void
  >()
  private inited = false
  private options: SearchWorkerAdapterOptions
  private byId: Map<string, BookmarkRecord> | null = null
  private currentReqId: number | null = null

  constructor(options: SearchWorkerAdapterOptions = {}) {
    this.options = options
  }

  async ensureWorker(): Promise<void> {
    if (this.worker) return
    // Vite module worker
    this.worker = new Worker(
      new URL('@/workers/search-worker.ts', import.meta.url),
      {
        type: 'module'
      }
    )
    this.worker.onmessage = e => this.onMessage(e.data as SearchWorkerEvent)
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
      isFolder: rec.isFolder
    }
  }

  async initFromIDB(): Promise<void> {
    await this.ensureWorker()
    await indexedDBManager.initialize()

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
    await this.ensureWorker()
    if (!this.inited) {
      await this.initFromIDB()
    }

    // 取消上一请求
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

    // 将 hits 映射回 BookmarkRecord（优先 in-memory 缓存，否则回退到按需读取）
    let byId = this.byId
    if (!byId) {
      await indexedDBManager.initialize()
      const data = await indexedDBManager.getAllBookmarks()
      byId = new Map<string, BookmarkRecord>(
        data.map((b: BookmarkRecord) => [String(b.id), b])
      )
      this.byId = byId
    }

    const results: SearchResult[] = []
    for (const h of hits) {
      const rec = byId.get(h.id)
      if (rec) {
        results.push({
          bookmark: rec,
          score: h.score,
          matchedFields: [],
          highlights: {}
        })
      }
    }
    return results
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
}

export const searchWorkerAdapter = new SearchWorkerAdapter()
