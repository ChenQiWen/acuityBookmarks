import http from 'http';
import https from 'https';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getJob, setJob } from './utils/job-store.js';

// Note: API handlers have been removed as they are no longer used in the local-first architecture

// --- URL检测工具函数 ---
/**
 * 检测单个URL的状态
 */
function checkSingleUrl(urlInfo, settings) {
  const { url, id } = urlInfo;

  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        method: 'GET', // 改用GET请求，更准确
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        timeout: settings.timeout,
        headers: {
          'User-Agent': settings.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
          'Connection': 'close' // 避免保持连接
        },
        // 忽略SSL证书错误
        rejectUnauthorized: false
      };

      const startTime = Date.now();

      const req = client.request(options, (res) => {
        const responseTime = Date.now() - startTime;

        // 收集响应数据用于内容检测
        let responseData = '';
        let dataReceived = 0;
        const maxDataSize = 2048; // 读取2KB数据用于内容分析

        res.on('data', (chunk) => {
          dataReceived += chunk.length;
          if (dataReceived <= maxDataSize) {
            responseData += chunk.toString('utf8');
          }
          if (dataReceived > maxDataSize) {
            // 数据足够，中断连接
            res.destroy();
          }
        });

        res.on('end', () => {
          // 连接正常结束，页面存在
        });

        res.on('close', () => {
          // 连接关闭，继续处理结果
        });

        // 处理重定向
        if (settings.followRedirects && [301, 302, 303, 307, 308].includes(res.statusCode)) {
          const {location} = res.headers;
          if (location) {
            // 递归检测重定向URL（最多3次重定向）
            if ((urlInfo.redirectCount || 0) < 3) {
              const redirectInfo = {
                ...urlInfo,
                url: new URL(location, url).href,
                redirectCount: (urlInfo.redirectCount || 0) + 1
              };
              checkSingleUrl(redirectInfo, settings).then(resolve);
            }
          }
        }

        resolve({
          id,
          url: urlInfo.url, // 返回原始URL
          status: res.statusCode,
          statusText: res.statusMessage || getStatusText(res.statusCode),
          responseTime,
          isError: isRealError(res.statusCode) || isContentError(responseData), // 结合状态码和内容检测
          headers: {
            'content-type': res.headers['content-type'],
            'server': res.headers['server']
          },
          contentSample: responseData.substring(0, 200) // 返回内容样本用于调试
        });
      });

      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;

        resolve({
          id,
          url: urlInfo.url,
          status: 0,
          statusText: 'Network Error',
          responseTime,
          isError: true,
          error: error.message,
          errorCode: error.code
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const responseTime = Date.now() - startTime;

        resolve({
          id,
          url: urlInfo.url,
          status: 0,
          statusText: 'Timeout',
          responseTime,
          isError: true,
          error: `Request timeout after ${settings.timeout}ms`
        });
      });

      req.end();

    } catch (error) {
      resolve({
        id,
        url: urlInfo.url,
        status: 0,
        statusText: 'Invalid URL',
        responseTime: 0,
        isError: true,
        error: error.message
      });
    }
  });
}

/**
 * 并发检测多个URL
 */
async function checkUrlsConcurrent(urls, settings) {
  const results = [];
  const maxConcurrent = settings.maxConcurrent || 5;

  // 分批处理
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(urlInfo => checkSingleUrl(urlInfo, settings));

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 避免过快请求，每批之间延迟更长时间
      if (i + maxConcurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('批量检测错误:', error);
      // 即使某批失败，也继续处理其他批次
    }
  }

  return results;
}

/**
 * 判断状态码是否表示真正的页面不存在错误
 */
function isRealError(statusCode) {
  // 只有这些状态码才表示页面真正不存在或不可访问
  const realErrorCodes = [
    404, // Not Found - 页面不存在
    410, // Gone - 页面已永久删除
    502, // Bad Gateway - 上游服务器错误
    503, // Service Unavailable - 服务不可用
    504  // Gateway Timeout - 网关超时
  ];

  // 5xx服务器错误也可能表示长期不可访问
  if (statusCode >= 500) {
    return true;
  }

  return realErrorCodes.includes(statusCode);
}

