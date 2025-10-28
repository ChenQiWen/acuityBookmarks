/// <reference lib="webworker" />

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import type { SearchResult } from '@/infrastructure/indexeddb/manager'
import type { WorkerDoc } from '@/workers/query-worker-types'

interface SearchState {
  worker?: Worker
  ready: boolean
  initializing: boolean
  primed: boolean
  docCount: number
}

const searchState: SearchState = {
  worker: undefined,
  ready: false,
  initializing: false,
  primed: false,
  docCount: 0
}

/**
 * 轮询等待直到条件满足或超时。
 *
 * @param predicate 判定函数
 * @param timeout 超时时间，毫秒
 */
async function waitUntil(
  predicate: () => boolean,
  timeout = 3000
): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('等待查询 Worker 超时')
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

/**
 * 确保查询 Worker 已就绪，若未创建则启动并等待 ready 事件。
 */
async function ensureSearchWorker(): Promise<Worker> {
  if (searchState.ready && searchState.worker) {
    return searchState.worker
  }

  if (searchState.initializing) {
    await waitUntil(() => searchState.ready && !!searchState.worker)
    if (!searchState.worker) {
      throw new Error('查询 Worker 初始化失败')
    }
    return searchState.worker
  }

  searchState.initializing = true
  try {
    const worker = new Worker(
      new URL('@/workers/query-worker.ts', import.meta.url),
      { type: 'module' }
    )

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('查询 Worker 启动超时'))
      }, 5000)

      const handleReady = (event: MessageEvent) => {
        const message = event.data
        if (message?.type === 'ready' || message?.type === 'inited') {
          clearTimeout(timer)
          worker.removeEventListener('message', handleReady)
          resolve()
        }
      }

      worker.addEventListener('message', handleReady)
      worker.onerror = error => {
        clearTimeout(timer)
        worker.removeEventListener('message', handleReady)
        reject(error)
      }
    })

    searchState.worker = worker
    searchState.ready = true
    return worker
  } catch (error) {
    logger.error('OffscreenSearch', '创建查询 Worker 失败', error)
    searchState.worker = undefined
    searchState.ready = false
    throw error
  } finally {
    searchState.initializing = false
  }
}

async function handleSearchInit(payload: { docs?: WorkerDoc[] } | undefined) {
  const worker = await ensureSearchWorker()
  await primeWorkerDocs(worker, payload?.docs)
  return { ok: true }
}

async function handleSearchQuery(payload: { query: string; limit?: number }) {
  const query = payload?.query?.trim()
  if (!query) return []

  try {
    const worker = await ensureSearchWorker()
    await primeWorkerDocs(worker)

    return await new Promise<SearchResult[]>((resolve, reject) => {
      const reqId = Date.now()
      const timer = setTimeout(() => {
        reject(new Error('Offscreen Worker 查询超时'))
      }, 5000)

      const cleanup = () => {
        clearTimeout(timer)
        worker.removeEventListener('message', listener as EventListener)
      }

      const listener = (event: MessageEvent) => {
        const message = event.data
        if (message?.type === 'result' && message.reqId === reqId) {
          cleanup()
          logger.info(
            'OffscreenSearch',
            `🔍 命中 ${message.hits?.length ?? 0} 条`
          )
          resolve(message.hits ?? [])
        } else if (message?.type === 'error' && message.reqId === reqId) {
          cleanup()
          reject(new Error(message.message ?? 'Worker 查询失败'))
        }
      }

      worker.addEventListener('message', listener as EventListener)

      worker.postMessage({
        type: 'query',
        q: query,
        reqId,
        limit: payload?.limit ?? 50
      })
    })
  } catch (error) {
    logger.warn(
      'OffscreenSearch',
      'Worker 不可用，回退到 IndexedDB 查询',
      error
    )
    return indexedDBManager.searchBookmarks(query, {
      query,
      limit: payload?.limit ?? 50,
      includeDomain: true,
      includeKeywords: true,
      includeTags: true,
      includeUrl: true
    })
  }
}

type OffscreenHandler = (payload: unknown) => Promise<unknown>

const handlers: Record<string, OffscreenHandler> = {
  PARSE_HTML: async payload => {
    const { parseHtml } = await import('./tasks/parser')
    const data = payload as { html?: string }
    return parseHtml(data?.html ?? '')
  },
  SEARCH_INIT: payload =>
    handleSearchInit(payload as { docs?: WorkerDoc[] } | undefined),
  SEARCH_QUERY: async payload =>
    handleSearchQuery(payload as { query: string; limit?: number })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.__offscreenRequest__) return false

  const handler = handlers[message.type]
  ;(async () => {
    try {
      if (!handler) {
        sendResponse({ ok: false, error: `Unsupported task: ${message.type}` })
        return
      }
      const result = await handler(message.payload)
      sendResponse({ ok: true, result })
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  })()

  return true
})

async function primeWorkerDocs(worker: Worker, docsFromPayload?: WorkerDoc[]) {
  if (searchState.primed && !docsFromPayload) {
    return
  }

  const docs = docsFromPayload ?? (await collectDocsFromIDB())
  worker.postMessage({ type: 'init', docs })
  searchState.docCount = docs.length
  searchState.primed = docs.length > 0
  logger.info('OffscreenSearch', `索引文档数量: ${searchState.docCount}`)
}

async function collectDocsFromIDB(): Promise<WorkerDoc[]> {
  await indexedDBManager.initialize()
  const bookmarks = await indexedDBManager.getAllBookmarks()
  return bookmarks
    .filter(record => !record.isFolder)
    .map(record => ({
      id: String(record.id),
      titleLower: record.titleLower,
      urlLower: record.urlLower,
      domain: record.domain,
      keywords: record.keywords,
      isFolder: record.isFolder
    }))
}

export {}
