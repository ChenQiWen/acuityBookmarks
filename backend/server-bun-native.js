/* eslint-disable complexity */
/**
 * AcuityBookmarks 后端服务 - 纯Bun原生实现
 * 完全移除Node.js依赖，充分利用Bun性能优势
 * 集成智能爬虫功能
 */

import { v4 as uuidv4 } from 'uuid';
import { getJob, setJob } from './utils/job-store.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';
import { runChat, runEmbedding } from './ai/router.js';

// === 常量提取，降低魔法数字告警 ===
const DEFAULT_TEMPERATURE = 0.6;
const DEFAULT_MAX_TOKENS = 256;
const HTTP_NOT_IMPLEMENTED = 501;
const CONFIDENCE_BONUS = 0.3;
const CONFIDENCE_CAP = 0.95;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_DEV = 300;
const RATE_LIMIT_MAX_PROD = 120;
const DEFAULT_CRAWL_TIMEOUT = 5_000;
const KEYWORD_CONFIDENCE_WEIGHT = 0.1;
const BASE_CONFIDENCE = 0.5;
const PROGRESS_STEP = 10;
const PROGRESS_MAX = 100;
const PROGRESS_DELAY_MS = 100;
const DEFAULT_RETRY_MAX = 3;
const RETRY_DELAY_MS = 1_000;
const RETRY_STATUS_CODES = [404, 403, 500, 502, 503, 504];
const HTML_SLICE_LIMIT = 16_384;
const DESCRIPTION_MAX_LEN = 500;
const KEYWORDS_MAX_LEN = 300;
const OG_DESC_MAX_LEN = 500;
const TAGS_KEYWORDS_LIMIT = 5;

