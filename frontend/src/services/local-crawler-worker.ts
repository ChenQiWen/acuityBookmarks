/**
 * 🎯 本地爬虫工作器 - 100% 客户端执行
 *
 * 核心特性：
 * - 完全基于 Offscreen Document
 * - 零数据上传，保护隐私
 * - 域名级别限流
 * - Robots.txt 尊重
 * - 超时控制
 * - 错误降级
 *
 * @module LocalCrawlerWorker
 */

import { logger } from '@/infrastructure/logging/logger'

// ==================== 类型定义 ====================

export interface CrawlResult {
  success: boolean
  url: string
  httpStatus?: number
  metadata?: PageMetadata
  robotsAllowed?: boolean
  duration: number
  error?: string
  errorType?:
    | 'timeout'
    | 'cors'
    | 'network'
    | 'http_error'
    | 'robots'
    | 'unknown'
}

export interface PageMetadata {
  // 基础字段
  title: string
  description: string
  keywords: string
  lang: string
  author: string

  // Open Graph
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogSiteName: string
  ogType: string

  // Twitter Card
  twitterCard: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string

  // 图标
  iconHref: string
}

export interface CrawlOptions {
  respectRobots?: boolean
  timeout?: number
  retryCount?: number
}

// ==================== 配置常量 ====================

const MIN_DOMAIN_INTERVAL_MS = 1000 // 域名间隔1秒
const REQUEST_TIMEOUT_MS = 10000 // 请求超时10秒
const MAX_RETRIES = 2 // 最多重试2次
const ROBOTS_CACHE_TTL = 24 * 60 * 60 * 1000 // Robots.txt 缓存24小时

// ==================== 缓存 ====================

const DOMAIN_LAST_ACCESS = new Map<string, number>()
const ROBOTS_CACHE = new Map<string, { allowed: boolean; timestamp: number }>()

// ==================== 辅助函数 ====================

/**
 * 从 URL 提取域名
 */
function getDomainFromURL(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * 等待域名时间槽
 */
async function waitForDomainSlot(domain: string): Promise<void> {
  const lastAccess = DOMAIN_LAST_ACCESS.get(domain) || 0
  const now = Date.now()
  const diff = now - lastAccess

  if (diff < MIN_DOMAIN_INTERVAL_MS) {
    const waitTime = MIN_DOMAIN_INTERVAL_MS - diff
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  DOMAIN_LAST_ACCESS.set(domain, Date.now())
}

/**
 * 检查 Robots.txt
 */
async function checkRobotsTxt(url: string): Promise<boolean> {
  const domain = getDomainFromURL(url)
  if (!domain) return true

  // 检查缓存
  const cached = ROBOTS_CACHE.get(domain)
  if (cached && Date.now() - cached.timestamp < ROBOTS_CACHE_TTL) {
    return cached.allowed
  }

  try {
    const robotsUrl = `https://${domain}/robots.txt`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AcuityBookmarks-Extension/1.0'
      }
    })

    clearTimeout(timeoutId)

    let allowed = true

    if (response.ok) {
      const text = await response.text()

      // 简化解析：检查是否有 User-agent: * + Disallow: /
      if (/User-agent:\s*\*/i.test(text) && /Disallow:\s*\//i.test(text)) {
        allowed = false
      }
    }

    // 缓存结果
    ROBOTS_CACHE.set(domain, { allowed, timestamp: Date.now() })
    return allowed
  } catch (error) {
    // 无法获取则默认允许
    logger.debug(
      'LocalCrawler',
      `Failed to check robots.txt for ${domain}`,
      error
    )
    ROBOTS_CACHE.set(domain, { allowed: true, timestamp: Date.now() })
    return true
  }
}

/**
 * 确保 Offscreen Document 存在
 */
async function ensureOffscreenDocument(): Promise<boolean> {
  try {
    // 检查是否已存在
    if (
      chrome.offscreen &&
      typeof chrome.offscreen.hasDocument === 'function'
    ) {
      const hasDoc = await chrome.offscreen.hasDocument()
      if (hasDoc) return true
    }
  } catch (e) {
    // hasDocument 可能不存在，继续尝试创建
    logger.debug('LocalCrawler', 'Offscreen Document not available', e)
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING' as chrome.offscreen.Reason],
      justification:
        'Parse bookmark page metadata locally for privacy protection'
    })

    logger.info('LocalCrawler', '✅ Offscreen Document 已创建')
    return true
  } catch (error) {
    logger.error('LocalCrawler', '❌ 无法创建 Offscreen Document', error)
    return false
  }
}

/**
 * 使用 Offscreen Document 解析 HTML
 */
async function parseHTMLInOffscreen(
  html: string,
  url: string
): Promise<PageMetadata> {
  const offscreenReady = await ensureOffscreenDocument()

  if (!offscreenReady) {
    throw new Error('Offscreen Document not available')
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Offscreen parsing timeout'))
    }, 3000)

    chrome.runtime.sendMessage(
      { type: 'PARSE_HTML', html, url },
      (response: PageMetadata) => {
        clearTimeout(timeout)

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        resolve(response || ({} as PageMetadata))
      }
    )
  })
}

