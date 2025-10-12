/* eslint-env browser, webextensions */
const MIN_DOMAIN_INTERVAL_MS = 1000 // 1 second
const DOMAIN_LAST_REQ = new Map()
const ROBOTS_CACHE = new Map()

export function getDomainFromUrl(raw = '') {
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return ''
  }
}

async function waitForDomainSlot(domain) {
  const last = DOMAIN_LAST_REQ.get(domain) || 0
  const now = Date.now()
  const diff = now - last
  if (diff < MIN_DOMAIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_DOMAIN_INTERVAL_MS - diff))
  }
  DOMAIN_LAST_REQ.set(domain, Date.now())
}

async function robotsAllowed(url) {
  const domain = getDomainFromUrl(url)
  const cached = ROBOTS_CACHE.get(domain)
  if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
    return cached.allowedAll
  }
  try {
    const robotsUrl = `https://${domain}/robots.txt`
    const resp = await fetch(robotsUrl, { method: 'GET' })
    let allowedAll = true
    if (resp.ok) {
      const txt = await resp.text()
      // 极简解析：如存在 "User-agent: *" 且 "Disallow: /" 则拒绝
      if (/User-agent:\s*\*/i.test(txt) && /Disallow:\s*\//i.test(txt)) {
        allowedAll = false
      }
    }
    ROBOTS_CACHE.set(domain, { allowedAll, fetchedAt: Date.now() })
    return allowedAll
  } catch {
    // 获取robots失败则默认允许（与多数站点兼容）
    ROBOTS_CACHE.set(domain, { allowedAll: true, fetchedAt: Date.now() })
    return true
  }
}

async function createOffscreenDocument() {
  try {
    // 若已存在，则直接返回
    if (chrome.offscreen && (await chrome.offscreen.hasDocument())) return
  } catch {
    // hasDocument 在部分版本不可用，忽略错误
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Parse bookmark metadata from HTML'
    })
  } catch (err) {
    console.warn('Failed to create offscreen document:', err?.message || err)
  }
}

export async function extractMetaInOffscreen(html = '') {
  try {
    await createOffscreenDocument()
    return await new Promise(resolve => {
      try {
        let settled = false
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            resolve({})
          }
        }, 1500)

        chrome.runtime.sendMessage({ type: 'PARSE_HTML', html }, response => {
          try {
            if (chrome?.runtime?.lastError) {
              console.debug(
                '[page-fetcher] PARSE_HTML lastError:',
                chrome.runtime.lastError?.message
              )
              settled = true
              clearTimeout(timer)
              return resolve({})
            }
          } catch (err) {
            console.warn('PARSE_HTML response error:', err?.message || err)
          }
          settled = true
          clearTimeout(timer)
          resolve(response || {})
        })
      } catch {
        resolve({})
      }
    })
  } catch (err) {
    console.warn('Offscreen parsing failed, falling back to regex', err)
    return extractMetaFromHtml(html)
  }
}

function extractMetaFromHtml(html = '') {
  const pick = re => {
    const m = html.match(re)
    return m ? m[1].trim() : undefined
  }
  const title = pick(/<title[^>]*>([^<]*)<\/title>/i)
  const description = pick(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogTitle = pick(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogDescription = pick(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogImage = pick(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogSiteName = pick(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  return { title, description, ogTitle, ogDescription, ogImage, ogSiteName }
}

export async function fetchPageAndExtractOnce(url) {
  const domain = getDomainFromUrl(url)
  await waitForDomainSlot(domain)
  const robotsOk = await robotsAllowed(url)
  const started = Date.now()
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'AcuityBookmarks-Extension/1.0' }
    })
    const { status } = resp
    const finalUrl = resp.url || url
    let text = ''
    const ct = resp.headers.get('content-type') || ''
    if (/text\/html|application\/xhtml\+xml/i.test(ct)) {
      text = await resp.text()
    }
    const meta = await extractMetaInOffscreen(text).catch(() =>
      extractMetaFromHtml(text)
    )
    const statusGroup =
      status >= 500
        ? '5xx'
        : status >= 400
          ? '4xx'
          : status >= 300
            ? '3xx'
            : status >= 200
              ? '2xx'
              : 'error'

    return {
      finalUrl,
      httpStatus: status,
      statusGroup,
      robotsAllowed: robotsOk,
      meta,
      crawlDuration: Date.now() - started
    }
  } catch {
    return {
      finalUrl: url,
      httpStatus: 0,
      statusGroup: 'error',
      robotsAllowed: robotsOk,
      meta: {},
      errorClass: 'network',
      crawlDuration: Date.now() - started
    }
  }
}
