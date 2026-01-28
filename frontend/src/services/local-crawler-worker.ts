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
import { dispatchOffscreenRequest } from '@/background/offscreen-manager'
import { TIMEOUT_CONFIG } from '@/config/constants'

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
  retryCount?: number // 重试次数
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

const MIN_DOMAIN_INTERVAL_MS = 1000 // 域内请求间隔 1 秒，避免过于激进触发限流
// ✅ 使用统一配置：爬虫请求超时
const REQUEST_TIMEOUT_MS = TIMEOUT_CONFIG.CRAWLER.REQUEST
const MAX_RETRIES = 2 // 失败后最多自动重试 2 次（指数退避）
const ROBOTS_CACHE_TTL = 24 * 60 * 60 * 1000 // Robots.txt 缓存 24 小时，减少频繁访问
const HEAD_SNIPPET_MAX_BYTES = 160 * 1024 // 仅抓取前 160KB，提高长文页面的响应速度
const REQUIRED_FIELD_THRESHOLD = 2 // 需要至少两个核心字段，确保最终数据质量

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
 * 按需读取 HTML 片段
 *
 * 通过 ReadableStream 边读边解码，检测到 </head> 或者超过上限后立即停止，
 * 避免把整页正文下载完毕，显著减少网络与解析开销。
 */
async function readHeadHtmlSnippet(
  response: Response,
  maxBytes: number = HEAD_SNIPPET_MAX_BYTES
): Promise<string> {
  if (!response.body) {
    return await response.text()
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8') // Chrome 默认 UTF-8，可根据 meta charset 在后续扩展
  let html = ''
  let bytesRead = 0
  let headClosed = false

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      bytesRead += value.byteLength
      html += decoder.decode(value, { stream: true })

      if (html.toLowerCase().includes('</head>')) {
        headClosed = true
        break
      }

      if (bytesRead >= maxBytes) {
        break
      }
    }
  } finally {
    html += decoder.decode()

    if (!headClosed) {
      try {
        await reader.cancel()
      } catch {
        // 忽略取消失败
      }
    }
  }

  return html
}

/**
 * 判断基础元数据是否已经充足
 *
 * 只要 Title / Description / og:site_name 至少满足两个，就认为正则解析足够，
 * 可以跳过 Offscreen DOM 渲染，节省一次消息往返。
 */
function metadataHasEssentialFields(meta: PageMetadata): boolean {
  let essentials = 0
  if (meta.title || meta.ogTitle) essentials += 1
  if (meta.description || meta.ogDescription) essentials += 1
  if (meta.ogSiteName) essentials += 1

  return essentials >= REQUIRED_FIELD_THRESHOLD
}

/**
 * 合并元数据
 *
 * 以正则结果为主，逐字段补充 Offscreen 解析得到的内容，
 * 避免覆盖已有的非空数据，保证结果稳定可控。
 */
function mergeMetadata(
  base: PageMetadata,
  extra?: Partial<PageMetadata>
): PageMetadata {
  if (!extra) return base
  const sanitized: Partial<PageMetadata> = {}
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== '') {
      sanitized[key as keyof PageMetadata] =
        value as PageMetadata[keyof PageMetadata]
    }
  }
  return { ...base, ...sanitized }
}

/**
 * 主动丢弃剩余响应体
 *
 * 在已经提前截断 HEAD 后，取消底层流读取，避免保持网络连接占用资源。
 */
async function discardResponseBody(response: Response): Promise<void> {
  if (response.body) {
    try {
      await response.body.cancel()
    } catch {
      // 忽略取消异常
    }
    return
  }

  try {
    await response.arrayBuffer()
  } catch {
    // 忽略
  }
}

/**
 * 构造可供 Offscreen DOM 正常解析的最小 HTML
 *
 * 有些站点的 head 片段不成对，此函数将其包装进完整文档结构，
 * 确保 DOMParser 不报错。
 */
/**
 * 提取 head 核心片段
 *
 * - 如果抓到完整的 `<head> ... </head>`，则直接返回内部内容
 * - 如果只有 `<head>` 起始标签或根本没有 `<head>`，则仅保留 `<head>` 前部份
 *
 * 这样一来，我们只会传递有限的 head 片段给 Offscreen，避免将正文部分包进去。
 */
