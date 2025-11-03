/**
 * AI 应用服务
 *
 * 提供高级 AI 功能：
 * - 书签分类
 * - 书签摘要
 * - 一键整理书签
 * - 语义搜索增强
 */
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import {
  createCategorizePrompt,
  createSummarizePrompt,
  createOrganizePrompt,
  createSemanticSearchPrompt,
  createTagGenerationPrompt
} from '@/core/ai/prompts'
import { logger } from '@/infrastructure/logging/logger'
import {
  validateCategoryResults,
  parseSimpleFormat,
  getValidationStats,
  type ValidatedCategoryResult
} from './llm-response-validator'

/**
 * 书签分类结果
 */
export interface BookmarkCategoryResult {
  /** 类别名称 */
  category: string
  /** 使用的 LLM 提供者 */
  provider: 'builtin' | 'cloudflare'
}

/**
 * 书签摘要结果
 */
export interface BookmarkSummaryResult {
  /** 摘要文本 */
  summary: string
  /** 使用的 LLM 提供者 */
  provider: 'builtin' | 'cloudflare'
}

/**
 * 书签整理结果
 */
export interface BookmarkOrganizeResult {
  /** 书签 ID */
  id: string
  /** 建议的类别 */
  category: string
  /** 建议的文件夹名称 */
  suggestedFolder: string
}

/**
 * AI 应用服务
 */
export class AIAppService {
  private readonly loggerPrefix = 'AIAppService'

  /**
   * 自动分类书签
   */
  async categorizeBookmark(bookmark: {
    title: string
    url: string
    description?: string
  }): Promise<BookmarkCategoryResult> {
    const prompt = createCategorizePrompt(bookmark)

    try {
      const result = await llmAdapter.complete(prompt, {
        maxTokens: 10,
        temperature: 0.3
      })

      const category = result.text.trim().replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '')

      return {
        category: category || '其他',
        provider:
          result.provider === 'builtin' || result.provider === 'cloudflare'
            ? result.provider
            : 'cloudflare'
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '书签分类失败', { error, bookmark })
      throw new Error(`书签分类失败: ${String(error)}`)
    }
  }

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
            : 'cloudflare'
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '书签摘要生成失败', { error, bookmark })
      throw new Error(`书签摘要生成失败: ${String(error)}`)
    }
  }

  /**
   * 一键整理书签栏
   *
   * 批量处理书签，为每个书签建议合适的文件夹分类
   *
   * 注意：
   * - 只发送书签的标题、URL 和元数据给 LLM（用于分类判断）
   * - LLM 只需要返回分类结果（id -> category 映射）
   * - 完整的书签数据在前端保留，只根据分类结果调整层级结构
   */
  async organizeBookmarks(
    bookmarks: Array<{
      id: string
      title: string
      url: string
      // 可选：元数据（如果有，会提高分类准确率）
      metaTitle?: string
      metaDescription?: string
      metaKeywords?: string[]
    }>
  ): Promise<BookmarkOrganizeResult[]> {
    if (bookmarks.length === 0) {
      return []
    }

    // 如果只有一个书签，使用单个分类
    if (bookmarks.length === 1) {
      const bookmark = bookmarks[0]
      const categoryResult = await this.categorizeBookmark(bookmark)

      return [
        {
          id: bookmark.id,
          category: categoryResult.category,
          suggestedFolder: categoryResult.category
        }
      ]
    }

    // 批量处理：根据书签数量动态调整批次大小
    // 如果书签数量 <= 50，一次性处理；否则分批处理（每批 50 个）
    // 注意：只发送标题和 URL，不发送完整的 BookmarkRecord 数据
    const batchSize = bookmarks.length <= 50 ? bookmarks.length : 50
    const results: BookmarkOrganizeResult[] = []

    for (let i = 0; i < bookmarks.length; i += batchSize) {
      const batch = bookmarks.slice(i, i + batchSize)
      const prompt = createOrganizePrompt(batch)

      try {
        const result = await llmAdapter.complete(prompt, {
          maxTokens: batch.length * 30 + 500, // 预留更多 token 用于 JSON 格式
          temperature: 0.3
        })

        // ✅ 使用增强的验证器解析和验证 JSON 结果
        const expectedIds = batch.map(b => b.id)
        let validatedResults = validateCategoryResults(result.text, expectedIds)

        // 如果验证失败或结果不完整，尝试简单格式解析
        if (validatedResults.length === 0) {
          logger.warn(this.loggerPrefix, 'JSON 验证失败，尝试简单格式解析')
          validatedResults = parseSimpleFormat(result.text, batch)
        }

        // 记录验证统计
        const stats = getValidationStats(validatedResults, batch.length)
        logger.info(this.loggerPrefix, 'LLM 响应验证统计', stats)

        // 将验证结果添加到最终结果中
        for (const validated of validatedResults) {
          results.push({
            id: validated.id,
            category: validated.category,
            suggestedFolder: validated.category
          })
        }

        // 处理缺失的书签（LLM 没有返回的）
        const returnedIds = new Set(
          validatedResults.map((r: ValidatedCategoryResult) => r.id)
        )
        const missingBookmarks = batch.filter(b => !returnedIds.has(b.id))

        if (missingBookmarks.length > 0) {
          logger.warn(
            this.loggerPrefix,
            `${missingBookmarks.length} 个书签缺少分类结果，使用单个分类`
          )

          // 对缺失的书签使用单个分类
          for (const bookmark of missingBookmarks) {
            try {
              const categoryResult = await this.categorizeBookmark(bookmark)
              results.push({
                id: bookmark.id,
                category: categoryResult.category,
                suggestedFolder: categoryResult.category
              })
            } catch (_err) {
              // 单个分类也失败，使用默认值
              results.push({
                id: bookmark.id,
                category: '其他',
                suggestedFolder: '其他'
              })
            }
          }
        }

        // 添加延迟，避免请求过快
        if (i + batchSize < bookmarks.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        logger.warn(this.loggerPrefix, '批量整理失败，降级到单个处理', {
          error,
          batch
        })

        // 批量失败，降级到单个分类
        for (const bookmark of batch) {
          try {
            const categoryResult = await this.categorizeBookmark(bookmark)
            results.push({
              id: bookmark.id,
              category: categoryResult.category,
              suggestedFolder: categoryResult.category
            })
          } catch (_err) {
            // 单个也失败，使用默认值
            results.push({
              id: bookmark.id,
              category: '其他',
              suggestedFolder: '其他'
            })
          }
        }
      }
    }

    return results
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
