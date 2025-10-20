import type { PageMetadata } from '@/services/local-crawler-worker'

/**
 * 使用 DOMParser 提取页面基础元数据。
 * 仅返回爬虫需要的关键字段，避免在 Offscreen 中做过重处理。
 */
export function parseHtml(html: string): Partial<PageMetadata> {
  const normalizedHtml = typeof html === 'string' ? html : ''
  if (!normalizedHtml.trim()) {
    return {}
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(normalizedHtml, 'text/html')

    const getMeta = (name: string) =>
      (
        doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ??
        doc
          .querySelector(`meta[property="${name}"]`)
          ?.getAttribute('content') ??
        ''
      ).trim()

    const title = (doc.querySelector('title')?.textContent ?? '').trim()
    const description =
      getMeta('description') || getMeta('og:description') || ''
    const keywords = getMeta('keywords')
    const ogTitle = getMeta('og:title')
    const ogDescription = getMeta('og:description')
    const ogImage = getMeta('og:image')
    const ogType = getMeta('og:type')
    const iconHref =
      doc
        .querySelector(
          'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
        )
        ?.getAttribute('href') ?? ''
    const language =
      doc.querySelector('html')?.getAttribute('lang')?.trim().toLowerCase() ??
      ''
    const author = getMeta('author')

    return {
      title,
      description,
      keywords,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      iconHref,
      lang: language,
      author
    }
  } catch {
    // DOMParser 解析失败时回退为空对象，由调用方负责降级处理。
    return {}
  }
}
