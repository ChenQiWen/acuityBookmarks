/**
 * Chrome Omnibox 集成模块
 *
 * 职责：
 * - 集成 Chrome 地址栏快速查询功能
 * - 实现地址栏书签快速查询
 * - 提供查询建议和快速打开
 * - 支持防抖和降级策略
 *
 * 功能：
 * 1. 监听地址栏关键字输入，结合本地书签查询快速返回候选书签
 * 2. 支持失败降级与占位提示，确保用户体验稳定
 * 3. 将最终指令分流到直接打开书签或跳转整理页面
 *
 * 使用方式：
 * 在地址栏输入 "ab" 或扩展关键字，然后输入查询条件
 */

import { logger } from '@/infrastructure/logging/logger'
import { queryAppService } from '@/application/query/query-app-service'
import type { EnhancedSearchResult } from '@/core/query-engine'

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

/**
 * 截断字符串并追加省略号，保持描述长度在可控范围内。
 *
 * @param text 原始文本
 * @param maxLength 允许的最大长度
 * @returns 截断后的文本，超长时以省略号结尾
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

/**
 * 构造书签的标题与 URL 展示描述。
 *
 * @param title 书签标题
 * @param url 书签 URL，可选
 * @returns 符合 Omnibox XML 语法的描述字符串
 */
function buildDescription(title: string, url?: string): string {
  const titleTrimmed = truncateWithEllipsis(title.trim(), 80)
  const safeTitle = escapeOmniboxText(titleTrimmed || '未命名书签')

  if (!url) {
    return `<match>${safeTitle}</match>`
  }

  const urlTrimmed = truncateWithEllipsis(url.trim(), 120)
  const safeUrl = escapeOmniboxText(urlTrimmed)
  return `<match>${safeTitle}</match><dim> - </dim><url>${safeUrl}</url>`
}

/**
 * 去掉完整路径中的末尾节点，避免与标题重复显示。
 *
 * @param rawPath 书签原始路径
 * @param title 当前书签标题
 * @returns 去除末尾标题后的路径字符串
 */
function stripTrailingPathSegment(rawPath: string, title: string): string {
  const normalizedPath = rawPath.trim()
  if (!normalizedPath) return ''

  const segments = normalizedPath.split(/\s*\/\s*/)
  if (!segments.length) return ''

  const lastSegment = segments[segments.length - 1]
  if (lastSegment && lastSegment === title.trim()) {
    segments.pop()
  }

  return segments.join(' / ')
}

/**
 * 构造无查询结果时的提示描述，显式告知用户书签索引中没有匹配项。
 */
function buildNoResultDescription(query: string): string {
  const safeQuery = escapeOmniboxText(
    truncateWithEllipsis(query, 80) || '（空）'
  )
  return `<dim>未找到匹配书签：</dim> <match>${safeQuery}</match>`
}

/**
 * 构造查询失败后的提示描述，提示用户稍后重试或检查离线状态。
 */
function buildErrorDescription(query: string): string {
  const safeQuery = escapeOmniboxText(
    truncateWithEllipsis(query, 80) || '（空）'
  )
  return `<dim>查询暂时不可用，请稍后重试：</dim> <match>${safeQuery}</match>`
}

/**
 * 构造"正在查询"提示描述，用于在异步请求过程中反馈状态。
 */
function buildSearchingDescription(query: string): string {
  const safeQuery = escapeOmniboxText(
    truncateWithEllipsis(query, 80) || '（空）'
  )
  return `<dim>正在检索书签：</dim> <match>${safeQuery}</match>`
}

/**
 * 构造"找到匹配数量"提示描述，提示当前命中情况。
 */
function buildResultSummaryDescription(query: string, count: number): string {
  const safeQuery = escapeOmniboxText(
    truncateWithEllipsis(query, 80) || '（空）'
  )
  const safeCount = Number.isFinite(count) && count >= 0 ? count : 0
  return `<dim>已找到匹配书签：</dim> <match>${safeQuery}</match> <dim>（${safeCount} 条建议）</dim>`
}

/**
 * 构造"查询失败"建议项，为用户提供直观反馈。
 */
function createErrorSuggestion(query: string): chrome.omnibox.SuggestResult {
  return {
    content: `acuity://error?query=${encodeURIComponent(query)}`,
    description: buildErrorDescription(query)
  }
}

/**
 * 为 Omnibox 设置默认提示描述，调用前需保证描述已做 XML 转义。
 */
