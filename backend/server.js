import http from 'http';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getJob, setJob } from './utils/job-store.js';

// Import API handlers
import classifySingle from './api/classify-single.js';
import clearCache from './api/clear-cache.js';
import { processAllBookmarks } from './api/process-all.js';
import { searchBookmarks } from './api/search-bookmarks.js';

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
  console.error(`[${context}] Error:`, error.message, error.stack);

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
  startTime: Date.now(),
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
      console.warn(`🐌 Slow request: ${req.method} ${req.url} took ${duration}ms`);
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
    ((performanceMetrics.errorCount / performanceMetrics.requestCount) * 100).toFixed(2) + '%' : '0%',
  avgResponseTime: Math.round(performanceMetrics.avgResponseTime) + 'ms',
  slowRequests: performanceMetrics.slowRequests,
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

  const origin = req.headers.origin;
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
    return str.trim().substring(0, maxLength).replace(/[<>\"'&]/g, '');
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
      },
    }),
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
      processAllBookmarks(bookmarks, jobId);
    } catch (error) {
      console.error('Error in start-processing:', error);
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
      console.error('Error in get-progress:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  } else if (url.pathname === '/api/classify-single' && req.method === 'POST') {
    try {
      req.body = await getBody();

      // Validate input
      if (!req.body.url || !validateUrl(req.body.url)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid URL' }));
        return;
      }

      await classifySingle(req, createMockResponse(res));
    } catch (error) {
      console.error('Error in classify-single:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  } else if (url.pathname === '/api/clear-cache' && req.method === 'POST') {
    try {
      await clearCache(req, createMockResponse(res));
    } catch (error) {
      console.error('Error in clear-cache:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  } else if (url.pathname === '/api/search-bookmarks' && req.method === 'POST') {
    try {
      const { query, bookmarks, mode = 'fast' } = await getBody();

      // Validate input
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid search query' }));
        return;
      }

      if (!Array.isArray(bookmarks)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid bookmarks array' }));
        return;
      }

      if (!['fast', 'smart', 'content'].includes(mode)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid search mode' }));
        return;
      }

      const result = await searchBookmarks(query, bookmarks, mode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Error in search-bookmarks:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  } else if (url.pathname === '/api/health' && req.method === 'GET') {
    try {
      const stats = getPerformanceStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ...stats
      }));
    } catch (error) {
      console.error('Error getting health stats:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
