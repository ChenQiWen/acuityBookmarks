/**
 * AcuityBookmarks 后端服务 - 纯Bun原生实现
 * 完全移除Node.js依赖，充分利用Bun性能优势
 * 集成智能爬虫功能
 */

import { v4 as uuidv4 } from 'uuid';
import { getJob, setJob } from './utils/job-store.js';
import { z } from 'zod';

// === 配置 ===
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const isDevelopment = process.env.NODE_ENV !== 'production';
const DEBUG_MINIMAL = process.env.DEBUG_MINIMAL === '1';

// 简易速率限制（每窗口限制请求数）
const RATE_LIMIT = { windowMs: 60_000, max: isDevelopment ? 300 : 120 };
const rateBuckets = new Map();

function isRateLimited(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= RATE_LIMIT.windowMs) {
    rateBuckets.set(key, { count: 1, start: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT.max;
}

console.log(`🔥 启动Bun原生服务器 (${isDevelopment ? '开发' : '生产'}模式)`);

// === 精简的数据验证模式 ===
const CrawlRequestSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  dateAdded: z.number().optional(),
  parentId: z.string().optional(),
  config: z.object({
    timeout: z.number().min(1000).max(10000).default(5000), // 简化为只有超时配置
    userAgent: z.string().optional()
  }).default({})
});

// === 随机User-Agent池 - 绕过反爬虫检测 ===
function getRandomUserAgent() {
  const userAgents = [
    // Chrome (Windows 11)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',

    // Chrome (macOS)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    // Safari (macOS)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',

    // Firefox (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',

    // Firefox (macOS)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/119.0',

    // Edge (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
  ];

  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// === 已移除Metascraper，使用Bun HTMLRewriter ===

// === 轻量级爬虫核心 (Bun HTMLRewriter) - 带重试机制 ===
async function crawlLightweightMetadata(url, config = {}) {
  const timeout = config.timeout || 8000; // 增加到8秒超时
  const maxRetries = 3; // 最大重试3次
  const retryDelay = 1000; // 重试延迟1秒

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const userAgent = getRandomUserAgent(); // 每次重试使用不同的User-Agent

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 🎭 完全模拟真实浏览器的请求头
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Sec-Ch-Ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Upgrade-Insecure-Requests': '1',
          'Connection': 'keep-alive'
        },
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      // 🎯 检查响应状态，404/403/500等需要重试
      if (!response.ok) {
        const statusCode = response.status;
        const shouldRetry = [404, 403, 500, 502, 503, 504].includes(statusCode);

        if (shouldRetry && attempt < maxRetries) {
          console.warn(`⚠️ [AntiBot] 尝试${attempt}: HTTP ${statusCode} ${url} - ${retryDelay * attempt}ms后重试`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue; // 重试下一次
        }
        throw new Error(`HTTP ${statusCode}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Not HTML content: ${contentType}`);
      }

      // 解析HTML（前16KB）以提取元数据，避免依赖HTMLRewriter
      const html = await response.text();
      const limitedHtml = html.slice(0, 16384);

      const metadata = {
        title: '',
        description: '',
        keywords: '',
        ogTitle: '',
        ogDescription: '',
        ogImage: '',
        ogSiteName: '',
        finalUrl: response.url,
        lastModified: response.headers.get('last-modified') || ''
      };

      // 提取 <title>
      const titleMatch = limitedHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
      metadata.title = titleMatch?.[1]?.trim() || '';

      // 通用meta提取函数
      const getMeta = (attr, value) => {
        const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
        const m = limitedHtml.match(re);
        return m?.[1]?.trim() || '';
      };

      metadata.description = getMeta('name', 'description').substring(0, 500);
      metadata.keywords = getMeta('name', 'keywords').substring(0, 300);
      metadata.ogTitle = getMeta('property', 'og:title');
      metadata.ogDescription = getMeta('property', 'og:description').substring(0, 500);
      metadata.ogImage = getMeta('property', 'og:image');
      metadata.ogSiteName = getMeta('property', 'og:site_name');

      // ✅ 成功获取数据，返回结果
      if (attempt > 1) {
        console.log(`✅ [AntiBot] 重试成功: ${url} (尝试${attempt}次)`);
      }

      return {
        status: response.status,
        finalUrl: response.url,
        lastModified: response.headers.get('last-modified'),
        ...metadata
      };

    } catch (error) {
      clearTimeout(timeoutId);

      // 🔄 判断是否需要重试
      const isRetryableError =
        error.name === 'AbortError' ||
        error.message.includes('timeout') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('network');

      if (isRetryableError && attempt < maxRetries) {
        console.warn(`⚠️ [AntiBot] 尝试${attempt}: ${error.message} - ${url} - ${retryDelay * attempt}ms后重试`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        continue; // 重试下一次
      }

      // 📢 记录最终失败
      if (attempt === maxRetries) {
        console.error(`❌ [AntiBot] 最终失败: ${url} (尝试${maxRetries}次) - ${error.message}`);
      }

      throw error;
    }
  }

  // 理论上不会到这里，但为了类型安全
  throw new Error(`所有${maxRetries}次重试都失败: ${url}`);
}

