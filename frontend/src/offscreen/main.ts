/// <reference lib="webworker" />

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import type { SearchResult } from '@/infrastructure/indexeddb/manager'
import type { WorkerDoc } from '@/types/domain/query'

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
 * 等待 Worker 就绪
 * 
 * 使用事件机制监听 Worker 状态，避免固定轮询间隔
 *
 * @param timeout 超时时间（毫秒）
 */
async function waitForWorkerReady(timeout = 3000): Promise<void> {
  // 已就绪，立即返回
  if (searchState.ready && searchState.worker) {
    return
  }

  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now()
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    let intervalTimer: ReturnType<typeof setInterval> | null = null
    let messageHandler: ((event: MessageEvent) => void) | null = null

    // 清理所有资源
    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
      if (intervalTimer) {
        clearInterval(intervalTimer)
        intervalTimer = null
      }
      if (messageHandler && searchState.worker) {
        searchState.worker.removeEventListener('message', messageHandler)
        messageHandler = null
      }
    }

    // 检查就绪状态
    const checkReady = () => {
      if (searchState.ready && searchState.worker) {
        cleanup()
        resolve()
        return true
      }

      // 检查超时
      if (Date.now() - startTime > timeout) {
        cleanup()
        reject(new Error('等待查询 Worker 超时'))
        return true
      }

      return false
    }

    // 立即检查
    if (checkReady()) {
      return
    }

    // 设置超时
    timeoutTimer = setTimeout(() => {
      if (!checkReady()) {
        cleanup()
        reject(new Error('等待查询 Worker 超时'))
      }
    }, timeout)

    // 监听 Worker 消息事件
    if (searchState.worker) {
      messageHandler = (event: MessageEvent) => {
        const message = event.data
        if (message?.type === 'ready' || message?.type === 'inited') {
          checkReady()
        }
      }

      searchState.worker.addEventListener('message', messageHandler)

      // 定期检查（降级方案）
      intervalTimer = setInterval(() => {
        checkReady()
      }, 200)
    } else {
      // Worker 不存在，使用轮询
      intervalTimer = setInterval(() => {
        checkReady()
      }, 200)
    }
  })
}

/**
 * 确保查询 Worker 已就绪
 * 
 * 若未创建则启动并等待 ready 事件
 */
async function ensureSearchWorker(): Promise<Worker> {
  if (searchState.ready && searchState.worker) {
    return searchState.worker
  }

  if (searchState.initializing) {
    // 等待 Worker 就绪
    await waitForWorkerReady(3000)
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

/**
 * 处理搜索初始化请求
 */
async function handleSearchInit(payload: { docs?: WorkerDoc[] } | undefined) {
  const worker = await ensureSearchWorker()
  await primeWorkerDocs(worker, payload?.docs)
  return { ok: true }
}

/**
 * 处理搜索查询请求
 * 
 * 优先使用 Worker 查询，失败时降级到 IndexedDB 直接查询
 */
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

/**
 * Offscreen 任务处理函数类型
 */
type OffscreenHandler = (payload: unknown) => Promise<unknown>

/**
 * Offscreen 任务处理器映射
 */
const handlers: Record<string, OffscreenHandler> = {
  PARSE_HTML: async payload => {
    const { parseHtml } = await import('./tasks/parser')
    const data = payload as { html?: string }
    return parseHtml(data?.html ?? '')
  },
  SEARCH_INIT: payload =>
    handleSearchInit(payload as { docs?: WorkerDoc[] } | undefined),
  SEARCH_QUERY: async payload =>
    handleSearchQuery(payload as { query: string; limit?: number }),

  // Embedding 任务：在 Offscreen Document 里运行 ONNX，绕过扩展页面的 CSP 限制
  EMBEDDING_EMBED: async payload => {
    const { onnxEmbeddingProviderDirect } = await import(
      '@/infrastructure/embedding/onnx-embedding-provider-direct'
    )
    const data = payload as { text: string }
    return onnxEmbeddingProviderDirect.embed(data.text)
  },
  EMBEDDING_EMBED_BATCH: async payload => {
    const { onnxEmbeddingProviderDirect } = await import(
      '@/infrastructure/embedding/onnx-embedding-provider-direct'
    )
    const data = payload as { texts: string[] }
    return onnxEmbeddingProviderDirect.embedBatch!(data.texts)
  },
  EMBEDDING_IS_AVAILABLE: async () => {
    const { onnxEmbeddingProviderDirect } = await import(
      '@/infrastructure/embedding/onnx-embedding-provider-direct'
    )
    return onnxEmbeddingProviderDirect.isAvailable()
  },

  // 语义搜索：在 Offscreen 里完成 embed + 向量相似度计算，供 background/omnibox 调用
  SEMANTIC_SEARCH: async payload => {
    const { onnxEmbeddingProviderDirect } = await import(
      '@/infrastructure/embedding/onnx-embedding-provider-direct'
    )
    const { localVectorStore } = await import(
      '@/infrastructure/embedding/local-vector-store'
    )
    const data = payload as { query: string; topK?: number; minScore?: number }
    const queryVector = await onnxEmbeddingProviderDirect.embed(data.query.trim())
    return localVectorStore.search(queryVector, data.topK ?? 10, data.minScore ?? 0.3)
  }
}

/**
 * 监听来自 Background Script 的消息
 * 
 * Offscreen Document 通过消息机制接收任务请求
 */
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

/**
 * 初始化 Worker 文档索引
 * 
 * 从 IndexedDB 加载书签数据并发送给 Worker 建立索引
 */
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

/**
 * 从 IndexedDB 收集文档数据
 * 
 * 将书签数据转换为 Worker 所需的文档格式
 */
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
