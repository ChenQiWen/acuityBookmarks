import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import type { SearchResult } from '@/infrastructure/indexeddb/manager'
import type { WorkerDoc } from '@/workers/search-worker-types'

interface SearchState {
  worker?: Worker
  ready: boolean
  initializing: boolean
}

const searchState: SearchState = {
  worker: undefined,
  ready: false,
  initializing: false
}

async function ensureSearchWorker(): Promise<void> {
  if (searchState.ready) return
  if (searchState.initializing) {
    await waitUntil(() => searchState.ready, 100, 5000)
    return
  }

  searchState.initializing = true
  try {
    const worker = new Worker(
      new URL('@/workers/search-worker.ts', import.meta.url),
      {
        type: 'module'
      }
    )

    const readyPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('搜索 Worker 启动超时'))
      }, 5000)

      worker.onmessage = event => {
        const message = event.data
        if (message?.type === 'ready' || message?.type === 'inited') {
          clearTimeout(timer)
          searchState.ready = true
          resolve()
        }
      }

      worker.onerror = error => {
        clearTimeout(timer)
        reject(error)
      }
    })

    searchState.worker = worker
    await readyPromise
  } catch (error) {
    logger.error('OffscreenSearch', '创建搜索 Worker 失败', error)
    searchState.worker = undefined
    searchState.ready = false
    throw error
  } finally {
    searchState.initializing = false
  }
}

async function waitUntil(
  predicate: () => boolean,
  interval = 50,
  timeout = 3000
) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitUntil 超时')
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}

async function handleSearchInit(payload: { docs?: WorkerDoc[] } | undefined) {
  await ensureSearchWorker()
  await indexedDBManager.initialize()

  const worker = searchState.worker
  if (!worker) {
    throw new Error('搜索 Worker 不可用')
  }

  worker.postMessage({ type: 'init', docs: payload?.docs ?? [] })
  return { ok: true }
}

async function handleSearchQuery(payload: { query: string; limit?: number }) {
  const query = payload?.query?.trim()
  if (!query) return []

  try {
    await ensureSearchWorker()
  } catch (error) {
    logger.warn(
      'OffscreenSearch',
      'Worker 不可用，回退到 IndexedDB 搜索',
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

  const worker = searchState.worker
  if (!worker) {
    logger.error('OffscreenSearch', 'Worker 初始化异常，返回空结果')
    return []
  }

  return new Promise<SearchResult[]>((resolve, reject) => {
    const reqId = Date.now()
    const timer = setTimeout(() => {
      reject(new Error('Offscreen Worker 搜索超时'))
    }, 5000)

    const onMessage = (event: MessageEvent) => {
      const message = event.data
      if (message?.type === 'result' && message.reqId === reqId) {
        cleanup()
        resolve(message.hits ?? [])
      } else if (message?.type === 'error' && message.reqId === reqId) {
        cleanup()
        reject(new Error(message.message ?? 'Worker 搜索失败'))
      }
    }

    const cleanup = () => {
      clearTimeout(timer)
      worker.removeEventListener('message', onMessage as EventListener)
    }

    worker.addEventListener('message', onMessage as EventListener)

    worker.postMessage({
      type: 'query',
      q: query,
      reqId,
      limit: payload?.limit ?? 50
    })
  })
}

type OffscreenHandler = (payload: unknown) => Promise<unknown>

const handlers: Record<string, OffscreenHandler> = {
  PARSE_HTML: async payload => {
    const { parseHtml } = await import('./tasks/parser')
    const data = payload as { html?: string }
    return parseHtml(data?.html ?? '')
  },
  SEARCH_INIT: async payload => {
    const data = payload as { docs?: WorkerDoc[] } | undefined
    return handleSearchInit(data)
  },
  SEARCH_QUERY: async payload => {
    const data = payload as { query: string; limit?: number }
    return handleSearchQuery(data)
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.__offscreenRequest__) return

  const handler = handlers[msg.type]
  ;(async () => {
    try {
      if (!handler) {
        sendResponse({ ok: false, error: `Unsupported task: ${msg.type}` })
        return
      }
      const result = await handler(msg.payload)
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
