/// <reference lib="webworker" />
import Fuse from 'fuse.js'
import type {
  WorkerDoc,
  WorkerHit,
  SearchWorkerCommand,
  SearchWorkerEvent,
  WorkerInitOptions
} from '@/types/domain/query'

declare const self: DedicatedWorkerGlobalScope

/** Fuse.js 查询实例 */
let fuse: Fuse<WorkerDoc> | null = null
/** 当前索引的文档集合 */
let docs: WorkerDoc[] = []

/**
 * 向主线程发送消息
 */
function post(msg: SearchWorkerEvent) {
  self.postMessage(msg)
}

/**
 * 构建 Fuse.js 索引
 */
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

/**
 * 处理初始化命令
 */
function handleInit(cmd: Extract<SearchWorkerCommand, { type: 'init' }>) {
  docs = cmd.docs || []
  buildIndex(docs, cmd.options)
  post({ type: 'inited', docCount: docs.length })
}

/**
 * 处理查询命令
 */
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
    score:
      h.score === undefined ? 1 : Math.max(0, Math.min(1, 1 - (h.score ?? 0)))
  })) as WorkerHit[]
  post({ type: 'result', reqId: cmd.reqId, hits: top })
}

/**
 * 处理增量更新命令
 * 
 * 支持添加、更新、删除文档
 */
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

/**
 * 处理销毁命令
 * 
 * 清理索引和文档数据
 */
function handleDispose() {
  fuse = null
  docs = []
}

/**
 * 监听主线程消息
 */
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

// 通知主线程 Worker 已就绪
post({ type: 'ready' })