// === 数据结构定义 ===
// 与Chrome书签数据对应的轻量级元数据结构：
// {
//   // Chrome书签字段对应
//   id: string,              // Chrome书签ID
//   url: string,             // Chrome书签URL
//   title: string,           // Chrome书签标题
//
//   // 爬取增强字段
//   extractedTitle: string,     // 网页实际标题
//   description: string,        // meta description
//   ogTitle: string,           // Open Graph标题
//   ogDescription: string,     // Open Graph描述
//   ogImage: string,           // Open Graph图片
//
//   // 缓存管理字段
//   lastCrawled: number,       // 最后爬取时间
//   crawlSuccess: boolean,     // 爬取是否成功
//   expiresAt: number,        // 过期时间（30天后）
//   crawlCount: number,       // 爬取次数
//   finalUrl: string,         // 最终URL（处理重定向）
//   lastModified: string      // HTTP Last-Modified
// }

// === 精简的书签爬取函数 ===
async function crawlBookmark(bookmark, config = {}) {
  const startTime = Date.now();
  console.log(`🚀 [Crawler] 开始爬取: ${bookmark.url}`);

  const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30天缓存

  try {
    // 使用轻量级爬虫获取元数据
    const metadata = await crawlLightweightMetadata(bookmark.url, config);
    console.log(`📄 [Crawler] 元数据提取成功: ${bookmark.url} (${Date.now() - startTime}ms)`);

    // 构建与Chrome书签对应的数据结构
    const bookmarkMetadata = {
      // Chrome书签字段对应
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title || '',
      dateAdded: bookmark.dateAdded || Date.now(),
      dateLastUsed: bookmark.dateLastUsed,
      parentId: bookmark.parentId,

      // 爬取增强字段
      extractedTitle: metadata.title || '',
      description: metadata.description || '',
      keywords: metadata.keywords || '',  // 🎯 关键词数据，LLM分析的黄金字段
      ogTitle: metadata.ogTitle || '',
      ogDescription: metadata.ogDescription || '',
      ogImage: metadata.ogImage || '',
      ogSiteName: metadata.ogSiteName || '',

      // 缓存管理字段
      lastCrawled: Date.now(),
      crawlSuccess: true,
      expiresAt: Date.now() + CACHE_DURATION,
      crawlCount: 1,
      finalUrl: metadata.finalUrl || bookmark.url,
      lastModified: metadata.lastModified || '',

      // 爬取状态（保持兼容性）
      crawlStatus: {
        lastCrawled: Date.now(),
        status: 'success',
        crawlDuration: Date.now() - startTime,
        version: 2, // 新版本轻量级爬虫
        source: 'bun-native-lightweight',
        finalUrl: metadata.finalUrl,
        httpStatus: metadata.status
      }
    };

    console.log(`✅ [Crawler] 爬取完成: ${bookmark.url} (${Date.now() - startTime}ms)`);
    return bookmarkMetadata;

  } catch (error) {
    console.error(`❌ [Crawler] 爬取失败: ${bookmark.url}`, error);

    // 失败时返回基础数据结构
    return {
      // Chrome书签字段对应
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title || '',
      dateAdded: bookmark.dateAdded || Date.now(),
      parentId: bookmark.parentId,

      // 空的增强字段
      extractedTitle: '',
      description: '',
      keywords: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      ogSiteName: '',

      // 失败的缓存字段
      lastCrawled: Date.now(),
      crawlSuccess: false,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 失败后24小时重试
      crawlCount: 1,
      finalUrl: bookmark.url,
      lastModified: '',

      // 失败状态
      crawlStatus: {
        lastCrawled: Date.now(),
        status: 'failed',
        error: error.message,
        crawlDuration: Date.now() - startTime,
        version: 2,
        source: 'bun-native-lightweight'
      }
    };
  }
}

