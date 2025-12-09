/**
 * Offscreen Document 管理器
 *
 * 职责：
 * - 管理 Chrome Offscreen Document 的生命周期
 * - 提供与 Offscreen Document 通信的统一接口
 * - 处理 DOM 解析等需要 DOM 环境的任务
 *
 * 架构说明：
 * - Service Worker 无法直接访问 DOM
 * - 通过 Offscreen Document 提供 DOM 解析能力
 * - 使用消息传递与 Offscreen Document 通信
 */

import { logger } from '@/infrastructure/logging/logger'

export type OffscreenReason = 'DOM_SCRAPING' | 'WEB_WORKER' | 'TESTING'
export type OffscreenTaskType = 'PARSE_HTML' | 'SEARCH_QUERY' | 'SEARCH_INIT'

interface OffscreenRequest<TPayload = unknown> {
  type: OffscreenTaskType
  payload?: TPayload
}

interface OffscreenResponse<TResult = unknown> {
  ok: boolean
  result?: TResult
  error?: string
}

/** Offscreen 页面路径 */
const OFFSCREEN_URL = 'offscreen.html'
const DEFAULT_TIMEOUT = 5000

let ensuringDocument: Promise<boolean> | null = null
let requestCounter = 1

function createError(message: string, cause?: unknown): Error {
  if (cause instanceof Error) {
    const err = new Error(message)
    err.stack = cause.stack
    return err
  }
  return new Error(message)
}

export async function ensureOffscreenDocument(
  reason: OffscreenReason = 'DOM_SCRAPING'
): Promise<boolean> {
  if (!chrome.offscreen?.createDocument) {
    logger.warn(
      'OffscreenManager',
      '当前环境不支持 chrome.offscreen API，无法创建 Offscreen Document'
    )
    return false
  }

  try {
    if (typeof chrome.offscreen.hasDocument === 'function') {
      const hasDoc = await chrome.offscreen.hasDocument()
      if (hasDoc) return true
    }
  } catch (error) {
    logger.debug('OffscreenManager', '检测 Offscreen 文档失败', error)
  }

  if (!ensuringDocument) {
    ensuringDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['DOM_SCRAPING'],
        justification: `AcuityBookmarks needs to perform ${reason} tasks in the background.`
      })
      .then(() => {
        logger.info(
          'OffscreenManager',
          `✅ Offscreen Document 已创建，原因: ${reason}`
        )
        return true
      })
      .catch(error => {
        logger.error(
          'OffscreenManager',
          '❌ 无法创建 Offscreen Document',
          error
        )
        return false
      })
      .finally(() => {
        ensuringDocument = null
      })
  }

  return ensuringDocument
}

export async function dispatchOffscreenRequest<
  TResult = unknown,
  TPayload = unknown
>(
  request: OffscreenRequest<TPayload>,
  options: { timeout?: number } = {}
): Promise<TResult> {
  const reason: OffscreenReason =
    request.type === 'PARSE_HTML' ? 'DOM_SCRAPING' : 'WEB_WORKER'
  const ready = await ensureOffscreenDocument(reason)
  if (!ready) {
    throw createError('Offscreen Document 不可用')
  }

  const reqId = requestCounter++
  const timeout = options.timeout ?? DEFAULT_TIMEOUT

  return new Promise<TResult>((resolve, reject) => {
    const requestType = (request.type ?? 'unknown') as OffscreenTaskType

    const payload = {
      __offscreenRequest__: true,
      reqId,
      type: requestType,
      payload: request.payload
    }

    const timer = setTimeout(() => {
      reject(createError(`Offscreen 请求超时 (${requestType})`))
    }, timeout)

    const MAX_RETRY = 3
    let retryCount = 0

    const send = () => {
      chrome.runtime.sendMessage(
        payload,
        (response?: OffscreenResponse<TResult>) => {
          const lastError = chrome.runtime.lastError
          if (lastError) {
            const message = lastError.message ?? ''
            if (
              message.includes('Receiving end does not exist') &&
              retryCount < MAX_RETRY
            ) {
              retryCount += 1
              // ✅ 使用指数退避策略，而非固定延迟
              const baseDelay = 50 // 基础延迟（毫秒）
              const retryDelay = Math.min(
                baseDelay * Math.pow(2, retryCount - 1),
                1000 // 最大延迟1秒
              )
              setTimeout(send, retryDelay)
              return
            }
            clearTimeout(timer)
            reject(createError(message || 'Offscreen 返回失败'))
            return
          }

          if (!response) {
            clearTimeout(timer)
            reject(createError('Offscreen 响应为空'))
            return
          }

          clearTimeout(timer)
          if (response.ok) {
            resolve(response.result as TResult)
          } else {
            reject(createError(response.error || 'Offscreen 返回失败'))
          }
        }
      )
    }

    send()
  })
}

export async function disposeOffscreenDocument(): Promise<void> {
  try {
    if (chrome.offscreen?.closeDocument) {
      await chrome.offscreen.closeDocument()
      logger.info('OffscreenManager', '🧹 Offscreen Document 已关闭')
    }
  } catch (error) {
    logger.warn('OffscreenManager', '关闭 Offscreen Document 失败', error)
  }
}

export const OffscreenManager = {
  ensureOffscreenDocument,
  dispatchOffscreenRequest,
  disposeOffscreenDocument
}

export type { OffscreenRequest, OffscreenResponse }
