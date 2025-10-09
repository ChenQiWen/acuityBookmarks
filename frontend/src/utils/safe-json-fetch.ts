import { apiClient } from '@/utils/api-client'

/**
 * 统一 JSON 获取工具，封装 apiClient 并提供双调用姿势兼容：
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
    const resp = await apiClient(url, init)
    return (await resp.json()) as R
  } catch {
    return null
  }
}
