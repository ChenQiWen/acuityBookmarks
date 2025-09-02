import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import WebCrawler from '../utils/web-crawler.js';

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

  // Smart search: Use AI-powered search for intelligent results
  else if (mode === 'smart') {
    // Use AI search function for better results
    return await aiSearchBookmarks(query, bookmarks);
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

/**
 * AI-powered search using Google Gemini to match webpage content
 * @param {string} query - Natural language search query
 * @param {Array} bookmarks - Array of bookmark objects
 * @returns {Promise<Object>} AI-enhanced search results based on webpage content
 */
export async function aiSearchBookmarks(query, bookmarks, progressCallback = null) {
  const stats = {
    totalBookmarks: bookmarks.length,
    processedBookmarks: 0,
    searchTime: Date.now(),
    aiProcessingTime: 0,
    contentFetchTime: 0,
    keywords: [],
    searchStrategy: '网页内容智能匹配'
  };

  try {
    console.log('🤖 开始AI搜索:', query);

    // Step 1: Extract all URLs from bookmarks
    const urls = bookmarks
      .map(bookmark => bookmark.url)
      .filter(url => url && typeof url === 'string' && url.trim().length > 0);

    if (urls.length === 0) {
      return {
        results: [],
        stats: stats,
        mode: 'smart',
        query: query,
        message: '没有找到有效的书签URL'
      };
    }

    // Step 2: Batch crawl webpage content using cache
    console.log(`📄 正在获取 ${urls.length} 个网页的内容...`);
    progressCallback?.({ current: 0, total: urls.length, stage: 'crawling', message: '正在获取网页内容...' });

    const contentFetchStart = Date.now();

    const crawler = new WebCrawler();
    const webpageContents = await crawler.crawlBatch(urls);

    stats.contentFetchTime = Date.now() - contentFetchStart;
    console.log(`✅ 网页内容获取完成，耗时 ${stats.contentFetchTime}ms`);

    progressCallback?.({ current: urls.length, total: urls.length, stage: 'analyzing', message: '正在AI分析内容...' });

    // Step 3: Use AI to analyze each webpage content against the query
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const matchedBookmarks = [];
    const scoredResults = [];

    console.log('🧠 开始AI内容匹配分析...');

    for (let i = 0; i < webpageContents.length; i++) {
      const webpageInfo = webpageContents[i];
      if (!webpageInfo || !webpageInfo.success) continue;

      const bookmark = bookmarks.find(b => b.url === webpageInfo.url);
      if (!bookmark) continue;

      stats.processedBookmarks++;

      // Update progress
      progressCallback?.({
        current: stats.processedBookmarks,
        total: webpageContents.length,
        stage: 'analyzing',
        message: `正在分析网页 ${stats.processedBookmarks}/${webpageContents.length}...`
      });

      try {
        // Use AI to analyze relevance between query and webpage content
        const aiPrompt = `请分析用户查询与网页内容的匹配度。

**用户查询:** "${query}"

**网页信息:**
- 标题: ${webpageInfo.title || '无标题'}
- 描述: ${webpageInfo.description || '无描述'}
- 主要内容: ${webpageInfo.content || '无内容'}

**分析要求:**
1. 判断网页内容是否与用户查询相关
2. 给出匹配度评分 (0-10分，10分为完全匹配)
3. 说明匹配的原因
4. 提取相关的关键词片段

**返回格式:**
{
  "relevanceScore": 0-10之间的数字,
  "isRelevant": true或false,
  "matchReasons": ["原因1", "原因2"],
  "matchedKeywords": ["关键词1", "关键词2"]
}

只返回JSON格式，不要其他文字。`;

        const aiStartTime = Date.now();
        const aiResult = await model.generateContent(aiPrompt);
        const aiResponse = await aiResult.response.text();
        const aiProcessingTime = Date.now() - aiStartTime;

        stats.aiProcessingTime += aiProcessingTime;

        // Parse AI response
        let analysis;
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in AI response');
          }
        } catch (parseError) {
          console.warn(`❌ 解析AI响应失败 for ${webpageInfo.url}:`, parseError);
          analysis = {
            relevanceScore: 0,
            isRelevant: false,
            matchReasons: ['AI分析失败'],
            matchedKeywords: []
          };
        }

        // Only include relevant results
        if (analysis.isRelevant && analysis.relevanceScore >= 3) {
          scoredResults.push({
            bookmark: bookmark,
            score: analysis.relevanceScore,
            matchReasons: analysis.matchReasons || [],
            aiAnalysis: {
              intent: `在网页内容中搜索"${query}"`,
              matchedKeywords: analysis.matchedKeywords || [],
              contentSnippet: webpageInfo.content ? webpageInfo.content.substring(0, 100) + '...' : '',
              webpageInfo: {
                title: webpageInfo.title,
                description: webpageInfo.description,
                hasContent: !!webpageInfo.content
              }
            }
          });
        }

      } catch (aiError) {
        console.warn(`❌ AI分析失败 for ${webpageInfo.url}:`, aiError.message);
        // Continue with other bookmarks even if one fails
      }
    }

    console.log(`✅ AI分析完成，处理了 ${stats.processedBookmarks} 个书签`);

    // Update progress to complete
    progressCallback?.({
      current: webpageContents.length,
      total: webpageContents.length,
      stage: 'complete',
      message: '正在整理结果...'
    });

    // Step 4: Sort by relevance score and return top results
    scoredResults.sort((a, b) => b.score - a.score);
    const topResults = scoredResults.slice(0, 10); // Limit to top 10 results

    // Convert back to bookmark format
    for (const result of topResults) {
      matchedBookmarks.push({
        ...result.bookmark,
        _aiScore: result.score,
        _matchReasons: result.matchReasons,
        _aiAnalysis: result.aiAnalysis,
        _contentMatched: true
      });
    }

    stats.searchTime = Date.now() - stats.searchTime;

    console.log(`🎯 AI搜索完成，找到 ${matchedBookmarks.length} 个相关结果`);

    return {
      results: matchedBookmarks,
      stats: stats,
      mode: 'smart',
      query: query,
      message: matchedBookmarks.length > 0 ? `基于网页内容找到 ${matchedBookmarks.length} 个匹配结果` : '未找到网页内容匹配的结果'
    };

  } catch (error) {
    console.error('❌ AI搜索失败:', error);

    // Fallback to fast search if AI fails
    console.log('🔄 切换到快速搜索模式...');
    return searchBookmarks(query, bookmarks, 'fast');
  }
}


