export function initializeOmnibox(
  bookmarkManager,
  logger,
  cloudflareGenerateEmbedding,
  vectorizeQueryDirect
) {
  const OMNIBOX_STRICT_MODE = false // Set to true to only show extension results

  function toOmniboxSuggestions(bookmarks, source) {
    return (bookmarks || []).map(b => {
      const url = b.url || ''
      const title = b.title || ''
      const id = b.id || ''
      const sourcePrefix = source ? `[${source}] ` : ''
      return {
        content: `${url}#id=${id}&title=${encodeURIComponent(title)}&source=omnibox&view=open`,
        description: `${sourcePrefix}${title}`
      }
    })
  }

  function dedupeSuggestions(suggestions) {
    const seen = new Set()
    return suggestions.filter(s => {
      const content = s.content.split('#')[0]
      if (seen.has(content)) {
        return false
      }
      seen.add(content)
      return true
    })
  }

  function formatSuggestionsForLog(suggestions) {
    return suggestions.map(s => s.description)
  }

  function safeSuggest(suggest, suggestions, source) {
    try {
      suggest(suggestions)
    } catch (e) {
      logger.warn(
        'ServiceWorker',
        `[Omnibox] safeSuggest from ${source} failed:`,
        e
      )
    }
  }

  async function keywordFallbackSearch(query, limit) {
    try {
      const out = await bookmarkManager.searchBookmarks(query, { limit })
      logger.info(
        'ServiceWorker',
        `[Omnibox] IndexedDB local search returned ${out.length} results`
      )
      return out
    } catch (e) {
      logger.warn(
        'ServiceWorker',
        '[Omnibox] Local keyword search exception:',
        e?.message || e
      )
      return []
    }
  }

  function openResultUrl(url = '', disposition = 'currentTab') {
    if (!url) return
    const active = disposition === 'newForegroundTab'
    if (disposition === 'currentTab') {
      chrome.tabs
        .update({ url })
        .catch(() => chrome.tabs.create({ url, active: true }))
      return
    }
    chrome.tabs.create({ url, active }).catch(() => {})
  }

  function parseOmniboxContent(text) {
    try {
      const url = new URL(text)
      const id = url.hash.includes('id=')
        ? url.hash.split('id=')[1].split('&')[0]
        : null
      const view = url.hash.includes('view=manage') ? 'manage' : 'open'
      return { url: url.href.split('#')[0], id, view }
    } catch {
      return { url: null, id: null, view: 'open' }
    }
  }

  if (chrome.omnibox && chrome.omnibox.setDefaultSuggestion) {
    chrome.omnibox.setDefaultSuggestion({
      description: 'AcuityBookmarks: Search your bookmarks'
    })

    let __omniboxDebounceTimer = null
    let __omniboxSeq = 0
    const __omniboxDebounceMs = 350
    let __lastOmniboxSuggestions = []

    chrome.omnibox.onInputChanged.addListener((text, suggest) => {
      try {
        const q = (text || '').trim()
        if (__omniboxDebounceTimer) {
          clearTimeout(__omniboxDebounceTimer)
        }
        if (!q) {
          safeSuggest(suggest, [], 'empty-query')
          logger.info(
            'ServiceWorker',
            '[Omnibox] Input and results (empty input)',
            { input: q, results: [] }
          )
          return
        }

        const __placeholder = OMNIBOX_STRICT_MODE
          ? []
          : [{ content: q || 'query', description: 'Searching...' }]
        if (!OMNIBOX_STRICT_MODE) {
          safeSuggest(suggest, __placeholder, 'placeholder-immediate')
          __lastOmniboxSuggestions = __placeholder
          logger.info('ServiceWorker', '[Omnibox] Input and placeholder', {
            input: q,
            results: formatSuggestionsForLog(__placeholder)
          })
        }

        if (!OMNIBOX_STRICT_MODE) {
          ;(async () => {
            try {
              const localNow = await keywordFallbackSearch(q, 6)
              const localNowSuggestions = toOmniboxSuggestions(
                localNow,
                'Local',
                q
              )
              safeSuggest(suggest, localNowSuggestions, 'local-immediate')
              if (localNowSuggestions.length > 0) {
                __lastOmniboxSuggestions = localNowSuggestions
              }
              logger.info(
                'ServiceWorker',
                '[Omnibox] Input and local results (immediate)',
                {
                  input: q,
                  results: formatSuggestionsForLog(localNowSuggestions)
                }
              )
            } catch (err) {
              logger.warn(
                'ServiceWorker',
                '[Omnibox] Immediate local search failed:',
                err?.message || err
              )
            }
          })()
        }

        const mySeq = ++__omniboxSeq
        const debounceMs = Math.min(__omniboxDebounceMs, 200)
        __omniboxDebounceTimer = setTimeout(async () => {
          try {
            if (!OMNIBOX_STRICT_MODE) {
              const local = await keywordFallbackSearch(q, 6)
              const localSuggestions = toOmniboxSuggestions(local, 'Local', q)
              logger.info(
                'ServiceWorker',
                '[Omnibox] Input and local results',
                { input: q, results: formatSuggestionsForLog(localSuggestions) }
              )
              safeSuggest(
                suggest,
                [
                  ...localSuggestions,
                  { content: q || 'query', description: 'AI Searching…' }
                ],
                'local+placeholder'
              )
              if (localSuggestions.length > 0) {
                __lastOmniboxSuggestions = localSuggestions
              }

              let cloud = []
              try {
                cloud = await vectorizeQueryDirect(q, 6)
              } catch {
                cloud = []
              }
              if (mySeq !== __omniboxSeq) return
              const cloudSuggestions = toOmniboxSuggestions(cloud, 'AI', q)
              const merged = dedupeSuggestions([
                ...localSuggestions,
                ...cloudSuggestions
              ])
              logger.info(
                'ServiceWorker',
                '[Omnibox] Input and merged results',
                { input: q, results: formatSuggestionsForLog(merged) }
              )
              safeSuggest(suggest, merged, 'merged')
              if (merged.length > 0) {
                __lastOmniboxSuggestions = merged
              }
            } else {
              let local = []
              try {
                local = await keywordFallbackSearch(q, 6)
              } catch {
                local = []
              }
              if (mySeq !== __omniboxSeq) return
              if (local.length > 0) {
                const localSuggestions = toOmniboxSuggestions(local, 'Local', q)
                logger.info(
                  'ServiceWorker',
                  '[Omnibox] Input and local results (strict)',
                  {
                    input: q,
                    results: formatSuggestionsForLog(localSuggestions)
                  }
                )
                safeSuggest(suggest, localSuggestions, 'strict-local')
                __lastOmniboxSuggestions = localSuggestions
              } else {
                let cloud = []
                try {
                  cloud = await vectorizeQueryDirect(q, 6)
                } catch {
                  cloud = []
                }
                if (mySeq !== __omniboxSeq) return
                const cloudSuggestions = toOmniboxSuggestions(cloud, 'AI', q)
                logger.info(
                  'ServiceWorker',
                  '[Omnibox] Input and cloud results (strict)',
                  {
                    input: q,
                    results: formatSuggestionsForLog(cloudSuggestions)
                  }
                )
                safeSuggest(suggest, cloudSuggestions, 'strict-cloud')
                if (cloudSuggestions.length > 0) {
                  __lastOmniboxSuggestions = cloudSuggestions
                } else {
                  safeSuggest(suggest, [], 'strict-empty')
                }
              }
            }
          } catch {
            if (mySeq !== __omniboxSeq) return
            const fallback =
              __lastOmniboxSuggestions.length > 0
                ? __lastOmniboxSuggestions
                : [
                    {
                      content: q || 'query',
                      description: 'Search error, please try again later…'
                    }
                  ]
            safeSuggest(suggest, fallback, 'error-fallback')
          }
        }, debounceMs)
      } catch {
        const q2 = (text || '').trim()
        const fallback =
          __lastOmniboxSuggestions.length > 0
            ? __lastOmniboxSuggestions
            : q2
              ? [
                  {
                    content: q2 || 'query',
                    description: 'Search error, please try again later…'
                  }
                ]
              : []
        safeSuggest(suggest, fallback, 'outer-error-fallback')
      }
    })

    chrome.omnibox.onInputEntered.addListener(async text => {
      const parsed = parseOmniboxContent(text)
      if (parsed.url) return openResultUrl(parsed.url, 'currentTab')
      if (parsed.id) {
        if (parsed.view === 'manage') {
          try {
            const managementUrl = `${chrome.runtime.getURL('management.html')}?id=${encodeURIComponent(parsed.id)}`
            await chrome.tabs.create({ url: managementUrl })
            return
          } catch {
            // Fallback to opening the bookmark directly
          }
        } else {
          try {
            const nodes = await chrome.bookmarks.get(parsed.id)
            const n = Array.isArray(nodes) ? nodes[0] : null
            const url = n?.url || ''
            if (url) return openResultUrl(url, 'currentTab')
          } catch {
            // Fallback for when bookmark is not found
          }
        }
        const isUrl = /^https?:\/\//i.test(text)
        if (isUrl) return openResultUrl(text, 'currentTab')
      }
    })
  }
}
