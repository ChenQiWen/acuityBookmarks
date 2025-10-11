/**
 * 全局 API 客户端
 *
 * 职责与设计：
 * - 封装 `fetch` 并统一错误处理与用户提示；
 * - 优先解析后端返回的错误信息（message/error 字段），提升可读性；
 * - 通过全局 UI Store 显示错误通知，避免异常静默；
 * - 捕获网络层错误（例如连接拒绝、超时）并抛出，交由上层决定是否重试；
 * - 与 CSP 相容：不使用动态脚本或不安全构造；
 * - 纯工具职责：不持久化状态，便于在任意上下文复用。
 */

import { useUIStore } from '@/stores/ui-store'

// 在模块顶层获取 store 实例
// Pinia store 必须在 app 创建后才能在组件外使用，
// 但这里我们在模块加载时获取它，假设 Pinia 已经初始化。
// 如果出现问题，可能需要延迟实例化。
let uiStore: ReturnType<typeof useUIStore> | null = null

function getUIStore() {
  if (!uiStore) {
    uiStore = useUIStore()
  }
  return uiStore
}

/**
 * 发起 HTTP 请求并统一处理错误。
 * @param url 请求的 URL
 * @param options fetch 的配置选项
 * @returns 返回一个 Promise，解析为 Response 对象
 */
export async function apiClient(
  url: string,
  options?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      // 尝试从后端响应中解析更详细的错误信息
      let errorMessage = `请求失败，状态码: ${response.status}`
      try {
        const errorData = await response.json()
        // 优先使用后端返回的 message 或 error 字段
        if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch (_e) {
        // 如果响应体不是 JSON 或解析失败，则忽略
      }

      // 使用 UI store 显示错误通知
      getUIStore().showError(errorMessage)

      // 抛出错误，以便调用处的 .catch() 逻辑可以继续处理
      throw new Error(errorMessage)
    }

    return response
  } catch (error) {
    // 这里主要捕获网络层面的错误，例如连接被拒绝 (ERR_CONNECTION_REFUSED)
    const networkErrorMessage =
      '无法连接到后端服务，请确保服务已启动并检查网络连接。'

    getUIStore().showError(networkErrorMessage)

    // 打印原始错误到控制台，方便调试
    console.error('API Client Network Error:', error)

    // 重新抛出错误，让上层调用知道请求失败了
    throw error
  }
}
