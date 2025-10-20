/* eslint-env browser */
/* global DOMParser */
/**
 * 离屏页面脚本（Offscreen Document）
 *
 * 作用：
 * - 在独立的不可见文档中执行 DOM 解析，避免在 Service Worker 中直接处理 HTML；
 * - 接收来自后台的 PARSE_HTML 消息，返回页面的标题、描述、OG 信息以及图标链接；
 * - 解析失败时返回空对象，调用方可回退到正则解析。
 */
;(() => {
  function getMeta(doc, name) {
    const el1 = doc.querySelector(`meta[name="${name}"]`)
    const el2 = doc.querySelector(`meta[property="${name}"]`)
    return (
      el1?.getAttribute('content') ||
      el2?.getAttribute('content') ||
      ''
    ).trim()
  }

  function parseHtml(html = '') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const title = (doc.querySelector('title')?.textContent || '').trim()
      const description =
        getMeta(doc, 'description') || getMeta(doc, 'og:description')
      const keywords = getMeta(doc, 'keywords')
      const ogTitle = getMeta(doc, 'og:title')
      const ogImage = getMeta(doc, 'og:image')
      const ogType = getMeta(doc, 'og:type')
      const iconEl = doc.querySelector(
        'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
      )
      const iconHref = iconEl?.getAttribute('href') || ''

      return {
        title,
        description,
        keywords,
        ogTitle,
        ogImage,
        ogType,
        iconHref
      }
    } catch {
      // 解析失败时返回空对象，由调用方决定后续降级策略
      return {}
    }
  }

  // 统一任务处理表，后续可以在此扩展搜索等任务
  const handlers = {
    PARSE_HTML: async payload => {
      const html = typeof payload?.html === 'string' ? payload.html : ''
      return parseHtml(html)
    }
    // SEARCH_QUERY: async payload => { ... }  // 后续阶段接入
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.__offscreenRequest__) return

    const handler = handlers[msg.type]

    ;(async () => {
      try {
        if (!handler) {
          sendResponse({ ok: false, error: `Unsupported task: ${msg.type}` })
          return
        }
        const result = await handler(msg.payload)
        sendResponse({ ok: true, result })
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })()

    return true
  })()
})()
