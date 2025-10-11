/*
 * Bookmark Preprocessor Web Worker
 * - Offloads heavy string processing and field derivation to a worker
 */

// eslint-disable-next-line no-undef
self.onmessage = async e => {
  const { type, data } = e.data || {}

  if (type === 'PREPROCESS_BOOKMARKS' && Array.isArray(data)) {
    try {
      const processed = data.map(bookmark => ({
        ...bookmark,
        titleLower: (bookmark.title || '').toLowerCase(),
        urlLower: (bookmark.url || '').toLowerCase(),
        domain: extractDomain(bookmark.url),
        keywords: extractKeywords(bookmark.title, bookmark.url),
        tags: normalizeTags(bookmark.tags)
      }))

      // eslint-disable-next-line no-undef
      self.postMessage({ type: 'PROCESSED', data: processed })
    } catch (err) {
      // eslint-disable-next-line no-undef
      self.postMessage({
        type: 'ERROR',
        error: String(err && err.message ? err.message : err)
      })
    }
  }
}

function extractDomain(url) {
  if (!url || typeof url !== 'string') return ''
  try {
    const u = new URL(url)
    return u.hostname || ''
  } catch {
    const m = /^https?:\/\/([^/]+)/.exec(url)
    return m ? m[1] : ''
  }
}

function normalizeTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags))
    return tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
  if (typeof tags === 'string')
    return tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
  return []
}

function extractKeywords(title, url) {
  const words = []
  const pushWords = s => {
    if (!s) return
    String(s)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .forEach(w => words.push(w))
  }
  pushWords(title)
  pushWords(url)
  return Array.from(new Set(words)).slice(0, 32) // cap to avoid oversized records
}
