/**
 * Chrome Omnibox 集成模块
 *
 * 职责：
 * 1. 监听地址栏关键字输入，结合本地 Hybrid 搜索快速返回候选书签
 * 2. 支持失败降级与占位提示，确保用户体验稳定
 * 3. 将最终指令分流到直接打开书签或跳转管理页面
 */

import { logger } from '@/infrastructure/logging/logger'
import { searchAppService } from '@/application/search/search-app-service'
import type { SearchResult } from '@/infrastructure/indexeddb/manager'

const SUGGESTION_LIMIT = 6
const DEBOUNCE_MS = 300

/**
 * 注册 Omnibox 监听
 */
export function registerOmniboxHandlers(): void {
  if (!chrome?.omnibox?.setDefaultSuggestion) {
    logger.debug('Omnibox', '当前环境不支持 Omnibox，跳过注册')
    return
  }

  chrome.omnibox.setDefaultSuggestion({
    description: 'AcuityBookmarks：在地址栏中快速搜索书签'
  })

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0
  let lastSuggestions: chrome.omnibox.SuggestResult[] = []

  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const query = (text || '').trim()

    if (debounceTimer) clearTimeout(debounceTimer)

    if (!query) {
      safeSuggest(suggest, [], 'empty-input')
      lastSuggestions = []
      return
    }

    const placeholder: chrome.omnibox.SuggestResult = {
      content: query,
      description: '🔍 搜索中，请稍候…'
    }
    safeSuggest(suggest, [placeholder], 'placeholder')
    lastSuggestions = [placeholder]

    const currentSeq = ++sequence
    debounceTimer = setTimeout(async () => {
      try {
        const results = await searchAppService.search(query, {
          strategy: 'hybrid',
          limit: SUGGESTION_LIMIT
        })
        if (currentSeq !== sequence) return

        const suggestions = buildSuggestions(results)
        safeSuggest(suggest, suggestions, 'hybrid-results')
        lastSuggestions = suggestions
      } catch (error) {
        logger.warn('Omnibox', 'Hybrid 搜索失败，回退占位', error)
        if (currentSeq !== sequence) return
        safeSuggest(suggest, lastSuggestions, 'search-error-fallback')
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
 * 安全触发 suggest，避免上下文已失效时报错
 */
function safeSuggest(
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void,
  suggestions: chrome.omnibox.SuggestResult[],
  source: string
): void {
  try {
    suggest(suggestions)
  } catch (error) {
    logger.warn('Omnibox', `suggest 调用失败（${source}）`, error)
  }
}

/**
 * 将搜索结果映射为 Omnibox 候选项
 */
function buildSuggestions(
  results: SearchResult[]
): chrome.omnibox.SuggestResult[] {
  const uniqueByUrl = new Map<string, chrome.omnibox.SuggestResult>()

  for (const item of results) {
    const bookmark = item.bookmark
    const url = bookmark.url || ''
    const id = String(bookmark.id || '')
    const title = bookmark.title || url || '未命名书签'
    const description = url ? `${title} — ${url}` : title

    const meta = new URLSearchParams({
      id,
      title,
      source: 'omnibox',
      view: url ? 'open' : 'manage'
    })
    const content = url
      ? `${url}#${meta.toString()}`
      : `acuity://bookmark?${meta.toString()}`

    const suggestion: chrome.omnibox.SuggestResult = {
      content,
      description
    }

    const dedupeKey = url || id
    if (!dedupeKey || uniqueByUrl.has(dedupeKey)) continue
    uniqueByUrl.set(dedupeKey, suggestion)
  }

  return Array.from(uniqueByUrl.values())
}

interface ParsedSuggestion {
  url: string | null
  id: string | null
  view: 'open' | 'manage'
}

/**
 * 解析 suggestion.content 中附加的书签元信息
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
 * 跳转到管理页面，携带书签 ID 进行定位
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