/**
 * 降级：使用正则表达式解析 HTML
 */
function fallbackParseHTML(html: string): PageMetadata {
  const extract = (regex: RegExp): string => {
    const match = html.match(regex)
    return match ? match[1].trim() : ''
  }

  return {
    // 基础
    title: extract(/<title[^>]*>([^<]*)<\/title>/i),
    description: extract(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    keywords: extract(
      /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    lang: extract(/<html[^>]*lang=["']([^"']+)["'][^>]*>/i),
    author: extract(
      /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),

    // Open Graph
    ogTitle: extract(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    ogDescription: extract(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    ogImage: extract(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    ogSiteName: extract(
      /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    ogType: extract(
      /<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),

    // Twitter Card
    twitterCard: extract(
      /<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    twitterTitle: extract(
      /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    twitterDescription: extract(
      /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),
    twitterImage: extract(
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ),

    // 图标
    iconHref: extract(
      /<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["'][^>]*>/i
    )
  }
}

/**
 * 错误分类
 */
function classifyError(error: unknown): CrawlResult['errorType'] {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('aborted') || message.includes('timeout')) {
    return 'timeout'
  }
  if (message.includes('CORS') || message.includes('blocked')) {
    return 'cors'
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'network'
  }
  if (/HTTP [45]\d{2}/.test(message)) {
    return 'http_error'
  }
  if (message.includes('robots')) {
    return 'robots'
  }

  return 'unknown'
}

/**
 * 判断是否应该重试
 */
function shouldRetry(result: CrawlResult): boolean {
  return result.errorType === 'timeout' || result.errorType === 'network'
}

// ==================== 核心爬取函数 ====================

/**
 * 本地爬取书签
 *
 * @param url - 目标 URL
 * @param options - 爬取选项
 * @returns 爬取结果
 */
export async function crawlBookmarkLocally(
  url: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const {
    respectRobots = true,
    timeout = REQUEST_TIMEOUT_MS,
    retryCount = 0
  } = options

  const startTime = Date.now()
  const domain = getDomainFromURL(url)

  try {
    // Step 1: 域名限流
    await waitForDomainSlot(domain)

    // Step 2: Robots.txt 检查
    if (respectRobots) {
      const robotsAllowed = await checkRobotsTxt(url)
      if (!robotsAllowed) {
        return {
          success: false,
          url,
          error: 'Blocked by robots.txt',
          errorType: 'robots',
          robotsAllowed: false,
          duration: Date.now() - startTime
        }
      }
    }

    // Step 3: 发起网络请求
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      }
    })

    clearTimeout(timeoutId)

    // Step 4: 检查响应
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }

    // Step 5: 读取 HTML
    const html = await response.text()

    if (!html || html.length < 50) {
      throw new Error('HTML content too short or empty')
    }

    // Step 6: 解析元数据（优先 Offscreen，失败则降级）
    let metadata: PageMetadata
    try {
      metadata = await parseHTMLInOffscreen(html, url)
      logger.debug('LocalCrawler', `✅ Offscreen 解析成功: ${url}`)
    } catch (offscreenError) {
      logger.warn(
        'LocalCrawler',
        `⚠️ Offscreen 解析失败，降级到正则: ${url}`,
        offscreenError
      )
      metadata = fallbackParseHTML(html)
    }

    // Step 7: 返回成功结果
    return {
      success: true,
      url: response.url || url, // 处理重定向
      httpStatus: response.status,
      metadata,
      robotsAllowed: true,
      duration: Date.now() - startTime
    }
  } catch (error) {
    // 重试逻辑
    if (retryCount < MAX_RETRIES) {
      const result: CrawlResult = {
        success: false,
        url,
        error: error instanceof Error ? error.message : String(error),
        errorType: classifyError(error),
        duration: Date.now() - startTime
      }

      if (shouldRetry(result)) {
        logger.debug(
          'LocalCrawler',
          `🔄 重试 (${retryCount + 1}/${MAX_RETRIES}): ${url}`
        )

        // 等待后重试
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * (retryCount + 1))
        )

        return crawlBookmarkLocally(url, {
          ...options,
          retryCount: retryCount + 1
        })
      }
    }

    // 返回失败结果
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : String(error),
      errorType: classifyError(error),
      duration: Date.now() - startTime
    }
  }
}

// ==================== 工具函数 ====================

/**
 * 获取爬虫统计信息
 */
export function getCrawlerStats() {
  return {
    domainsCached: DOMAIN_LAST_ACCESS.size,
    robotsCached: ROBOTS_CACHE.size
  }
}

/**
 * 清理缓存
 */
export function clearCrawlerCache() {
  DOMAIN_LAST_ACCESS.clear()
  ROBOTS_CACHE.clear()
  logger.info('LocalCrawler', '🧹 缓存已清理')
}

/**
 * 预热 Offscreen Document
 */
export async function warmupOffscreenDocument(): Promise<boolean> {
  try {
    const ready = await ensureOffscreenDocument()
    if (ready) {
      logger.info('LocalCrawler', '🔥 Offscreen Document 预热完成')
    }
    return ready
  } catch (error) {
    logger.error('LocalCrawler', '❌ Offscreen Document 预热失败', error)
    return false
  }
}
