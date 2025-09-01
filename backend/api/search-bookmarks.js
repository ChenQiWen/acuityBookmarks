import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

/**
 * Search bookmarks based on different modes
 * @param {string} query - Search query
 * @param {Array} bookmarks - Array of bookmark objects
 * @param {string} mode - Search mode: 'fast', 'smart', or 'content'
 * @returns {Promise<Object>} Search results with stats
 */
export async function searchBookmarks(query, bookmarks, mode = 'fast') {
  const lowerCaseQuery = query.toLowerCase().trim();
  const matchedBookmarks = [];
  const stats = {
    totalBookmarks: bookmarks.length,
    processedBookmarks: 0,
    networkRequests: 0,
    searchTime: Date.now()
  };

  // Validate inputs
  if (!query || typeof query !== 'string' || !Array.isArray(bookmarks)) {
    throw new Error('Invalid search parameters');
  }

  // Fast search: Only check title and URL
  if (mode === 'fast') {
    for (const bookmark of bookmarks) {
      stats.processedBookmarks++;

      if (!bookmark.url) continue;

      const title = bookmark.title || '';
      const url = bookmark.url || '';

      // Check title and URL
      if (title.toLowerCase().includes(lowerCaseQuery) ||
          url.toLowerCase().includes(lowerCaseQuery)) {
        matchedBookmarks.push(bookmark);
      }
    }
  }

  // Smart search: Use fuzzy matching and basic content analysis
  else if (mode === 'smart') {
    const keywords = lowerCaseQuery.split(/\s+/).filter(k => k.length > 1);

    for (const bookmark of bookmarks) {
      stats.processedBookmarks++;

      if (!bookmark.url) continue;

      const title = bookmark.title || '';
      const url = bookmark.url || '';

      // Exact matches get higher priority
      if (title.toLowerCase().includes(lowerCaseQuery) ||
          url.toLowerCase().includes(lowerCaseQuery)) {
        matchedBookmarks.push(bookmark);
        continue;
      }

      // Fuzzy matching with keywords
      let score = 0;
      for (const keyword of keywords) {
        if (title.toLowerCase().includes(keyword)) score += 2;
        if (url.toLowerCase().includes(keyword)) score += 1;
      }

      // If score is high enough, include in results
      if (score >= Math.min(keywords.length, 2)) {
        matchedBookmarks.push(bookmark);
      }
    }
  }

  // Content search: Full web scraping and content analysis
  else if (mode === 'content') {
    for (const bookmark of bookmarks) {
      stats.processedBookmarks++;

      if (!bookmark.url) continue;

      const title = bookmark.title || '';
      const url = bookmark.url || '';

      // First check title and URL
      if (title.toLowerCase().includes(lowerCaseQuery) ||
          url.toLowerCase().includes(lowerCaseQuery)) {
        matchedBookmarks.push(bookmark);
        continue;
      }

      // Then check website content
      try {
        stats.networkRequests++;
        const response = await fetch(bookmark.url, {
          timeout: 5000, // 5 second timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AcuityBookmarks/1.0)'
          }
        });

        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract text content from body
        try {
          const bodyElement = $('body');
          if (bodyElement.length === 0) {
            continue;
          }

          const bodyText = bodyElement.text();
          if (bodyText && typeof bodyText === 'string') {
            const trimmedText = bodyText.trim();
            if (trimmedText) {
              const lowerBodyText = trimmedText.toLowerCase();
              if (lowerBodyText.includes && typeof lowerBodyText.includes === 'function') {
                if (lowerBodyText.includes(lowerCaseQuery)) {
                  matchedBookmarks.push(bookmark);
                  continue;
                }
              }
            }
          }
        } catch (parseError) {
          // Silently handle parsing errors, continue with other checks
        }

        // Check meta description
        try {
          const metaElement = $('meta[name="description"], meta[property="og:description"]').first();
          const metaDesc = metaElement.attr('content');

          if (metaDesc && typeof metaDesc === 'string') {
            const trimmedMeta = metaDesc.trim();
            if (trimmedMeta) {
              const lowerMeta = trimmedMeta.toLowerCase();
              if (lowerMeta.includes && typeof lowerMeta.includes === 'function') {
                if (lowerMeta.includes(lowerCaseQuery)) {
                  matchedBookmarks.push(bookmark);
                  continue;
                }
              }
            }
          }
        } catch (metaError) {
          // Silently handle meta parsing errors
        }

        // Check title tag if not already checked
        try {
          const titleElement = $('title');
          if (titleElement.length > 0) {
            const pageTitle = titleElement.text();

            if (pageTitle && typeof pageTitle === 'string') {
              const trimmedTitle = pageTitle.trim();
              if (trimmedTitle) {
                const lowerTitle = trimmedTitle.toLowerCase();
                if (lowerTitle.includes && typeof lowerTitle.includes === 'function') {
                  if (lowerTitle.includes(lowerCaseQuery)) {
                    matchedBookmarks.push(bookmark);
                  }
                }
              }
            }
          }
        } catch (titleError) {
          // Silently handle title parsing errors
        }

      } catch (error) {
        console.error(`Error fetching ${bookmark.url}:`, error.message);
        // Continue with other bookmarks even if one fails
      }
    }
  }

  stats.searchTime = Date.now() - stats.searchTime;

  return {
    results: matchedBookmarks,
    stats: stats,
    mode: mode,
    query: query
  };
}