// === 启动Bun原生服务器 ===
const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  development: isDevelopment,

  async fetch(req) {
    const startTime = performance.now();
    try {
      if (DEBUG_MINIMAL) {
        console.log('🧪 [Debug] 使用最小响应路径');
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      let url;
      try {
        url = new URL(req.url);
      } catch {
        url = new URL(req.url, `http://${server.hostname}:${server.port}`);
      }
      console.log(`➡️ [Fetch] ${req.method} ${url.pathname}`);

      // 基于IP或Origin的简单速率限制
      const clientKey = req.headers.get('x-forwarded-for') || req.headers.get('origin') || req.headers.get('host') || 'unknown';
      if (isRateLimited(clientKey)) {
        return new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      const response = await handleRequest(url, req);
      console.log(`✅ [Fetch] 响应状态: ${response.status}`);

      // 暂时不附加额外头部，直接返回原始响应以确保稳定
      return response;
    } catch (error) {
      console.error('🚨 服务器错误:', error);
      return createErrorResponse('Internal server error', 500);
    }
  },
  error(error) {
    console.error('🔴 Bun服务器错误:', error);
    console.error('📄 错误堆栈:', error && error.stack ? error.stack : 'no stack');
    return new Response(JSON.stringify({ error: 'Server Error', message: String(error && error.message || error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

console.log(`🚀 服务器运行在 http://${HOST}:${PORT}`);
console.log(`🛰️ 实际监听: host=${server.hostname} port=${server.port}`);

// === 主要请求处理 ===
async function handleRequest(url, req) {
  const path = url.pathname;
  const { method } = req;
  console.log(`➡️ [Router] 目标路径: ${path}, 方法: ${method}`);

  // 设置CORS
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // 处理预检请求
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // 路由分发
  if (path.startsWith('/api/')) {
    return await handleApiRoutes(url, req, corsHeaders);
  } else if (path === '/health') {
    return await handleHealthCheck(corsHeaders);
  } else if (path === '/ping') {
    return new Response('pong', { status: 200, headers: { 'Content-Type': 'text/plain', ...corsHeaders } });
  }

  // 404
  return createErrorResponse('Not Found', 404, corsHeaders);
}

// === API路由处理 ===
async function handleApiRoutes(url, req, corsHeaders) {
  const path = url.pathname;
  const { method: _method } = req;

  try {
    switch (path) {
    case '/api/start-processing':
      return await handleStartProcessing(req, corsHeaders);

    case '/api/get-progress':
      return await handleGetProgress(url, corsHeaders);

    case '/api/check-urls':
      return await handleCheckUrls(req, corsHeaders);

    case '/api/classify-single':
      return await handleClassifySingle(req, corsHeaders);

    case '/api/health':
      return await handleHealthCheck(corsHeaders);

      // === 智能爬虫端点 ===
    case '/api/crawl':
      return await handleCrawlBookmark(req, corsHeaders);

    case '/api/crawl/batch':
      return await handleBatchCrawl(req, corsHeaders);

    case '/api/crawl/health':
      return await handleCrawlerHealth(corsHeaders);

    default:
      // 处理带参数的路由
      if (path.startsWith('/api/get-progress/')) {
        const jobId = path.split('/').pop();
        return await handleGetProgressById(jobId, corsHeaders);
      }

      return createErrorResponse('API endpoint not found', 404, corsHeaders);
    }
  } catch (error) {
    console.error('API处理错误:', error);
    return createErrorResponse('API request failed', 500, corsHeaders);
  }
}

// === API处理函数 ===
async function handleStartProcessing(req, corsHeaders) {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    const data = await req.json();
    const jobId = uuidv4();

    // 先写入初始任务状态，避免立即查询时不存在
    await setJob(jobId, {
      id: jobId,
      status: 'queued',
      progress: 0,
      startTime: new Date().toISOString(),
      message: 'Queued',
      data
    });

    // 启动异步处理（不阻塞当前请求）
    processBookmarksAsync(jobId, data);

    return createJsonResponse({
      jobId,
      status: 'started',
      message: 'Processing started successfully'
    }, corsHeaders);
  } catch (_error) {
    return createErrorResponse('Invalid request data', 400, corsHeaders);
  }
}

async function handleGetProgress(url, corsHeaders) {
  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return createErrorResponse('Missing jobId parameter', 400, corsHeaders);
  }

  return await handleGetProgressById(jobId, corsHeaders);
}

async function handleGetProgressById(jobId, corsHeaders) {
  try {
    const job = await getJob(jobId);
    if (!job) {
      return createErrorResponse('Job not found', 404, corsHeaders);
    }

    return createJsonResponse(job, corsHeaders);
  } catch (_error) {
    return createErrorResponse('Failed to get job progress', 500, corsHeaders);
  }
}

async function handleCheckUrls(req, corsHeaders) {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    const { urls, settings = {} } = await req.json();

    if (!Array.isArray(urls)) {
      return createErrorResponse('urls must be an array', 400, corsHeaders);
    }

    // 使用Bun原生并发处理
    const results = await checkUrlsConcurrent(urls, settings);

    return createJsonResponse({
      results,
      total: urls.length,
      processed: results.length
    }, corsHeaders);
  } catch (_error) {
    return createErrorResponse('Invalid request data', 400, corsHeaders);
  }
}

async function handleClassifySingle(req, corsHeaders) {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    const { bookmark } = await req.json();

    if (!bookmark || !bookmark.url || !bookmark.title) {
      return createErrorResponse('Invalid bookmark data', 400, corsHeaders);
    }

    const result = await classifyBookmark(bookmark);

    return createJsonResponse(result, corsHeaders);
  } catch (_error) {
    return createErrorResponse('Classification failed', 500, corsHeaders);
  }
}

function handleHealthCheck(corsHeaders) {
  console.log('✅ [Health] 路由已触达');

  // 尝试读取内存信息，兼容不同运行时
  let memory;
  try {
    const memoryUsage = process.memoryUsage && process.memoryUsage();
    if (memoryUsage) {
      memory = {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      };
    } else {
      memory = { rss: 'n/a', heapUsed: 'n/a', heapTotal: 'n/a' };
    }
  } catch {
    memory = { rss: 'n/a', heapUsed: 'n/a', heapTotal: 'n/a' };
  }

  return createJsonResponse({
    status: 'ok',
    server: 'Bun-Native',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: typeof process.uptime === 'function' ? process.uptime() : 'n/a',
    memory,
    performance: {
      platform: typeof process.platform === 'string' ? process.platform : 'n/a',
      arch: typeof process.arch === 'string' ? process.arch : 'n/a',
      runtime: 'Bun'
    }
  }, corsHeaders);
}

// === 爬虫API处理函数 ===
async function handleCrawlBookmark(req, corsHeaders) {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    const body = await req.json();
    console.log('📥 [API] 收到爬虫请求:', body);

    // 验证请求数据
    const validatedData = CrawlRequestSchema.parse(body);
    console.log('✅ [API] 数据验证通过');

    // 执行爬虫任务
    const result = await crawlBookmark(validatedData, validatedData.config);

    return createJsonResponse({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }, corsHeaders);

  } catch (error) {
    console.error('❌ [API] 爬虫请求处理失败:', error);

    if (error.name === 'ZodError') {
      return createJsonResponse({
        success: false,
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
        timestamp: new Date().toISOString()
      }, corsHeaders, 400);
    }

    return createJsonResponse({
      success: false,
      error: 'Crawl Failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, corsHeaders, 500);
  }
}

async function handleBatchCrawl(req, corsHeaders) {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    const body = await req.json();
    const { bookmarks, config = {} } = body;

    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return createJsonResponse({
        success: false,
        error: 'Invalid Input',
        message: 'bookmarks must be a non-empty array'
      }, corsHeaders, 400);
    }

    if (bookmarks.length > 20) { // Bun 原生可以处理更多
      return createJsonResponse({
        success: false,
        error: 'Batch Size Limit',
        message: 'Maximum 20 bookmarks per batch request'
      }, corsHeaders, 400);
    }

    console.log(`📥 [API] 收到批量爬虫请求: ${bookmarks.length} 个书签`);

    const results = [];
    const errors = [];

    // Bun 原生并发处理，性能更好
    const concurrency = 5;
    for (let i = 0; i < bookmarks.length; i += concurrency) {
      const batch = bookmarks.slice(i, i + concurrency);
      const batchPromises = batch.map(async (bookmark, index) => {
        try {
          const validatedBookmark = CrawlRequestSchema.parse(bookmark);
          const result = await crawlBookmark(validatedBookmark, config);
          return { index: i + index, success: true, data: result };
        } catch (error) {
          console.error(`❌ [API] 批量爬虫失败 (${i + index}):`, error);
          return {
            index: i + index,
            success: false,
            error: error.message,
            bookmarkId: bookmark.id || 'unknown'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push(result);
        }
      }
    }

    console.log(`✅ [API] 批量爬虫完成: ${results.length} 成功, ${errors.length} 失败`);

    return createJsonResponse({
      success: true,
      data: {
        results,
        summary: {
          total: bookmarks.length,
          successful: results.length,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined
        }
      },
      timestamp: new Date().toISOString()
    }, corsHeaders);

  } catch (error) {
    console.error('❌ [API] 批量爬虫请求处理失败:', error);

    return createJsonResponse({
      success: false,
      error: 'Batch Crawl Failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, corsHeaders, 500);
  }
}

async function handleCrawlerHealth(corsHeaders) {
  try {
    // 测试爬虫功能
    const testUrl = 'https://httpbin.org/html';
    const testBookmark = {
      id: 'health-check',
      title: 'Health Check',
      url: testUrl,
      config: {
        timeout: 5000,
        enableMetadata: true,
        enableSocialMetadata: false,
        enableContentAnalysis: false
      }
    };

    const startTime = Date.now();
    const result = await crawlBookmark(testBookmark, testBookmark.config);
    const duration = Date.now() - startTime;

    const isHealthy = result.crawlStatus.status === 'success';

    return createJsonResponse({
      status: isHealthy ? 'healthy' : 'unhealthy',
      crawler: {
        available: true,
        responseTime: duration,
        lastCheck: new Date().toISOString(),
        testResult: {
          url: testUrl,
          status: result.crawlStatus.status,
          duration: result.crawlStatus.crawlDuration
        }
      },
      capabilities: {
        metadata: true,
        socialMetadata: true,
        contentAnalysis: true,
        technicalAnalysis: true,
        batchProcessing: true,
        maxBatchSize: 20,
        maxTimeout: 30000,
        runtime: 'bun-native'
      },
      timestamp: new Date().toISOString()
    }, corsHeaders, isHealthy ? 200 : 503);

  } catch (error) {
    console.error('❌ [API] 爬虫健康检查失败:', error);

    return createJsonResponse({
      status: 'unhealthy',
      crawler: {
        available: false,
        error: error.message,
        lastCheck: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    }, corsHeaders, 503);
  }
}

// === 核心业务逻辑 ===
async function checkUrlsConcurrent(urls, settings) {
  const timeout = settings.timeout || 5000;
  const userAgent = settings.userAgent || 'AcuityBookmarks/1.0';

  // Bun原生并发优势
  const results = await Promise.allSettled(
    urls.map(async (urlInfo) => {
      const url = typeof urlInfo === 'string' ? urlInfo : urlInfo.url;
      const id = typeof urlInfo === 'object' ? urlInfo.id : url;

      try {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': userAgent,
            'Accept': '*/*'
          }
        });

        // 某些站点不支持HEAD，回退到GET（仅请求首字节）
        if (response.status === 405 || response.status === 501) {
          clearTimeout(timeoutId);

          const controllerGet = new AbortController();
          const timeoutIdGet = setTimeout(() => controllerGet.abort(), timeout);

          response = await fetch(url, {
            method: 'GET',
            signal: controllerGet.signal,
            headers: {
              'User-Agent': userAgent,
              'Accept': '*/*',
              'Range': 'bytes=0-0'
            }
          });

          clearTimeout(timeoutIdGet);
        } else {
          clearTimeout(timeoutId);
        }

        return {
          id,
          url,
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          redirected: response.redirected,
          finalUrl: response.url,
          responseTime: performance.now() - start
        };
      } catch (error) {
        return {
          id,
          url,
          status: 0,
          ok: false,
          error: error.name === 'AbortError' ? 'Timeout' : error.message,
          responseTime: null
        };
      }
    })
  );

  return results.map(result =>
    result.status === 'fulfilled' ? result.value : {
      url: 'unknown',
      status: 0,
      ok: false,
      error: result.reason?.message || 'Unknown error'
    }
  );
}

function classifyBookmark(bookmark) {
  const startTime = performance.now();

  const category = analyzeCategory(bookmark);
  const tags = generateTags(bookmark);
  const suggestedFolder = generateFolderName(bookmark, category);

  return {
    category,
    confidence: calculateConfidence(bookmark, category),
    suggested_folder: suggestedFolder,
    tags,
    analysis: {
      domain: extractDomain(bookmark.url),
      keywords: extractKeywords(bookmark.title),
      processing_time: performance.now() - startTime
    }
  };
}

function analyzeCategory(bookmark) {
  const { url, title } = bookmark;
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();

  // 开发技术
  if (urlLower.includes('github') || urlLower.includes('stackoverflow') ||
    urlLower.includes('gitlab') || urlLower.includes('codepen') ||
    titleLower.includes('api') || titleLower.includes('documentation') ||
    titleLower.includes('tutorial') || titleLower.includes('code')) {
    return 'Development';
  }

  // 新闻资讯
  if (urlLower.includes('news') || urlLower.includes('medium') ||
    urlLower.includes('blog') || titleLower.includes('article') ||
    titleLower.includes('news') || titleLower.includes('报道')) {
    return 'News & Articles';
  }

  // 社交媒体
  if (urlLower.includes('twitter') || urlLower.includes('facebook') ||
    urlLower.includes('linkedin') || urlLower.includes('instagram') ||
    urlLower.includes('youtube') || urlLower.includes('tiktok')) {
    return 'Social Media';
  }

  // 购物电商
  if (urlLower.includes('amazon') || urlLower.includes('taobao') ||
    urlLower.includes('jd.com') || urlLower.includes('shop') ||
    titleLower.includes('buy') || titleLower.includes('price') ||
    titleLower.includes('购买') || titleLower.includes('商城')) {
    return 'Shopping';
  }

  // 教育学习
  if (urlLower.includes('edu') || urlLower.includes('coursera') ||
    urlLower.includes('udemy') || titleLower.includes('course') ||
    titleLower.includes('learn') || titleLower.includes('教程') ||
    titleLower.includes('学习')) {
    return 'Education';
  }

  // 工具效率
  if (titleLower.includes('tool') || titleLower.includes('utility') ||
    titleLower.includes('converter') || titleLower.includes('generator') ||
    titleLower.includes('工具') || titleLower.includes('效率')) {
    return 'Tools & Utilities';
  }

  // 娱乐休闲
  if (urlLower.includes('game') || urlLower.includes('movie') ||
    urlLower.includes('music') || titleLower.includes('entertainment') ||
    titleLower.includes('游戏') || titleLower.includes('娱乐')) {
    return 'Entertainment';
  }

  return 'General';
}

function generateTags(bookmark) {
  const tags = new Set();

  // 域名标签
  const domain = extractDomain(bookmark.url);
  if (domain) tags.add(domain);

  // 关键词标签
  const keywords = extractKeywords(bookmark.title);
  keywords.slice(0, 5).forEach(keyword => tags.add(keyword));

  // 类别标签
  const category = analyzeCategory(bookmark);
  tags.add(category.toLowerCase().replace(/\s+/g, '-'));

  return Array.from(tags);
}

function generateFolderName(bookmark, category) {
  const domain = extractDomain(bookmark.url);
  return `${category}/${domain}`;
}

function calculateConfidence(bookmark, category) {
  let confidence = 0.5;

  const url = bookmark.url.toLowerCase();
  const title = bookmark.title.toLowerCase();

  // 基于域名的置信度
  const knownDomains = {
    'github.com': 'Development',
    'stackoverflow.com': 'Development',
    'medium.com': 'News & Articles',
    'youtube.com': 'Entertainment',
    'amazon.com': 'Shopping'
  };

  const domain = extractDomain(bookmark.url);
  if (knownDomains[domain] === category) {
    confidence += 0.3;
  }

  // 基于关键词匹配的置信度
  const categoryKeywords = {
    'Development': ['api', 'code', 'programming', 'tutorial'],
    'News & Articles': ['news', 'article', 'blog', 'story'],
    'Social Media': ['social', 'share', 'post', 'follow'],
    'Shopping': ['buy', 'price', 'shop', 'cart'],
    'Education': ['learn', 'course', 'education', 'tutorial']
  };

  const keywords = categoryKeywords[category] || [];
  const matchedKeywords = keywords.filter(keyword =>
    title.includes(keyword) || url.includes(keyword)
  );

  confidence += matchedKeywords.length * 0.1;

  return Math.min(confidence, 0.95);
}

// === 工具函数 ===
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function extractKeywords(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中文字符
    .match(/\b\w{2,}\b/g) || [];
}

function getCorsHeaders(origin) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];

  let allowOrigin = allowedOrigins[0];

  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://'))) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function createJsonResponse(data, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function createErrorResponse(message, status = 500, corsHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// === 异步任务处理 ===
async function processBookmarksAsync(jobId, data) {
  console.log(`🔄 开始处理任务 ${jobId}`);

  try {
    // 设置初始状态
    await setJob(jobId, {
      id: jobId,
      status: 'processing',
      progress: 0,
      startTime: new Date().toISOString(),
      data
    });

    // 模拟处理过程
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));

      await setJob(jobId, {
        id: jobId,
        status: 'processing',
        progress: i,
        startTime: new Date().toISOString(),
        message: `Processing... ${i}%`
      });
    }

    // 完成处理
    await setJob(jobId, {
      id: jobId,
      status: 'completed',
      progress: 100,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      message: 'Processing completed successfully'
    });

    console.log(`✅ 任务 ${jobId} 完成`);
  } catch (error) {
    console.error(`❌ 任务 ${jobId} 失败:`, error);

    await setJob(jobId, {
      id: jobId,
      status: 'failed',
      progress: 0,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      error: error.message
    });
  }
}

// 移除默认导出以避免 Bun 自动服务重复启动
