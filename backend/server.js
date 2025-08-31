import http from 'http';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import API handlers
import classifySingle from './api/classify-single.js';
import clearCache from './api/clear-cache.js';
import { processAllBookmarks } from './api/process-all.js';
import { searchBookmarks } from './api/search-bookmarks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// In-memory job store
const jobStore = new Map();

const server = http.createServer(async (req, res) => {
  // --- CORS and Preflight ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Request Body Parser ---
  const getBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
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
    const { bookmarks } = await getBody();
    const jobId = uuidv4();
    jobStore.set(jobId, { status: 'starting', progress: 0, total: bookmarks.length, result: null });
    
    // Respond immediately with the job ID
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jobId }));

    // Start processing in the background
    processAllBookmarks(bookmarks, jobId, jobStore);

  } else if (url.pathname.startsWith('/api/get-progress/') && req.method === 'GET') {
    const jobId = url.pathname.split('/')[3];
    const job = jobStore.get(jobId);
    if (job) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(job));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Job not found' }));
    }
  } else if (url.pathname === '/api/classify-single' && req.method === 'POST') {
    req.body = await getBody();
    await classifySingle(req, createMockResponse(res));
  } else if (url.pathname === '/api/clear-cache' && req.method === 'POST') {
    await clearCache(req, createMockResponse(res));
  } else if (url.pathname === '/api/search-bookmarks' && req.method === 'POST') {
    const { query, bookmarks } = await getBody();
    const matchedBookmarks = await searchBookmarks(query, bookmarks);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(matchedBookmarks));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
