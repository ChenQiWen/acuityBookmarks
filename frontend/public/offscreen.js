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

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'PARSE_HTML') {
      try {
        const result = parseHtml(msg.html || '')
        sendResponse(result)
      } catch {
        // 任何异常都返回空对象以保证消息响应
        sendResponse({})
      }
      return true // 🔥 必须返回 true 以保持消息通道打开
    }
  })
})()
