/**
 * 通过 Background Script 代理 API 请求
 *
 * 用途：绕过 Chrome Extension 的 CSP 限制
 * Background Script 不受 CSP 限制，可以自由访问任何 HTTP/HTTPS 端点
 *
 * @param url - API 端点 URL
 * @param options - 请求选项
 * @returns Promise<Response 数据>
 */
export async function proxyApiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    // 🔒 强制 HTTPS：如果检测到本地 HTTP 地址，自动转换为 HTTPS
    // 这是最后一层保护，确保即使构建时环境变量读取错误，也能使用 HTTPS
    if (
      url.startsWith('http://127.0.0.1:8787') ||
      url.startsWith('http://localhost:8787')
    ) {
      url = url.replace('http://', 'https://')
      console.warn('⚠️ 检测到 HTTP 地址，已强制转换为 HTTPS:', url)
    }

    // 处理 headers：如果是 Headers 对象，转换为普通对象
    let headers: Record<string, string> = {}
    if (options.headers) {
      if (options.headers instanceof Headers) {
        headers = Object.fromEntries(options.headers.entries())
      } else if (Array.isArray(options.headers)) {
        headers = Object.fromEntries(options.headers)
      } else {
        headers = options.headers as Record<string, string>
      }
    }

    const response = await new Promise<{
      success: boolean
      status: number
      statusText: string
      data: T
      error?: string
    }>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'PROXY_API_REQUEST',
          data: {
            url,
            method: options.method || 'GET',
            headers,
            body: options.body
          }
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(
              response as {
                success: boolean
                status: number
                statusText: string
                data: T
                error?: string
              }
            )
          }
        }
      )
    })

    if (!response.success) {
      throw new Error(response.error || '请求失败')
    }

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.data
  } catch (error) {
    console.error('代理 API 请求失败:', error)
    return null
  }
}
