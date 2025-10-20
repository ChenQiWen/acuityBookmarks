/**
 * Chrome Omnibox 集成模块
 *
 * 职责：
 * - 集成 Chrome 地址栏搜索功能
 * - 实现地址栏书签快速搜索
 * - 提供搜索建议和快速打开
 * - 支持防抖和降级策略
 *
 * 功能：
 * 1. 监听地址栏关键字输入，结合本地 Hybrid 搜索快速返回候选书签
 * 2. 支持失败降级与占位提示，确保用户体验稳定
 * 3. 将最终指令分流到直接打开书签或跳转管理页面
 *
 * 使用方式：
 * 在地址栏输入 "ab" 或扩展关键字，然后输入搜索词
 */

import { logger } from '@/infrastructure/logging/logger'
import { searchAppService } from '@/application/search/search-app-service'
import type { EnhancedSearchResult } from '@/core/search'

/**
 * 将 Omnibox 描述中的特殊字符转义成 XML 安全字符，避免 chrome.omnibox 解析失败。
 * Omnibox 描述是一个受限的 XML 片段，未转义的 `&`/`<`/`>`/引号 会触发 `Invalid XML` 错误。
 */
function escapeOmniboxText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

function buildDescription(title: string, url?: string): string {
  const titleTrimmed = truncateWithEllipsis(title.trim(), 80)
  const safeTitle = escapeOmniboxText(titleTrimmed || '未命名书签')

  if (!url) {
    return `<match>${safeTitle}</match>`
  }

  const urlTrimmed = truncateWithEllipsis(url.trim(), 120)
  const safeUrl = escapeOmniboxText(urlTrimmed)
  return `<match>${safeTitle}</match> <dim>${safeUrl}</dim>`
}

/** 建议结果最大数量 */
const SUGGESTION_LIMIT = 6
/** 防抖延迟（毫秒） */
const DEBOUNCE_MS = 100

/**
 * 注册 Omnibox 事件监听器
 *
 * 设置默认建议并监听输入变化和确认事件
 */
export function registerOmniboxHandlers(): void {
  if (!chrome?.omnibox?.setDefaultSuggestion) {
    logger.debug('Omnibox', '当前环境不支持 Omnibox，跳过注册')
    return
  }

  chrome.omnibox.setDefaultSuggestion({
    description: buildDescription('AcuityBookmarks：在地址栏中快速搜索书签')
  })

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0

  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const rawText = text || ''
    const query = rawText.trim()

    if (debounceTimer) clearTimeout(debounceTimer)

    if (!query || query === '__test') {
      const debugSuggestions: chrome.omnibox.SuggestResult[] = [
        {
          content: 'https://example.com',
          description: '<match>Example Domain</match>'
        },
        {
          content: 'https://developer.chrome.com/docs/extensions/mv3/omnibox/',
          description: '<match>Chrome Extensions Docs</match>'
        }
      ]
      safeSuggest(suggest, debugSuggestions, 'debug-static')
      return
    }

    const currentSeq = ++sequence
    debounceTimer = setTimeout(async () => {
      try {
        logger.info('Omnibox', `🔍 开始搜索: ${query}`)
        const results = await searchAppService.search(query, {
          limit: SUGGESTION_LIMIT,
          useCache: false
        })
        if (currentSeq !== sequence) return

        const suggestions = buildSuggestions(results, query)
        logger.info(
          'Omnibox',
          `📊 搜索结果数: ${results.length}, 建议条目: ${suggestions.length}`
        )
        logger.info('Omnibox', '建议预览', suggestions.slice(0, 3))
        safeSuggest(suggest, suggestions, 'fuse-results')
      } catch (error) {
        logger.warn('Omnibox', '搜索失败，回退占位', error)
        if (currentSeq !== sequence) return
        safeSuggest(suggest, [], 'search-error-fallback')
      }
    }, DEBOUNCE_MS)
  })

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    const parsed = parseSuggestionContent(text)

    if (parsed.view === 'manage' && parsed.id) {
      openManagement(parsed.id)
      return
    }

    if (parsed.url) {
      openUrl(parsed.url, disposition)
      return
    }

    if (parsed.id) {
      openBookmarkById(parsed.id, disposition)
      return
    }
  })
}

/**
 * 安全触发建议回调
 *
 * 避免在上下文已失效时调用导致错误
 *
 * @param suggest - Chrome 提供的建议回调函数
 * @param suggestions - 建议结果数组
 * @param source - 建议来源（用于日志）
 */
