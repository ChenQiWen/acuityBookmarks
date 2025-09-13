/**
 * AcuityBookmarks 后端服务 - 纯Bun原生实现
 * 完全移除Node.js依赖，充分利用Bun性能优势
 */

import { v4 as uuidv4 } from 'uuid';
import { getJob, setJob } from './utils/job-store.js';

// === 配置 ===
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const isDevelopment = process.env.NODE_ENV !== 'production';

console.log(`🔥 启动Bun原生服务器 (${isDevelopment ? '开发' : '生产'}模式)`);

// === 启动Bun原生服务器 ===
const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  development: isDevelopment,

  async fetch(req) {
    const startTime = performance.now();

    try {
      const url = new URL(req.url);
      const response = await handleRequest(url, req);

      // 添加性能和服务器信息头
      response.headers.set('X-Response-Time', `${(performance.now() - startTime).toFixed(2)}ms`);
      response.headers.set('X-Server', 'Bun-Native');
      response.headers.set('X-Version', '1.0.0');

      return response;
    } catch (error) {
      console.error('🚨 服务器错误:', error);
      return createErrorResponse('Internal server error', 500);
    }
  },

  error(error) {
    console.error('🔴 Bun服务器错误:', error);
    return new Response('Server Error', { status: 500 });
  }
});

console.log(`🚀 服务器运行在 http://${HOST}:${PORT}`);

// === 主要请求处理 ===
async function handleRequest(url, req) {
  const path = url.pathname;
  const {method} = req;

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
  }

  // 404
  return createErrorResponse('Not Found', 404, corsHeaders);
}

// === API路由处理 ===
async function handleApiRoutes(url, req, corsHeaders) {
  const path = url.pathname;
  const {method} = req;

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

    // 启动异步处理
    processBookmarksAsync(jobId, data);

    return createJsonResponse({
      jobId,
      status: 'started',
      message: 'Processing started successfully'
    }, corsHeaders);
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    return createErrorResponse('Classification failed', 500, corsHeaders);
  }
}

async function handleHealthCheck(corsHeaders) {
  const memoryUsage = process.memoryUsage();

  return createJsonResponse({
    status: 'ok',
    server: 'Bun-Native',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
    },
    performance: {
      platform: process.platform,
      arch: process.arch,
      runtime: 'Bun'
    }
  }, corsHeaders);
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': userAgent,
            'Accept': '*/*'
          }
        });

        clearTimeout(timeoutId);

        return {
          id,
          url,
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          redirected: response.redirected,
          finalUrl: response.url,
          responseTime: Date.now() - Date.now() // 简化版，实际应该测量
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
      error: result.reason.message
    }
  );
}

async function classifyBookmark(bookmark) {
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

export default server;
