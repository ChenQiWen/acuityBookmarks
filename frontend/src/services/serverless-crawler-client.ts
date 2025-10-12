/**
 * Serverless 爬虫服务客户端
 * 连接 Chrome 扩展与后端爬虫服务（Cloudflare Worker）
 */

import type { LightweightBookmarkMetadata } from './lightweight-bookmark-enhancer'
import { DEBUG_CONFIG, API_CONFIG } from '../config/constants'
import { logger } from '@/infrastructure/logging/logger'

const DEFAULT_TIMEOUT = 8000
const MAX_RETRIES = 2

// 📊 请求和响应类型 (匹配后端格式)
interface CrawlerRequest {
  id: string
  title: string
  url: string
  config?: {
    timeout?: number
    userAgent?: string
  }
}

// 🔧 简化响应格式，直接匹配后端返回的格式
interface CrawlerResponse {
  success: boolean
  data?: LightweightBookmarkMetadata
  error?: {
    message: string
    code?: string
  }
  timestamp?: string
}

/**
 * Serverless爬虫客户端类
 */
export class ServerlessCrawlerClient {
  private apiBase: string
  private cache = new Map<
    string,
    { data: LightweightBookmarkMetadata; timestamp: number }
  >()
  private readonly CACHE_TTL = 6 * 60 * 60 * 1000 // 6小时缓存

  constructor(apiBase?: string) {
    this.apiBase = apiBase || API_CONFIG.API_BASE
    if (DEBUG_CONFIG.VERBOSE_LOGGING) {
      logger.info('[ServerlessCrawlerClient] 使用 API 基址:', this.apiBase)
    }
  }

  /**
   * 🎯 爬取单个书签内容
   */
  async crawlBookmark(
    bookmark: chrome.bookmarks.BookmarkTreeNode
  ): Promise<LightweightBookmarkMetadata | null> {
    if (!bookmark.url) {
      logger.warn('⚠️ [ServerlessCrawler] 书签URL为空:', bookmark.id)
      return null
    }

    const cacheKey = `serverless:${bookmark.url}`

    // 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.info(
        'Component',
        '💾 [ServerlessCrawler] 缓存命中: ${bookmark.url}'
      )
      return cached.data
    }

    try {
      logger.info(
        'Component',
        '🚀 [ServerlessCrawler] 开始爬取: ${bookmark.url}'
      )

      // 🔧 修复：使用后端期望的格式
      const crawlerData = await this.callCrawlerAPI({
        id: bookmark.id,
        title: bookmark.title || '',
        url: bookmark.url,
        config: {
          timeout: DEFAULT_TIMEOUT,
          userAgent: 'AcuityBookmarks-Extension/1.0'
        }
      })

      if (!crawlerData.success || !crawlerData.data) {
        logger.warn(
          'ServerlessCrawler',
          `⚠️ 爬取失败: ${bookmark.url}`,
          crawlerData.error?.message
        )
        return null
      }

      // 🔧 修复：后端已返回LightweightBookmarkMetadata格式，直接使用
      const enhancedData: LightweightBookmarkMetadata = crawlerData.data

      // 存储缓存
      this.cache.set(cacheKey, {
        data: enhancedData,
        timestamp: Date.now()
      })

      logger.info(
        'Component',
        '✅ [ServerlessCrawler] 成功爬取: ${bookmark.url}'
      )
      return enhancedData
    } catch (error) {
      logger.error(
        'Component',
        '❌ [ServerlessCrawler] 爬取异常: ${bookmark.url}',
        error
      )
      return null
    }
  }

  /**
   * 🚀 批量爬取书签
   */
  async crawlBookmarks(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  ): Promise<LightweightBookmarkMetadata[]> {
    const results: LightweightBookmarkMetadata[] = []
    const concurrency = 3 // 并发限制

    logger.info(
      'Component',
      '🎯 [ServerlessCrawler] 开始批量爬取: ${bookmarks.length} 个书签'
    )

    // 分批处理
    for (let i = 0; i < bookmarks.length; i += concurrency) {
      const batch = bookmarks.slice(i, i + concurrency)
      const batchPromises = batch.map(bookmark => this.crawlBookmark(bookmark))

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value)
        } else {
          logger.warn(`⚠️ [ServerlessCrawler] 批量处理失败:`, batch[index].url)
        }
      })

      // 批次间延迟，避免过载
      if (i + concurrency < bookmarks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    logger.info(
      'Component',
      '✅ [ServerlessCrawler] 批量爬取完成: ${results.length}/${bookmarks.length}'
    )
    return results
  }

  /**
   * 🌐 调用爬虫API
   */
  private async callCrawlerAPI(
    request: CrawlerRequest,
    retryCount = 0
  ): Promise<CrawlerResponse> {
    try {
      const response = await fetch(
        `${this.apiBase}${API_CONFIG.ENDPOINTS.crawl}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'AcuityBookmarks-Extension/1.0'
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(
            request.config?.timeout || DEFAULT_TIMEOUT
          )
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: CrawlerResponse = await response.json()
      return data
    } catch (error) {
      // 重试机制
      if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
        logger.info(
          'Component',
          '🔄 [ServerlessCrawler] 重试 ${retryCount + 1}/${MAX_RETRIES}: ${request.url}'
        )
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * (retryCount + 1))
        )
        return this.callCrawlerAPI(request, retryCount + 1)
      }

      throw error
    }
  }

  /**
   * 🔄 判断是否应该重试
   */
  private shouldRetry(error: Error | unknown): boolean {
    if (error instanceof Error) {
      if (error.name === 'AbortError') return false // 超时不重试
      if (error.message?.includes('4')) return false // 4xx错误不重试
    }
    return true // 其他错误重试
  }

  // 🗑️ 已删除convertToLightweightData方法 - 后端直接返回正确格式

  /**
   * 🧹 清理过期缓存
   */
  cleanCache(): number {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        'Component',
        '🧹 [ServerlessCrawler] 清理了 ${cleanedCount} 个过期缓存'
      )
    }

    return cleanedCount
  }

  /**
   * 📊 获取统计信息
   */
  getStats() {
    return {
      apiBase: this.apiBase,
      cacheSize: this.cache.size,
      cacheHitRate: '动态计算', // TODO: 实现缓存命中率统计
      cacheTTL: this.CACHE_TTL / 1000 / 60 / 60 + ' 小时'
    }
  }
}

// 导出单例实例
export const serverlessCrawlerClient = new ServerlessCrawlerClient()