function extractHeadContent(html: string): string {
  const lower = html.toLowerCase()
  const headStartMatch = lower.match(/<head[^>]*>/)
  if (!headStartMatch) {
    const headEndIndex = lower.indexOf('</head>')
    if (headEndIndex !== -1) {
      return html.slice(0, headEndIndex)
    }

    const headlessEndIndex = Math.max(
      lower.indexOf('<body'),
      lower.indexOf('<div'),
      lower.indexOf('<p')
    )

    if (headlessEndIndex !== -1) {
      return html.slice(0, headlessEndIndex)
    }

    return html
  }

  const headStartIndex = headStartMatch.index ?? 0
  const afterHead = html.slice(headStartIndex + headStartMatch[0].length)
  const headEndIndex = afterHead.toLowerCase().indexOf('</head>')

  if (headEndIndex !== -1) {
    return afterHead.slice(0, headEndIndex)
  }

  const bodyIndex = afterHead.toLowerCase().indexOf('<body')
  if (bodyIndex !== -1) {
    return afterHead.slice(0, bodyIndex)
  }

  return afterHead
}

function ensureDomParsableSnippet(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) {
    return '<!doctype html><html><head></head><body></body></html>'
  }

  const headContent = extractHeadContent(trimmed)
  return `<!doctype html><html><head>${headContent}</head><body></body></html>`
}

/**
 * 使用 Offscreen 文档解析，并在失败时回退
 *
 * 先尝试高级解析，若成功则与正则结果合并；若失败，保留正则结果并打日志。
 */
async function parseWithOffscreenOrFallback(
  htmlSnippet: string,
  url: string,
  fallback: PageMetadata
): Promise<PageMetadata> {
  try {
    const sanitized = ensureDomParsableSnippet(htmlSnippet)
    const parsed = await parseHTMLInOffscreen(sanitized, url)
    logger.debug('LocalCrawler', `✅ Offscreen 解析补充: ${url}`)
    return mergeMetadata(fallback, parsed)
  } catch (offscreenError) {
    logger.warn('LocalCrawler', `⚠️ Offscreen 解析失败，使用正则结果: ${url}`, {
      error: offscreenError
    })
    return fallback
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
 * 使用 Offscreen Document 解析 HTML
 */
async function parseHTMLInOffscreen(
  html: string,
  url: string
): Promise<PageMetadata> {
  const fallback = fallbackParseHTML(html)

  try {
    const offscreenResult = await dispatchOffscreenRequest<
      Partial<PageMetadata>
    >(
      {
        type: 'PARSE_HTML',
        payload: { html, url }
      },
      { timeout: TIMEOUT_CONFIG.CRAWLER.PARSE } // HTML解析超时
    )

    return mergeMetadata(fallback, offscreenResult)
  } catch (error) {
    logger.warn('LocalCrawler', 'Offscreen 解析失败，使用降级方案', error)
    return fallback
  }
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
    const htmlSnippet = await readHeadHtmlSnippet(response)

    if (!htmlSnippet || htmlSnippet.length < 50) {
      throw new Error('HTML content too short or empty')
    }

    // Step 6: 正则优先解析 head 元数据
    const fallbackMetadata = fallbackParseHTML(htmlSnippet)

    let metadata: PageMetadata = fallbackMetadata

    if (!metadataHasEssentialFields(fallbackMetadata)) {
      logger.debug('LocalCrawler', `🧪 正则结果不足，准备 Offscreen: ${url}`)
      metadata = await parseWithOffscreenOrFallback(
        htmlSnippet,
        url,
        fallbackMetadata
      )
    }

    await discardResponseBody(response)

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
        duration: Date.now() - startTime,
        retryCount
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

    // 返回失败结果（包含最终的重试次数）
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : String(error),
      errorType: classifyError(error),
      duration: Date.now() - startTime,
      retryCount // ✅ 添加重试次数
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
    // This function is no longer needed as Offscreen Document is managed by offscreen-manager
    // and the parsing is handled within crawlBookmarkLocally.
    // Keeping it for now, but it might be removed if not used elsewhere.
    logger.info(
      'LocalCrawler',
      'Offscreen Document warmup is no longer needed here.'
    )
    return true
  } catch (error) {
    logger.error('LocalCrawler', '❌ Offscreen Document 预热失败', error)
    return false
  }
}
