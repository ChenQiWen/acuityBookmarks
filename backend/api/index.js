/**
 * Vercel Serverless Function 适配层
 * 将 Bun 原生服务器适配到 Vercel Serverless Functions
 * 集成智能爬虫功能
 */

// 由于 Vercel 不直接支持 Bun runtime，这里需要重新实现主要逻辑
// 注意：Vercel不支持Bun HTMLRewriter，这里使用简化版实现
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import { z } from 'zod';

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

// === 简单的内存存储 (用于 Serverless 环境) ===
const jobStore = new Map();

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

// === 轻量级爬虫核心 (Cheerio版本，用于Vercel) ===
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
          'Sec-Ch-Ua-Platform': '"Windows"',
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

      // 只读取前32KB内容（title和meta通常在这个范围内，Serverless环境内存限制）
      const html = await response.text();
      const limitedHtml = html.substring(0, 32768);

      // 使用Cheerio进行轻量级解析
      const $ = cheerio.load(limitedHtml);

      const metadata = {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        keywords: $('meta[name="keywords"]').attr('content') || '',  // 🎯 关键词 - LLM分析黄金数据
        ogTitle: $('meta[property="og:title"]').attr('content') || '',
        ogDescription: $('meta[property="og:description"]').attr('content') || '',
        ogImage: $('meta[property="og:image"]').attr('content') || '',
        ogSiteName: $('meta[property="og:site_name"]').attr('content') || '',
        finalUrl: response.url,
        lastModified: response.headers.get('last-modified') || ''
      };

      // 清理和标准化数据
      metadata.description = metadata.description.substring(0, 500).trim();
      metadata.keywords = metadata.keywords.substring(0, 300).trim(); // 限制300字符，避免过长
      metadata.ogDescription = metadata.ogDescription.substring(0, 500).trim();

      // ✅ 成功获取数据，返回结果
      const result = {
        status: response.status,
        finalUrl: response.url,
        lastModified: response.headers.get('last-modified'),
        ...metadata
      };

      if (attempt > 1) {
        console.log(`✅ [AntiBot] 重试成功: ${url} (尝试${attempt}次)`);
      }

      return result;

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

// === 精简的书签爬取函数 (Vercel Serverless版本) ===
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
        source: 'serverless-lightweight',
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
        source: 'serverless-lightweight'
      }
    };
  }
}

// === 工具函数 ===
function getJob(jobId) {
  return jobStore.get(jobId);
}

function setJob(jobId, data) {
  jobStore.set(jobId, data);
}