// === 配置 ===
// === 环境变量加载：支持 backend/.env.development 与 .env.production ===
function loadEnv() {
  try {
    const cwd = process.cwd();
    const isProd = process.env.NODE_ENV === 'production';
    const files = [isProd ? '.env.production' : '.env.development', '.env'];

    for (const f of files) {
      const p = path.join(cwd, f);
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        // 支持 export KEY=VAL 与普通 KEY=VAL
        const cleaned = line.startsWith('export ') ? line.slice(7) : line;
        const m = cleaned.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        // 去除包裹引号
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
    logger.info('Server', `🔧 已加载环境文件: ${files.filter(f => fs.existsSync(path.join(cwd, f))).join(', ')}`);
  } catch (error) {
    logger.warn('Server', '⚠️ 加载 .env 文件失败（将继续使用现有环境变量）:', error?.message || String(error));
  }
}

loadEnv();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const isDevelopment = process.env.NODE_ENV !== 'production';
const DEBUG_MINIMAL = process.env.DEBUG_MINIMAL === '1';

// 简易速率限制（每窗口限制请求数）
const RATE_LIMIT = { windowMs: RATE_LIMIT_WINDOW_MS, max: isDevelopment ? RATE_LIMIT_MAX_DEV : RATE_LIMIT_MAX_PROD };
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

logger.info('Server', `🔥 启动Bun原生服务器 (${isDevelopment ? '开发' : '生产'}模式)`);

// === 精简的数据验证模式 ===
const CrawlRequestSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  dateAdded: z.number().optional(),
  parentId: z.string().optional(),
  config: z.object({
    timeout: z.number().min(1000).max(10000).default(DEFAULT_CRAWL_TIMEOUT), // 简化为只有超时配置
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractMetadataFromHtml(html) {
  const limitedHtml = html.slice(0, HTML_SLICE_LIMIT);
  const getMeta = (attr, value) => {
    const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    const m = limitedHtml.match(re);
    return m?.[1]?.trim() || '';
  };
  const titleMatch = limitedHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
  return {
    title: titleMatch?.[1]?.trim() || '',
    description: getMeta('name', 'description').substring(0, DESCRIPTION_MAX_LEN),
    keywords: getMeta('name', 'keywords').substring(0, KEYWORDS_MAX_LEN),
    ogTitle: getMeta('property', 'og:title'),
    ogDescription: getMeta('property', 'og:description').substring(0, OG_DESC_MAX_LEN),
    ogImage: getMeta('property', 'og:image'),
    ogSiteName: getMeta('property', 'og:site_name')
  };
}

async function fetchHtmlWithRetries(url, timeout, maxRetries, retryDelay) {
  let attempt = 1;
  const tryOnce = async () => {
    const userAgent = getRandomUserAgent();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
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
      if (!response.ok) {
        const statusCode = response.status;
        const shouldRetry = RETRY_STATUS_CODES.includes(statusCode);
        if (shouldRetry && attempt < maxRetries) {
          await delay(retryDelay * attempt);
          attempt += 1;
          return tryOnce();
        }
        throw new Error(`HTTP ${statusCode}: ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Not HTML content: ${contentType}`);
      }
      const html = await response.text();
      return { response, html };
    } catch (error) {
      clearTimeout(timeoutId);
      const isRetryableError =
        error.name === 'AbortError' ||
        (typeof error.message === 'string' && (
          error.message.includes('timeout') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('network')
        ));
      if (isRetryableError && attempt < maxRetries) {
        await delay(retryDelay * attempt);
        attempt += 1;
        return tryOnce();
      }
      throw error;
    }
  };
  return await tryOnce();
}

// 轻量级爬虫核心（递归重试以避免 await-in-loop）
async function crawlLightweightMetadata(url, config = {}) {
  const timeout = config.timeout || DEFAULT_CRAWL_TIMEOUT;
  const maxRetries = DEFAULT_RETRY_MAX;
  const retryDelay = RETRY_DELAY_MS;
  const { response, html } = await fetchHtmlWithRetries(url, timeout, maxRetries, retryDelay);
  const metadata = extractMetadataFromHtml(html);
  return {
    status: response.status,
    finalUrl: response.url,
    lastModified: response.headers.get('last-modified'),
    ...metadata
  };
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
    const _startTime = performance.now();
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
      // 记录请求耗时以消除未使用的 startTime 变量，并提升可观测性
      logger.debug('Server', `⏱️ 请求耗时: ${Math.round(performance.now() - _startTime)}ms`);

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

logger.info('Server', `🚀 服务器运行在 http://${HOST}:${PORT}`);
logger.info('Server', `🛰️ 实际监听: host=${server.hostname} port=${server.port}`);

// === 主要请求处理 ===
async function handleRequest(url, req) {
  const path = url.pathname;
  const { method } = req;
  logger.debug('Router', `➡️ 目标路径: ${path}, 方法: ${method}`);

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

    // === AI 文本补全端点（本地代理 Cloudflare Workers AI） ===
    case '/api/ai/complete':
      return await handleAIComplete(req, corsHeaders);

    case '/api/ai/embedding':
      return await handleAIEmbedding(req, corsHeaders);

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

// === AI 端点实现：本地代理到 Cloudflare Workers AI REST API ===
async function handleAIComplete(req, corsHeaders) {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = body.prompt || '';
    const messages = Array.isArray(body.messages) ? body.messages : undefined;
    const model = body.model || DEFAULT_AI_MODEL;
    const provider = body.provider || process.env.AI_PROVIDER || 'cloudflare';
    const temperature = body.temperature ?? DEFAULT_TEMPERATURE;
    const max_tokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;

    if (!prompt && !messages) {
      return createErrorResponse('missing prompt or messages', 400, corsHeaders);
    }

    // 模型白名单校验（若配置了 ALLOWED_AI_MODELS）
    if (ALLOWED_AI_MODELS.length > 0 && !ALLOWED_AI_MODELS.includes(model)) {
      return createJsonResponse({
        error: 'model not allowed',
        allowed: ALLOWED_AI_MODELS,
        received: model
      }, corsHeaders, 400);
    }
    // 统一路由层：根据 provider 转发到对应实现
    try {
      const data = await runChat({ provider, model, prompt, messages, temperature, max_tokens });
      return createJsonResponse(data, corsHeaders);
    } catch (err) {
      const msg = err?.message || String(err);
      return createJsonResponse({ error: 'AI request failed', message: msg }, corsHeaders, 500);
    }
  } catch (error) {
    const msg = error && error.name === 'AbortError' ? 'Cloudflare AI timeout' : (error?.message || String(error));
    return createJsonResponse({ error: 'AI request failed', message: msg }, corsHeaders, 500);
  }
}

// === AI 嵌入端点：统一路由到各提供商 ===
async function handleAIEmbedding(req, corsHeaders) {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }
  try {
    const body = await req.json().catch(() => ({}));
    const text = body.text || body.input || '';
    const model = body.model || DEFAULT_EMBEDDING_MODEL;
    const provider = body.provider || process.env.AI_PROVIDER || 'cloudflare';
    if (!text) return createErrorResponse('missing text', 400, corsHeaders);

    try {
      const data = await runEmbedding({ provider, model, text });
      return createJsonResponse(data, corsHeaders);
    } catch (err) {
      const msg = err?.message || String(err);
      return createJsonResponse({ error: 'Embedding failed', message: msg }, corsHeaders, 500);
    }
  } catch (error) {
    const msg = error?.message || String(error);
    return createJsonResponse({ error: 'Embedding request failed', message: msg }, corsHeaders, 500);
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

    // Bun 原生并发处理：按批次生成所有 Promise，再一次性等待，避免循环中 await
    const concurrency = 5;
    const chunks = Array.from({ length: Math.ceil(bookmarks.length / concurrency) }, (_, idx) =>
      bookmarks.slice(idx * concurrency, (idx + 1) * concurrency)
    );

    const chunkPromises = chunks.map((chunk, chunkIndex) =>
      Promise.all(
        chunk.map((bookmark, index) => (async () => {
          const globalIndex = (chunkIndex * concurrency) + index;
          try {
            const validatedBookmark = CrawlRequestSchema.parse(bookmark);
            const data = await crawlBookmark(validatedBookmark, config);
            return { index: globalIndex, success: true, data };
          } catch (error) {
            console.error(`❌ [API] 批量爬虫失败 (${globalIndex}):`, error);
            return { index: globalIndex, success: false, error: error.message, bookmarkId: bookmark.id || 'unknown' };
          }
        })())
      )
    );

    const allResults = await Promise.all(chunkPromises);
    for (const batch of allResults) {
      for (const result of batch) {
        if (result.success) results.push(result.data);
        else errors.push(result);
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
        if (response.status === 405 || response.status === HTTP_NOT_IMPLEMENTED) {
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
  keywords.slice(0, TAGS_KEYWORDS_LIMIT).forEach(keyword => tags.add(keyword));

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
  let confidence = BASE_CONFIDENCE;

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
    confidence += CONFIDENCE_BONUS;
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

  confidence += matchedKeywords.length * KEYWORD_CONFIDENCE_WEIGHT;

  return Math.min(confidence, CONFIDENCE_CAP);
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

    // 模拟处理过程（串行Promise链，避免 await-in-loop）
    const steps = Array.from({ length: Math.floor(PROGRESS_MAX / PROGRESS_STEP) + 1 }, (_, idx) => idx * PROGRESS_STEP);
    await steps.reduce(async (prev, i) => {
      await prev;
      await new Promise(resolve => setTimeout(resolve, PROGRESS_DELAY_MS));
      await setJob(jobId, {
        id: jobId,
        status: 'processing',
        progress: i,
        startTime: new Date().toISOString(),
        message: `Processing... ${i}%`
      });
    }, Promise.resolve());

    // 完成处理
    await setJob(jobId, {
      id: jobId,
      status: 'completed',
      progress: PROGRESS_MAX,
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
// === AI 模型默认值与白名单（可通过环境变量覆盖） ===
const DEFAULT_AI_MODEL = process.env.DEFAULT_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
const DEFAULT_EMBEDDING_MODEL = process.env.DEFAULT_EMBEDDING_MODEL || '@cf/baai/bge-m3';
const ALLOWED_AI_MODELS = (process.env.ALLOWED_AI_MODELS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
