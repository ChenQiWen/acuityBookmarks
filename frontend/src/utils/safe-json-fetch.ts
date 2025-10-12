import { request } from '@/infrastructure/http/api-client'

/**
 * 统一 JSON 获取工具
 *
 * 设计：
 * - 封装 apiClient，支持多种调用姿势（见下）；
 * - 一律捕获网络/解析异常并返回 null，避免异常冒泡；
 * - 与 CSP 相容：不使用内联构造函数或动态脚本。
 *
 * 用法：
 * - safeJsonFetch(url, timeout)
 * - safeJsonFetch(url, init)
 * - safeJsonFetch(url, timeout, init)
 */
export async function safeJsonFetch<R = unknown>(
  url: string,
  a?: number | RequestInit,
  b?: RequestInit
): Promise<R | null> {
  try {
    let init: RequestInit | undefined
    if (typeof a === 'number') init = b
    else init = a
    const result = await request(url, init)
    if (!result.ok) return null
    return result.value.data as R
  } catch {
    return null
  }
}