function safeSuggest(
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void,
  suggestions: chrome.omnibox.SuggestResult[],
  source: string
): void {
  try {
    logger.info('Omnibox', `safeSuggest(${source})`, suggestions)
    suggest(suggestions)
  } catch (error) {
    logger.warn('Omnibox', `suggest 调用失败（${source}）`, error)
  }
}

/**
 * 将搜索结果转换为 Omnibox 建议格式
 *
 * 自动去重相同 URL 的书签
 *
 * @param results - 搜索结果数组
 * @returns Omnibox 建议结果数组
 */
function buildSuggestions(
  results: EnhancedSearchResult[],
  query: string
): chrome.omnibox.SuggestResult[] {
  const uniqueByUrl = new Map<string, chrome.omnibox.SuggestResult>()
  let deduped = 0

  for (const item of results) {
    const bookmark = item.bookmark
    const url = bookmark.url || ''
    const id = String(bookmark.id || '')
    const title = bookmark.title || url || '未命名书签'
    const description = buildDescription(title, url)

    const meta = new URLSearchParams({
      id,
      title,
      source: 'omnibox'
    })

    const content = url ? url : `acuity://bookmark?${meta.toString()}`

    const suggestion: chrome.omnibox.SuggestResult = {
      content,
      description
    }

    const dedupeKey = url || id
    if (!dedupeKey) continue
    if (uniqueByUrl.has(dedupeKey)) {
      deduped += 1
      continue
    }
    uniqueByUrl.set(dedupeKey, suggestion)
  }

  logger.info(
    'Omnibox',
    `去重前数量: ${results.length}, 被去重: ${deduped}, 唯一项: ${uniqueByUrl.size}`
  )

  if (uniqueByUrl.size === 0) {
    logger.info('Omnibox', `ℹ️ 没有匹配书签: ${query}`)
    uniqueByUrl.set('no-results', {
      content: query,
      description: buildDescription('未找到匹配书签（来自索引）')
    })
  }

  return Array.from(uniqueByUrl.values())
}

/**
 * 解析后的建议信息接口
 */
interface ParsedSuggestion {
  /** 书签URL */
  url: string | null
  /** 书签ID */
  id: string | null
  /** 视图类型 */
  view: 'open' | 'manage'
}

/**
 * 解析建议内容中的书签元信息
 *
 * 从 suggestion.content 提取 URL、ID 和视图类型
 *
 * @param text - 建议内容字符串
 * @returns 解析后的建议信息
 */
function parseSuggestionContent(text: string): ParsedSuggestion {
  try {
    const url = new URL(text)
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    return {
      url: url.href.split('#')[0],
      id: hashParams.get('id'),
      view: (hashParams.get('view') as ParsedSuggestion['view']) || 'open'
    }
  } catch {
    return { url: null, id: null, view: 'open' }
  }
}

/**
 * 直接打开书签 URL
 *
 * 根据用户选择的打开方式（当前标签、新前台标签、新后台标签）打开链接
 *
 * @param url - 要打开的 URL
 * @param disposition - 打开方式
 */
function openUrl(url: string, disposition: string): void {
  const isForeground =
    disposition === 'currentTab' || disposition === 'newForegroundTab'
  if (disposition === 'currentTab') {
    chrome.tabs
      .update({ url })
      .catch(() => chrome.tabs.create({ url, active: true }))
    return
  }

  chrome.tabs.create({ url, active: isForeground }).catch(error => {
    logger.warn('Omnibox', 'tabs.create 调用失败', error)
  })
}

/**
 * 通过书签 ID 获取 URL 并打开
 *
 * @param id - 书签ID
 * @param disposition - 打开方式
 */
async function openBookmarkById(
  id: string,
  disposition: string
): Promise<void> {
  try {
    const nodes = await chrome.bookmarks.get(id)
    const target = Array.isArray(nodes) ? nodes[0] : null
    if (target?.url) {
      openUrl(target.url, disposition)
      return
    }
  } catch (error) {
    logger.warn('Omnibox', '根据书签 ID 打开失败', error)
  }
}

/**
 * 打开管理页面并定位到指定书签
 *
 * @param id - 书签ID，用于在管理页面中定位
 */
function openManagement(id: string): void {
  try {
    const base = chrome.runtime.getURL?.('management.html') ?? 'management.html'
    const url = `${base}?id=${encodeURIComponent(id)}`
    chrome.tabs.create?.({ url, active: true })
  } catch (error) {
    logger.warn('Omnibox', '打开管理页面失败', error)
  }
}
