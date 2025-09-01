import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WebCrawler {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.timeout = options.timeout || 10000;
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    this.cacheExpiryDays = options.cacheExpiryDays || 7; // 7 days default

    this.cacheDir = path.join(__dirname, '..', '.cache');
    this.blocklistPath = path.join(__dirname, '..', 'blocklist.json');
    this.initCache();
  }

  async initCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.access(this.blocklistPath).catch(() => fs.writeFile(this.blocklistPath, '[]'));
    } catch (error) {
      console.error('❌ 创建缓存目录或黑名单失败:', error);
    }
  }

  getCachePath(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  async isCacheExpired(cachePath) {
    try {
      const stats = await fs.stat(cachePath);
      const now = Date.now();
      const cacheAge = now - stats.mtime.getTime();
      const maxAge = this.cacheExpiryDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      return cacheAge > maxAge;
    } catch (error) {
      // If we can't get file stats, consider it expired
      return true;
    }
  }

  async cleanExpiredCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let cleanedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        if (await this.isCacheExpired(filePath)) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} expired cache files`);
      }
    } catch (error) {
      console.error('❌ Error cleaning expired cache:', error);
    }
  }

  async readBlocklist() {
    try {
      const data = await fs.readFile(this.blocklistPath, 'utf-8');
      return new Set(JSON.parse(data));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('❌ 读取黑名单失败:', error);
      }
      return new Set();
    }
  }

  async addToBlocklist(url) {
    const blocklist = await this.readBlocklist();
    if (!blocklist.has(url)) {
      blocklist.add(url);
      try {
        await fs.writeFile(this.blocklistPath, JSON.stringify([...blocklist], null, 2));
        console.log(`🚫 已将 ${url} 添加到永久黑名单。`);
      } catch (error) {
        console.error(`❌ 写入黑名单失败: ${url}`, error);
      }
    }
  }

  async crawlBatch(urls) {
    console.log(`🕷️ 开始批量处理 ${urls.length} 个网页...`);
    const startTime = Date.now();
    const allResults = [];
    let urlsToProcess = [...new Set(urls)];

    // Clean expired cache files periodically
    await this.cleanExpiredCache();

    const blocklist = await this.readBlocklist();
    const initialCount = urlsToProcess.length;
    urlsToProcess = urlsToProcess.filter(url => !blocklist.has(url));
    if (initialCount > urlsToProcess.length) {
      console.log(`🚫 BLOCKLIST: 跳过了 ${initialCount - urlsToProcess.length} 个已拉黑的URL`);
    }

    const urlsToCrawl = [];
    for (const url of urlsToProcess) {
      const cachePath = this.getCachePath(url);
      try {
        // Check if cache exists and is not expired
        await fs.access(cachePath);
        if (!(await this.isCacheExpired(cachePath))) {
          const cachedData = await fs.readFile(cachePath, 'utf-8');
          allResults.push(JSON.parse(cachedData));
          continue;
        } else {
          // Cache exists but expired, will be crawled again
          console.log(`⏰ Cache expired for ${url}, will recrawl`);
        }
      } catch (error) {
        // Cache doesn't exist or other error
      }
      urlsToCrawl.push(url);
    }
    console.log(`CACHE: 命中 ${allResults.length} 个, 需要爬取 ${urlsToCrawl.length} 个`);

    if (urlsToCrawl.length > 0) {
      const crawledResults = await this.crawlUrls(urlsToCrawl);
      allResults.push(...crawledResults);
    }
    
    const endTime = Date.now();
    console.log(`✅ 批量处理完成，耗时 ${endTime - startTime}ms`);
    
    const urlMap = new Map(allResults.map(r => r && [r.url, r]).filter(Boolean));
    return urls.map(url => urlMap.get(url));
  }

  async crawlUrls(urls) {
    const results = [];
    const batches = this.chunkArray(urls, this.maxConcurrent);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchPromises = batch.map(url => this.crawlSingleWithRetry(url));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return results;
  }

  async crawlSingleWithRetry(url, retries = 3, delay = 3000) {
    try {
      return await this.crawlSingle(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRetryable = errorMessage.includes('503') || errorMessage.includes('429') || errorMessage.includes('502') || errorMessage.includes('ECONNRESET') || errorMessage.includes('aborted');
      if (isRetryable && retries > 0) {
        console.log(`🔁 [Retryable Error] for ${url}: ${errorMessage}. Retrying in ${delay / 1000}s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.crawlSingleWithRetry(url, retries - 1, delay * 2);
      }
      
      console.warn(`❌ 爬取失败 (无更多重试): ${url} - ${errorMessage}`);
      if (errorMessage.includes('403') || errorMessage.includes('404') || errorMessage.includes('410')) {
          await this.addToBlocklist(url);
      }
      
      return {
        url: url, title: '解析失败', description: '无法获取网页内容',
        faviconUrl: new URL('/favicon.ico', url).href,
        content: '', success: false, error: errorMessage
      };
    }
  }

  async crawlSingle(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const pageInfo = this.parseHTML(html, url);
      const result = { ...pageInfo, success: true };
      
      const cachePath = this.getCachePath(url);
      await fs.writeFile(cachePath, JSON.stringify(result, null, 2));
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  parseHTML(html, url) {
    const $ = cheerio.load(html);
    $('script, style, noscript, nav, footer, aside').remove();
    const title = $('title').text() || $('h1').first().text() || '无标题';
    const description = $('meta[name="description"]').attr('content') || $('p').first().text() || '';
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    const faviconUrl = this.extractFaviconUrl($, url);
    return {
      url,
      title: title.trim().substring(0, 200),
      description: description.trim().substring(0, 500),
      content: content.substring(0, 3000),
      faviconUrl: faviconUrl,
    };
  }

  extractFaviconUrl($, url) {
    const selectors = [
      'link[rel="apple-touch-icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="icon"]'
    ];
    let faviconHref = null;

    for (const selector of selectors) {
      faviconHref = $(selector).attr('href');
      if (faviconHref) break;
    }

    if (faviconHref) {
      try {
        return new URL(faviconHref, url).href;
      } catch (e) {
        return new URL('/favicon.ico', url).href;
      }
    }
    
    return new URL('/favicon.ico', url).href;
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

export default WebCrawler;
