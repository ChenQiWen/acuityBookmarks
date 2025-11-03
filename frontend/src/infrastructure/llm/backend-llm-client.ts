/**
 * 后端 LLM 客户端
 *
 * 封装 Cloudflare Workers AI API 调用
 * 作为 Chrome 内置 LLM 的降级方案
 */
import type {
  LLMCompleteOptions,
  LLMCompleteResult,
  LLMEmbeddingResult
} from '@/types/infrastructure/llm'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 获取 API 基础 URL
 */
function getApiBaseUrl(): string {
  // 开发环境使用本地后端
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787'
  }
  // 生产环境使用线上 API
  return import.meta.env.VITE_API_BASE_URL || 'https://api.acuitybookmarks.com'
}

/**
 * 后端 LLM 客户端
 */
export class BackendLLMClient {
  private readonly loggerPrefix = 'BackendLLMClient'
  private readonly apiBaseUrl: string

  constructor(apiBaseUrl?: string) {
    this.apiBaseUrl = apiBaseUrl || getApiBaseUrl()
  }

  /**
   * 文本补全
   */
  async complete(
    prompt: string,
    options?: LLMCompleteOptions
  ): Promise<LLMCompleteResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/ai/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          max_tokens: options?.maxTokens || 256,
          temperature: options?.temperature || 0.6
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `后端 LLM API 错误: ${response.status} ${response.statusText} - ${
            errorData.error || '未知错误'
          }`
        )
      }

      const data = await response.json()

      return {
        text: data.text || data.response || data.message || '',
        provider: 'cloudflare',
        tokensUsed: data.tokens_used || data.tokensUsed
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '后端 LLM 补全失败', { error, prompt })
      throw new Error(`后端 LLM 补全失败: ${String(error)}`)
    }
  }

  /**
   * 生成向量嵌入
   */
  async generateEmbedding(text: string): Promise<LLMEmbeddingResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/ai/embedding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text.trim(),
          model: '@cf/baai/bge-m3' // 默认使用 Cloudflare Workers AI 模型
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `后端 Embedding API 错误: ${response.status} ${response.statusText} - ${
            errorData.error || '未知错误'
          }`
        )
      }

      const data = await response.json()

      // 提取向量数组
      const vector = Array.isArray(data.vector)
        ? data.vector
        : Array.isArray(data.embedding)
          ? data.embedding
          : Array.isArray(data.embeddings?.[0])
            ? data.embeddings[0]
            : []

      if (vector.length === 0) {
        throw new Error('后端返回的向量为空')
      }

      return {
        vector,
        provider: 'cloudflare',
        dimensions: vector.length
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '后端 Embedding 生成失败', {
        error,
        text
      })
      throw new Error(`后端 Embedding 生成失败: ${String(error)}`)
    }
  }

  /**
   * 检查后端 LLM 是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 秒超时
      })

      return response.ok
    } catch (error) {
      logger.warn(this.loggerPrefix, '后端 LLM 健康检查失败', error)
      return false
    }
  }
}

/**
 * 单例实例
 */
export const backendLLMClient = new BackendLLMClient()
