import http from 'http';
import dotenv from 'dotenv';
import processBookmarks from './api/process-bookmarks.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
console.log('Server startup - GEMINI_API_KEY loaded:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'UNDEFINED');

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/process-bookmarks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      req.body = JSON.parse(body);
      
      // Mocking the Vercel response object
      const response = {
        status: (statusCode) => ({
          json: (data) => {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          },
          end: () => {
            res.writeHead(statusCode);
            res.end();
          }
        }),
        setHeader: (name, value) => {
          res.setHeader(name, value);
        }
      };
      
      await processBookmarks(req, response);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
