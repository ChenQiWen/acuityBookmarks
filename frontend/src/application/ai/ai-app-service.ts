/**
 * AI 应用服务
 *
 * 提供高级 AI 功能：
 * - 书签摘要
 * - 语义搜索增强
 * - 标签生成
 * 
 * 注意：书签分类功能已迁移到基于向量的本地推荐（folderVectorService）
 */
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import {
  createSummarizePrompt,
  createSemanticSearchPrompt,
  createTagGenerationPrompt
} from '@/core/ai/prompts'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签摘要结果
 */
export interface BookmarkSummaryResult {
  /** 摘要文本 */
  summary: string
  /** 使用的 LLM 提供者 */
  provider: 'builtin' | 'cloudflare' | 'openai' | 'claude' | 'gemini'
}

/**
 * AI 应用服务
 */
export class AIAppService {
  private readonly loggerPrefix = 'AIAppService'

  /**
   * 生成书签摘要
   */
  async summarizeBookmark(bookmark: {
    title: string
    url: string
    content?: string
  }): Promise<BookmarkSummaryResult> {
    const prompt = createSummarizePrompt(bookmark)

    try {
      const result = await llmAdapter.complete(prompt, {
        maxTokens: 100,
        temperature: 0.5
      })

      return {
        summary: result.text.trim(),
        provider:
          result.provider === 'builtin' || result.provider === 'cloudflare'
            ? result.provider
            : result.provider === 'openai' || result.provider === 'claude' || result.provider === 'gemini'
              ? result.provider
              : 'cloudflare'
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '书签摘要生成失败', { error, bookmark })
      throw new Error(`书签摘要生成失败: ${String(error)}`)
    }
  }

  /**
   * 语义搜索增强
   *
   * 理解用户搜索意图，提取关键词和概念
   */
  async enhanceSemanticSearch(query: string): Promise<{
    keywords: string[]
    concepts: string[]
    synonyms: string[]
  }> {
    const prompt = createSemanticSearchPrompt(query)

    try {
      const result = await llmAdapter.complete(prompt, {
        maxTokens: 200,
        temperature: 0.4
      })

      // 尝试解析 JSON
      try {
        const parsed = JSON.parse(result.text)
        return {
          keywords: parsed.keywords || [],
          concepts: parsed.concepts || [],
          synonyms: parsed.synonyms || []
        }
      } catch {
        // JSON 解析失败，返回默认值
        return {
          keywords: query.split(/\s+/),
          concepts: [],
          synonyms: []
        }
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '语义搜索增强失败', { error, query })
      // 降级：返回原始查询的关键词
      return {
        keywords: query.split(/\s+/),
        concepts: [],
        synonyms: []
      }
    }
  }

  /**
   * 生成书签标签
   */
  async generateTags(bookmark: {
    title: string
    url: string
    content?: string
  }): Promise<string[]> {
    const prompt = createTagGenerationPrompt(bookmark)

    try {
      const result = await llmAdapter.complete(prompt, {
        maxTokens: 50,
        temperature: 0.5
      })

      // 尝试解析 JSON 数组
      try {
        const parsed = JSON.parse(result.text)
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (tag): tag is string =>
              typeof tag === 'string' && tag.trim().length > 0
          )
        }
      } catch {
        // JSON 解析失败，尝试提取标签
        const tags =
          result.text
            .match(/\[(.*?)\]/)?.[1]
            ?.split(',')
            .map(tag => tag.trim().replace(/['"]/g, ''))
            .filter(Boolean) || []

        return tags
      }

      return []
    } catch (error) {
      logger.error(this.loggerPrefix, '标签生成失败', { error, bookmark })
      return []
    }
  }

  /**
   * 检测可用 LLM 提供者
   */
  async detectCapabilities() {
    return await llmAdapter.detectCapabilities()
  }

  /**
   * 获取 Chrome 内置 LLM 启用指南
   */
  getBuiltInLLMGuide() {
    return llmAdapter.getBuiltInLLMGuide()
  }
}

/**
 * 单例实例
 */
export const aiAppService = new AIAppService()