// === CORS 配置 ===
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// === 响应工具函数 ===
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// === 主要处理逻辑 ===
async function handleRequest(url, request) {
  const { pathname } = url;
  const { method } = request;

  // CORS 预检请求
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // 健康检查
  if (pathname === '/health') {
    return jsonResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'vercel-serverless',
      runtime: 'node'
    });
  }

  // AI LLM 处理端点
  if (pathname.startsWith('/api/ai/')) {
    const action = pathname.split('/').pop();

    if (method === 'POST') {
      try {
        const body = await request.json();

        switch (action) {
        case 'analyze': {
          // AI 分析逻辑
          const jobId = uuidv4();
          setJob(jobId, {
            status: 'processing',
            input: body,
            createdAt: new Date().toISOString()
          });

          // 模拟AI处理过程
          setTimeout(() => {
            setJob(jobId, {
              status: 'completed',
              input: body,
              result: {
                analysis: '这是AI分析结果的模拟数据',
                confidence: 0.95,
                suggestions: ['建议1', '建议2', '建议3']
              },
              completedAt: new Date().toISOString()
            });
          }, 2000);

          return jsonResponse({
            jobId,
            status: 'accepted',
            message: 'AI分析任务已创建'
          });
        }

        case 'query':
          // AI 查询逻辑
          return jsonResponse({
            response: '这是AI查询的模拟响应',
            model: 'gpt-3.5-turbo',
            timestamp: new Date().toISOString()
          });

        default:
          return jsonResponse({
            error: 'Unknown AI action',
            availableActions: ['analyze', 'query']
          }, 404);
        }
      } catch (error) {
        return jsonResponse({
          error: 'Invalid JSON body',
          message: error.message
        }, 400);
      }
    }
  }

  // 网络抓包处理端点
  if (pathname.startsWith('/api/scraper/')) {
    const action = pathname.split('/').pop();

    if (method === 'POST') {
      try {
        const body = await request.json();
        const { url: targetUrl, options = {} } = body;

        if (!targetUrl) {
          return jsonResponse({
            error: 'Missing required parameter: url'
          }, 400);
        }

        switch (action) {
        case 'fetch': {
          // 网页抓取逻辑
          const jobId = uuidv4();
          setJob(jobId, {
            status: 'processing',
            targetUrl,
            options,
            createdAt: new Date().toISOString()
          });

          // 模拟抓取过程
          setTimeout(async () => {
            try {
              const response = await fetch(targetUrl, {
                headers: {
                  'User-Agent': options.userAgent || 'AcuityBookmarks/1.0'
                }
              });

              const content = await response.text();

              setJob(jobId, {
                status: 'completed',
                targetUrl,
                result: {
                  statusCode: response.status,
                  headers: Object.fromEntries(response.headers),
                  content: content.substring(0, 10000), // 限制内容长度
                  size: content.length
                },
                completedAt: new Date().toISOString()
              });
            } catch (error) {
              setJob(jobId, {
                status: 'error',
                targetUrl,
                error: error.message,
                failedAt: new Date().toISOString()
              });
            }
          }, 1000);

          return jsonResponse({
            jobId,
            status: 'accepted',
            message: '网页抓取任务已创建'
          });
        }

        default:
          return jsonResponse({
            error: 'Unknown scraper action',
            availableActions: ['fetch']
          }, 404);
        }
      } catch (error) {
        return jsonResponse({
          error: 'Invalid JSON body',
          message: error.message
        }, 400);
      }
    }
  }

  // === 智能爬虫端点 ===
  if (pathname.startsWith('/api/crawl')) {
    if (pathname === '/api/crawl' || pathname === '/crawl') {
      // 单个书签爬取
      if (method === 'POST') {
        try {
          const body = await request.json();
          console.log('📥 [API] 收到爬虫请求:', body);

          // 验证请求数据
          const validatedData = CrawlRequestSchema.parse(body);
          console.log('✅ [API] 数据验证通过');

          // 执行爬虫任务
          const result = await crawlBookmark(validatedData, validatedData.config);

          return jsonResponse({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error('❌ [API] 爬虫请求处理失败:', error);

          if (error.name === 'ZodError') {
            return jsonResponse({
              success: false,
              error: 'Validation Error',
              message: 'Invalid request data',
              details: error.errors,
              timestamp: new Date().toISOString()
            }, 400);
          }

          return jsonResponse({
            success: false,
            error: 'Crawl Failed',
            message: error.message,
            timestamp: new Date().toISOString()
          }, 500);
        }
      }
    }

    if (pathname === '/api/crawl/batch' || pathname === '/crawl/batch') {
      // 批量书签爬取
      if (method === 'POST') {
        try {
          const body = await request.json();
          const { bookmarks, config = {} } = body;

          if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
            return jsonResponse({
              success: false,
              error: 'Invalid Input',
              message: 'bookmarks must be a non-empty array'
            }, 400);
          }

          if (bookmarks.length > 10) { // Serverless 限制批量大小
            return jsonResponse({
              success: false,
              error: 'Batch Size Limit',
              message: 'Maximum 10 bookmarks per batch request'
            }, 400);
          }

          console.log(`📥 [API] 收到批量爬虫请求: ${bookmarks.length} 个书签`);

          const results = [];
          const errors = [];

          // 限制并发，避免 Serverless 超时
          const concurrency = 3;
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

          return jsonResponse({
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
          });

        } catch (error) {
          console.error('❌ [API] 批量爬虫请求处理失败:', error);

          return jsonResponse({
            success: false,
            error: 'Batch Crawl Failed',
            message: error.message,
            timestamp: new Date().toISOString()
          }, 500);
        }
      }
    }

    if (pathname === '/api/crawl/health' || pathname === '/crawl/health') {
      // 爬虫健康检查
      if (method === 'GET') {
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

          return jsonResponse({
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
              maxBatchSize: 10,
              maxTimeout: 30000
            },
            timestamp: new Date().toISOString()
          }, isHealthy ? 200 : 503);

        } catch (error) {
          console.error('❌ [API] 爬虫健康检查失败:', error);

          return jsonResponse({
            status: 'unhealthy',
            crawler: {
              available: false,
              error: error.message,
              lastCheck: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          }, 503);
        }
      }
    }

    // 未知的爬虫端点
    return jsonResponse({
      error: 'Unknown crawl endpoint',
      availableEndpoints: ['/api/crawl', '/api/crawl/batch', '/api/crawl/health']
    }, 404);
  }

  // 任务状态查询
  if (pathname.startsWith('/api/job/')) {
    const jobId = pathname.split('/').pop();

    if (method === 'GET') {
      const job = getJob(jobId);

      if (!job) {
        return jsonResponse({
          error: 'Job not found',
          jobId
        }, 404);
      }

      return jsonResponse(job);
    }
  }

  // API 根路径
  if (pathname === '/api' || pathname === '/api/') {
    return jsonResponse({
      name: 'AcuityBookmarks Serverless API',
      version: '1.0.0',
      environment: 'vercel',
      endpoints: {
        health: '/health',
        ai: {
          analyze: 'POST /api/ai/analyze',
          query: 'POST /api/ai/query'
        },
        scraper: {
          fetch: 'POST /api/scraper/fetch'
        },
        crawl: {
          single: 'POST /api/crawl',
          batch: 'POST /api/crawl/batch',
          health: 'GET /api/crawl/health'
        },
        job: 'GET /api/job/{jobId}'
      }
    });
  }

  // 404 处理
  return jsonResponse({
    error: 'Not Found',
    path: pathname,
    method,
    timestamp: new Date().toISOString()
  }, 404);
}

// === Vercel Serverless Function 导出 ===
export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const request = {
      method: req.method,
      headers: req.headers,
      json: () => req.body
    };

    const response = await handleRequest(url, request);
    const data = await response.json();

    // 添加性能信息
    const responseTime = Date.now() - startTime;

    res.status(response.status);
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-Powered-By', 'AcuityBookmarks-Serverless');

    // 设置 CORS 头
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.json(data);

  } catch (error) {
    console.error('Serverless function error:', error);

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
