/**
 * LLM 统一适配器
 *
 * 简化策略：
 * - 主要使用 Cloudflare Workers AI（性能好、覆盖率高、免费）
 * - Chrome Built-in LLM 仅作为紧急 fallback（极少使用）
 */
import type {
  LLMProvider,
  LLMTask,
  LLMCompleteOptions,
  LLMCompleteResult,
  LLMEmbeddingResult,
  LLMCapability
} from '@/types/infrastructure/llm'
import { builtInLLMClient } from './builtin-llm-client'
import { backendLLMClient } from './backend-llm-client'
import { logger } from '@/infrastructure/logging/logger'

/**
 * LLM 适配器
 */
export class LLMAdapter {
  private readonly loggerPrefix = 'LLMAdapter'
  private cachedCapabilities: LLMCapability[] | null = null

  constructor() {
    // 简化：不再需要策略选择，永远优先使用 Cloudflare
  }

  /**
   * 检测所有可用的 LLM 提供者
   */
  async detectCapabilities(): Promise<LLMCapability[]> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities
    }

    const capabilities: LLMCapability[] = []

    // 1. 检测 Chrome 内置 LLM
    const builtinCapability = await builtInLLMClient.detectCapability()
    capabilities.push(builtinCapability)

    // 2. 后端 LLM（始终可用，作为降级方案）
    const backendAvailable = await backendLLMClient.isAvailable()
    capabilities.push({
      available: backendAvailable,
      provider: 'cloudflare',
      reason: backendAvailable ? undefined : '后端服务不可用',
      features: {
        textCompletion: true,
        embedding: true,
        maxTokens: 4096,
        streaming: false
      }
    })

    this.cachedCapabilities = capabilities
    return capabilities
  }

  /**
   * 选择 LLM 提供者
   *
   * 简化策略：永远使用 Cloudflare（性能更好、覆盖率 100%、免费额度充足）
   * Built-in 仅在 Cloudflare 完全不可用时作为紧急 fallback
   */
  async selectProvider(_task: LLMTask): Promise<LLMProvider> {
    // 简化：直接返回 cloudflare
    // Chrome Built-in LLM 存在以下问题：
    // 1. Token 限制严重（2048 tokens，每批只能处理 10-20 个书签）
    // 2. 用户覆盖率低（需要手动激活，预计 < 5% 用户可用）
    // 3. 性能较差（处理时间是 Cloudflare 的 5-10 倍）
    // 4. 准确率一般（75-85% vs Cloudflare 的 80-90%）
    return 'cloudflare'
  }

  /**
   * 统一的文本补全接口
   */
  async complete(
    prompt: string,
    options?: LLMCompleteOptions
  ): Promise<LLMCompleteResult> {
    const task: LLMTask = {
      type: 'categorize',
      complexity: prompt.length < 500 ? 'simple' : 'complex',
      dataSize: prompt.length
    }

    const provider = await this.selectProvider(task)

    if (import.meta.env.DEV) {
      logger.info(this.loggerPrefix, '使用 LLM 提供者', { provider })
    }

    try {
      // 主要使用 Cloudflare
      return await backendLLMClient.complete(prompt, options)
    } catch (error) {
      // 极端情况 fallback：Cloudflare 失败时尝试 Built-in
      logger.warn(
        this.loggerPrefix,
        '⚠️ Cloudflare LLM 失败，尝试降级到内置 LLM（功能受限）',
        error
      )

      try {
        const builtinAvailable = await builtInLLMClient.isAvailable()
        if (builtinAvailable) {
          return await builtInLLMClient.complete(prompt, options)
        }
      } catch (fallbackError) {
        logger.error(this.loggerPrefix, '内置 LLM 也失败', fallbackError)
      }

      // 两者都失败，抛出原始错误
      throw error
    }
  }

  /**
   * 生成向量嵌入
   * 注意：Chrome 内置 LLM 不支持 embedding，总是使用后端
   */
  async generateEmbedding(text: string): Promise<LLMEmbeddingResult> {
    return await backendLLMClient.generateEmbedding(text)
  }

  /**
   * 检查 Chrome 内置 LLM 是否可用
   */
  async isBuiltInLLMAvailable(): Promise<boolean> {
    return await builtInLLMClient.isAvailable()
  }

  /**
   * 获取 Chrome 内置 LLM 启用指南
   */
  getBuiltInLLMGuide() {
    return builtInLLMClient.getEnableGuide()
  }

  /**
   * 获取 Chrome Built-in LLM 启用指南
   *
   * 注意：虽然我们主推 Cloudflare，但保留此方法供高级用户参考
   */
}

/**
 * 单例实例
 */
export const llmAdapter = new LLMAdapter()