/**
 * 根据页面内容判断是否为错误页面
 */
function isContentError(responseData) {
  if (!responseData || typeof responseData !== 'string') {
    return false;
  }

  // 转换为小写进行匹配
  const content = responseData.toLowerCase();

  // 常见的错误页面关键词
  const errorKeywords = [
    'failed to view',          // Coze错误页面
    'page not found',          // 通用404
    'not found',               // 通用404
    '404 error',               // 404错误
    'page does not exist',     // 页面不存在
    'sorry, this page',        // 道歉页面
    'the page you requested',  // 请求页面错误
    'error 404',               // 错误404
    'access denied',           // 访问被拒绝
    'forbidden',               // 禁止访问
    'service unavailable',     // 服务不可用
    'temporarily unavailable', // 临时不可用
    'this page is missing',    // 页面丢失
    'oops',                    // 常见错误表达
    'something went wrong',    // 出错了
    'an error occurred',       // 发生错误
    'unable to load',          // 无法加载
    'connection failed',       // 连接失败
    'server error'             // 服务器错误
  ];

  // 检查是否包含错误关键词
  for (const keyword of errorKeywords) {
    if (content.includes(keyword)) {
      console.log(`内容检测: 发现错误关键词 "${keyword}"`);
      return true;
    }
  }

  // 检查HTML标题中的错误信息
  const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const title = titleMatch[1].toLowerCase();
    const titleErrorKeywords = ['404', 'not found', 'error', 'failed'];
    for (const keyword of titleErrorKeywords) {
      if (title.includes(keyword)) {
        console.log(`内容检测: 标题中发现错误关键词 "${keyword}"`);
        return true;
      }
    }
  }

  return false;
}

/**
 * 获取HTTP状态码对应的文本
 */
function getStatusText(statusCode) {
  const statusTexts = {
    200: 'OK',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    410: 'Gone',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };

  return statusTexts[statusCode] || 'Unknown Status';
}

// --- Error Handling Utilities ---
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

const handleError = (error, res, context = '') => {

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }

  // Handle different types of errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({ message: 'Service temporarily unavailable' });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation failed', details: error.message });
  }

  // Default error response
  return res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    handleError(error, res, fn.name);
  });
};

// --- Performance Monitoring ---
const performanceMetrics = {
  requestCount: 0,
  errorCount: 0,
  avgResponseTime: 0,
  slowRequests: 0,
  startTime: Date.now()
};

const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  performanceMetrics.requestCount++;

  // Monitor response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    performanceMetrics.avgResponseTime =
      (performanceMetrics.avgResponseTime * (performanceMetrics.requestCount - 1) + duration) / performanceMetrics.requestCount;

    if (duration > 5000) { // Log slow requests (>5 seconds)
      performanceMetrics.slowRequests++;
    }

    if (res.statusCode >= 400) {
      performanceMetrics.errorCount++;
    }
  });

  next();
};