function setDefaultDescription(description: string): void {
  chrome.omnibox.setDefaultSuggestion?.({ description })
}

/** 建议结果最大数量 */
const SUGGESTION_LIMIT = 4
/** 防抖延迟（毫秒） */
const DEBOUNCE_MS = 100

/**
 * 默认提示文案：仅在输入框为空时展示，提醒用户可以使用 Omnibox 查询书签。
 */
const DEFAULT_IDLE_DESCRIPTION = buildDescription(
  'AcuityBookmarks：输入关键字快速查找书签'
)

/**
 * 当存在查询时使用的“空白”占位文案，避免重复显示默认提示。
 * 这里使用单个空格，确保生成合法 XML，同时在 UI 上几乎不可见。
 */
const ACTIVE_QUERY_PLACEHOLDER = '<dim>&#8203;</dim>'

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

  setDefaultDescription(DEFAULT_IDLE_DESCRIPTION)

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0

  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const rawText = text || ''
    const query = rawText.trim()

    if (!query) {
      sequence += 1
      setDefaultDescription(DEFAULT_IDLE_DESCRIPTION)
      if (debounceTimer) clearTimeout(debounceTimer)
      safeSuggest(suggest, [], 'empty-query')
      logger.info('Omnibox', '🔎 空查询，保持默认提示')
      return
    }

    setDefaultDescription(ACTIVE_QUERY_PLACEHOLDER)

    if (debounceTimer) clearTimeout(debounceTimer)

    const currentSeq = ++sequence
    debounceTimer = setTimeout(async () => {
      try {
        logger.info('Omnibox', `🔍 开始查询: ${query}`)
        setDefaultDescription(buildSearchingDescription(query))
        const results = await queryAppService.search(query, {
          limit: SUGGESTION_LIMIT,
          useCache: false
        })
        if (currentSeq !== sequence) return

        const suggestions = buildSuggestions(results, query)
        logger.info(
          'Omnibox',
          `📊 查询结果数: ${results.length}, 建议条目: ${suggestions.length}`
        )
        logger.info('Omnibox', '建议预览', suggestions.slice(0, 3))
        safeSuggest(suggest, suggestions, 'fuse-results')
        if (results.length > 0) {
          setDefaultDescription(
            buildResultSummaryDescription(query, results.length)
          )
        } else {
          setDefaultDescription(buildNoResultDescription(query))
        }
      } catch (error) {
        logger.warn('Omnibox', '查询失败，回退占位', error)
        if (currentSeq !== sequence) return
        safeSuggest(
          suggest,
          [createErrorSuggestion(query)],
          'search-error-fallback'
        )
        setDefaultDescription(buildErrorDescription(query))
      }
    }, DEBOUNCE_MS)
  })

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    const parsed = parseSuggestionContent(text)

    if (parsed.view === 'manage' && parsed.id) {
      openManagement(parsed.id)
      return
    }

    if (parsed.view === 'noop' || parsed.view === 'error') {
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
 * 将查询结果转换为 Omnibox 建议格式
 *
 * 自动去重相同 URL 的书签
 *
 * @param results - 查询结果数组
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
    const descriptionSegments: string[] = [buildDescription(title, url)]

    const rawPath = item.pathString || bookmark.pathString
    if (rawPath) {
      const trimmedPath = stripTrailingPathSegment(rawPath, title)
      if (trimmedPath) {
        const safePath = escapeOmniboxText(trimmedPath)
        descriptionSegments.push(`<dim>${safePath}</dim>`)
      }
    }

    const description = descriptionSegments.join('  ')

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
  view: 'open' | 'manage' | 'noop' | 'error'
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
    if (url.protocol === 'acuity:') {
      const rawView = url.hostname
      const normalizedView: ParsedSuggestion['view'] =
        rawView === 'manage' ? 'manage' : rawView === 'error' ? 'error' : 'noop'
      const params = new URLSearchParams(url.search.replace(/^\?/, ''))
      return {
        url: null,
        id: params.get('id'),
        view: normalizedView
      }
    }
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
 * 打开整理页面并定位到指定书签
 *
 * @param id - 书签ID，用于在整理页面中定位
 */
function openManagement(id: string): void {
  try {
    const base = chrome.runtime.getURL?.('management.html') ?? 'management.html'
    const url = `${base}?id=${encodeURIComponent(id)}`
    chrome.tabs.create?.({ url, active: true })
  } catch (error) {
    logger.warn('Omnibox', '打开整理页面失败', error)
  }
}
