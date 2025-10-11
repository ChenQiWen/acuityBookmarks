/// <reference lib="webworker" />
import Fuse from 'fuse.js'
import type {
  SearchWorkerCommand,
  SearchWorkerEvent,
  WorkerDoc,
  WorkerHit,
  WorkerInitOptions
} from './search-worker-types'

declare const self: DedicatedWorkerGlobalScope

let fuse: Fuse<WorkerDoc> | null = null
let docs: WorkerDoc[] = []

function post(msg: SearchWorkerEvent) {
  self.postMessage(msg)
}

function buildIndex(input: WorkerDoc[], options?: WorkerInitOptions) {
  const keys = options?.keys ?? [
    { name: 'titleLower', weight: 0.6 },
    { name: 'urlLower', weight: 0.3 },
    { name: 'domain', weight: 0.2 }
  ]
  const threshold = options?.threshold ?? 0.3
  fuse = new Fuse(input, {
    includeScore: true,
    threshold,
    keys: keys as unknown as Array<Fuse.FuseOptionKey<WorkerDoc>>
  })
}

function handleInit(cmd: Extract<SearchWorkerCommand, { type: 'init' }>) {
  docs = cmd.docs || []
  buildIndex(docs, cmd.options)
  post({ type: 'inited', docCount: docs.length })
}

function handleQuery(cmd: Extract<SearchWorkerCommand, { type: 'query' }>) {
  if (!fuse) {
    buildIndex(docs)
  }
  if (!fuse) {
    post({
      type: 'error',
      message: 'Search index not initialized',
      reqId: cmd.reqId
    })
    return
  }
  const res = fuse.search(cmd.q)
  const top = (cmd.limit ? res.slice(0, cmd.limit) : res).map(h => ({
    id: h.item.id,
    score: Math.max(1e-6, 1 - (h.score ?? 1))
  })) as WorkerHit[]
  post({ type: 'result', reqId: cmd.reqId, hits: top })
}

function handlePatch(
  cmd: Extract<SearchWorkerCommand, { type: 'applyPatch' }>
) {
  let changed = false
  if (cmd.removes && cmd.removes.length) {
    const set = new Set(cmd.removes)
    const before = docs.length
    docs = docs.filter(d => !set.has(d.id))
    changed = changed || docs.length !== before
  }
  if (cmd.updates && cmd.updates.length) {
    const idMap = new Map(docs.map(d => [d.id, d] as const))
    for (const u of cmd.updates) {
      const existing = idMap.get(u.id)
      if (existing) {
        Object.assign(existing, u)
      }
    }
    docs = Array.from(idMap.values())
    changed = true
  }
  if (cmd.adds && cmd.adds.length) {
    docs.push(...cmd.adds)
    changed = true
  }
  if (changed) buildIndex(docs)
}

function handleDispose() {
  fuse = null
  docs = []
}

self.onmessage = (e: MessageEvent<SearchWorkerCommand>) => {
  const data = e.data
  try {
    switch (data.type) {
      case 'init':
        handleInit(data)
        break
      case 'query':
        handleQuery(data)
        break
      case 'applyPatch':
        handlePatch(data)
        break
      case 'dispose':
        handleDispose()
        break
      default:
        post({ type: 'error', message: 'Unknown command type' })
    }
  } catch (err) {
    const message = (err as Error).message || 'Unknown error'
    const reqId = data.type === 'query' ? data.reqId : undefined
    post({ type: 'error', message, reqId })
  }
}

post({ type: 'ready' })
/**
 * 搜索 Worker（Fuse 索引构建与查询）
 *
 * 职责：
 * - 在独立线程构建/维护 Fuse 索引，避免阻塞主线程；
 * - 接收 `init/query/applyPatch/dispose` 命令并返回结果/错误事件；
 * - 对输入文档做最小化整形，统一字段命名与大小写；
 * - 保持无副作用的状态更新（仅内存索引与文档映射）。
 */
