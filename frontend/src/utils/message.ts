import { logger } from './logger'

/**
 * 消息通信工具（面向前端页面与 Service Worker）
 *
 * 目标：
 * - 统一向后台发送消息的方式；
 * - 提供可配置的超时控制与指数退避重试；
 * - 兼容 Chrome 扩展运行时的异常场景（如 SW 未激活、上下文不可用）。
 *
 * 使用示例：
 * ```ts
 * await sendMessageToBackend({ type: 'GET_STATS' }, { timeoutMs: 3000, retries: 2 })
 * ```
 */

/**
 * 发送消息的可选配置
 * - timeoutMs: 单次发送的超时时间（毫秒）
 * - retries: 失败后重试次数（不含首次）
 * - backoffMs: 退避的基础毫秒数（指数增长：base * 2^attempt）
 */
interface MessageOptions {
  timeoutMs?: number
  retries?: number
  backoffMs?: number
}

/**
 * 等待指定毫秒（用于重试退避）
 */
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 在指定超时内发送消息。
 *
 * - 若扩展运行时不可用（例如 Service Worker 尚未就绪），将直接抛错；
 * - 若超时未收到响应，返回超时错误；
 * - 若后台抛错，通过 `chrome.runtime.lastError` 捕获并返回。
 */
function sendWithTimeout(
  message: unknown,
  timeoutMs: number
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!chrome.runtime?.id) {
      logger.warn(
        'Messaging',
        'Cannot send message: extension context not available.'
      )
      return reject(new Error('Extension context not available'))
    }

    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      const err = new Error(`Message timeout after ${timeoutMs}ms`)
      logger.warn('Messaging', err.message)
      reject(err)
    }, timeoutMs)

    try {
      chrome.runtime.sendMessage(message, response => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (chrome.runtime.lastError) {
          logger.error(
            'Messaging',
            'Error sending message:',
            chrome.runtime.lastError.message
          )
          return reject(chrome.runtime.lastError)
        }
        resolve(response)
      })
    } catch (err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    }
  })
}

/**
 * 向后台脚本发送消息并返回响应（带超时与重试）。
 * @param message 要发送的消息对象（任意可序列化内容）。
 * @param options 可选的超时与重试配置。
 * @returns 后台返回的响应；在所有重试失败后抛出最后一次错误。
 */
export async function sendMessageToBackend(
  message: unknown,
  options: MessageOptions = {}
): Promise<unknown> {
  const { timeoutMs = 4000, retries = 2, backoffMs = 300 } = options

  let attempt = 0
  let lastError: unknown
  while (attempt <= retries) {
    try {
      return await sendWithTimeout(message, timeoutMs)
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        const waitMs = backoffMs * Math.pow(2, attempt)
        logger.warn(
          'Messaging',
          `Retrying message (attempt ${attempt + 1}/${retries}) after ${waitMs}ms`,
          (err as Error)?.message || err
        )
        await wait(waitMs)
      }
      attempt++
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * 分页获取所有书签（通过 Service Worker 路由 `get-bookmarks-paged`）。
 */
export async function getBookmarksPaged(
  limit?: number,
  offset?: number,
  options: MessageOptions = {}
): Promise<{ ok: boolean; value?: unknown; error?: string }> {
  const resp = (await sendMessageToBackend(
    {
      type: 'get-bookmarks-paged',
      data: { limit, offset }
    },
    options
  )) as { ok: boolean; value?: unknown; error?: string }
  return resp
}

/**
 * 分页获取子书签（通过 Service Worker 路由 `get-children-paged`）。
 */
export async function getChildrenPaged(
  parentId: string,
  limit?: number,
  offset?: number,
  options: MessageOptions = {}
): Promise<{ ok: boolean; value?: unknown; error?: string }> {
  const resp = (await sendMessageToBackend(
    {
      type: 'get-children-paged',
      data: { parentId, limit, offset }
    },
    options
  )) as { ok: boolean; value?: unknown; error?: string }
  return resp
}