// Performance stats endpoint
const getPerformanceStats = () => ({
  uptime: Math.floor((Date.now() - performanceMetrics.startTime) / 1000),
  totalRequests: performanceMetrics.requestCount,
  errorRate: performanceMetrics.requestCount > 0 ?
    `${((performanceMetrics.errorCount / performanceMetrics.requestCount) * 100).toFixed(2)  }%` : '0%',
  avgResponseTime: `${Math.round(performanceMetrics.avgResponseTime)  }ms`,
  slowRequests: performanceMetrics.slowRequests
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const server = http.createServer(async (req, res) => {
  // --- Performance Monitoring ---
  performanceMiddleware(req, res, () => {});

  // --- CORS and Preflight ---
  // For development, allow localhost; for production, restrict to specific origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5173', // Vite dev server
    'chrome-extension://' // Allow Chrome extensions
  ];

  const {origin} = req.headers;
  const isAllowedOrigin = !origin || allowedOrigins.some(allowed =>
    origin.startsWith(allowed) || origin.includes('chrome-extension://')
  );

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Input Validation Utilities ---
  const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const validateBookmark = (bookmark) => {
    if (!bookmark || typeof bookmark !== 'object') return false;
    return bookmark.title && typeof bookmark.title === 'string' &&
           bookmark.url && typeof bookmark.url === 'string' &&
           validateUrl(bookmark.url);
  };

  const sanitizeString = (str, maxLength = 1000) => {
    if (!str || typeof str !== 'string') return '';
    return str.trim().substring(0, maxLength).replace(/[<>"'&]/g, '');
  };

  // --- Request Body Parser ---
  const getBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};

        // Sanitize common fields
        if (parsed.url) parsed.url = sanitizeString(parsed.url, 2000);
        if (parsed.title) parsed.title = sanitizeString(parsed.title, 200);
        if (parsed.query) parsed.query = sanitizeString(parsed.query, 500);

        resolve(parsed);
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });

  // --- Mock Vercel Response ---
  const createMockResponse = (res) => ({
    status: (statusCode) => ({
      json: (data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      }
    })
  });

  // --- API Routing ---
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/start-processing' && req.method === 'POST') {
    try {
      const { bookmarks } = await getBody();

      // Validate input
      if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid bookmarks array' }));
        return;
      }

      // Validate each bookmark
      for (const bookmark of bookmarks) {
        if (!validateBookmark(bookmark)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Invalid bookmark format' }));
          return;
        }
      }

      const jobId = uuidv4();
      await setJob(jobId, { status: 'starting', progress: 0, total: bookmarks.length, result: null });

      // Respond immediately with the job ID
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jobId }));

      // Start processing in the background
      // TODO: Implement processAllBookmarks function
      // processAllBookmarks(bookmarks, jobId);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }

  } else if (url.pathname.startsWith('/api/get-progress/') && req.method === 'GET') {
    try {
      const jobId = url.pathname.split('/')[3];
      if (!jobId || jobId.length !== 36) { // UUID v4 length
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid job ID' }));
        return;
      }

      const job = await getJob(jobId);
      if (job) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(job));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Job not found' }));
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  } else if (url.pathname === '/api/check-urls' && req.method === 'POST') {
    try {
      const { urls, settings = {} } = await getBody();

      // 验证输入
      if (!Array.isArray(urls) || urls.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid URLs array' }));
        return;
      }

      // 验证URL格式
      for (const urlItem of urls) {
        if (!urlItem.url || !validateUrl(urlItem.url)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Invalid URL format' }));
          return;
        }
      }

      // 检测设置
      const checkSettings = {
        timeout: Math.min(Math.max(settings.timeout || 15, 5), 30) * 1000, // 5-30秒，转换为毫秒，默认15秒
        followRedirects: settings.followRedirects !== false,
        userAgent: settings.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        maxConcurrent: Math.min(urls.length, 8) // 减少并发数，避免被限流
      };

      console.log(`开始检测 ${urls.length} 个URL，设置:`, checkSettings);

      // 并发检测所有URL
      const results = await checkUrlsConcurrent(urls, checkSettings);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results }));

    } catch (error) {
      console.error('URL检测错误:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'URL检测失败', error: error.message }));
    }
  // Note: Removed API endpoints as they are no longer needed in the local-first architecture
  } else if (url.pathname === '/api/health' && req.method === 'GET') {
    try {
      const stats = getPerformanceStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        port: currentPort,
        ...stats
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
  }
});

const DEFAULT_PORT = 3000;
let currentPort = DEFAULT_PORT; // Store the actual port being used

function findAvailablePort(port) {
  return new Promise((resolve, reject) => {
    const tempServer = http.createServer();
    tempServer.listen(port, () => {
      const { port: assignedPort } = tempServer.address();
      tempServer.close(() => resolve(assignedPort));
    });
    tempServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        resolve(findAvailablePort(port + 1));
      } else {
        reject(err);
      }
    });
  });
}

async function startServer() {
  try {
    currentPort = await findAvailablePort(DEFAULT_PORT);

    server.listen(currentPort, () => {
      if (currentPort !== DEFAULT_PORT) {
        console.log(`Port ${DEFAULT_PORT} was unavailable, using port ${currentPort} instead`);
      }
    });

    // Handle server errors
    server.on('error', (error) => {
    });

  } catch (error) {
    process.exit(1);
  }
}

startServer();
