import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 网页爬虫工具类
 * 并发获取多个网页内容并标准化格式
 */
export class WebCrawler {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5; // 最大并发数
    this.timeout = options.timeout || 10000; // 超时时间10秒
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    
    // 缓存设置
    this.cacheDir = path.join(process.cwd(), 'backend', '.cache');
    this.initCache();
  }

  /**
   * 初始化缓存目录
   */
  async initCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('❌ 创建缓存目录失败:', error);
    }
  }

  /**
   * 根据URL生成缓存文件路径
   */
  getCachePath(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * 批量爬取网页内容
   * @param {Array} urls - URL数组
   * @returns {Array} 标准化的网页信息数组
   */
  async crawlBatch(urls) {
    console.log(`🕷️ 开始批量处理 ${urls.length} 个网页...`);
    const startTime = Date.now();
    const allResults = [];
    const urlsToCrawl = [];

    // 1. 检查缓存
    for (const url of urls) {
      const cachePath = this.getCachePath(url);
      try {
        const cachedData = await fs.readFile(cachePath, 'utf-8');
        allResults.push(JSON.parse(cachedData));
      } catch (error) {
        // 缓存未命中或读取失败
        urlsToCrawl.push(url);
      }
    }
    
    console.log(`CACHE: 命中 ${allResults.length} 个, 需要爬取 ${urlsToCrawl.length} 个`);

    // 2. 爬取剩余的URL
    if (urlsToCrawl.length > 0) {
      const crawledResults = await this.crawlUrls(urlsToCrawl);
      allResults.push(...crawledResults);
    }
    
    const endTime = Date.now();
    console.log(`✅ 批量处理完成，耗时 ${endTime - startTime}ms`);
    
    // 确保返回结果的顺序与输入urls一致
    const urlMap = new Map(allResults.map(r => [r.url, r]));
    return urls.map(url => urlMap.get(url));
  }

  /**
   * 实际执行爬取操作
   */
  async crawlUrls(urls) {
    const results = [];
    const batches = this.chunkArray(urls, this.maxConcurrent);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      // crawlSingle now never rejects, so we can use Promise.all
      const batchPromises = batch.map(url => this.crawlSingle(url));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);

      if (i < batches.length - 1) {
        const delay = Math.random() * 1000 + 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return results;
  }

  /**
   * 爬取单个网页
   * @param {string} url - 网页URL
   * @returns {Object} 标准化的网页信息
   */
  async crawlSingle(url) {
    const cachePath = this.getCachePath(url);
    
    // 缓存检查已在 crawlBatch 中完成，这里保留是为了独立调用时的健壮性
    try {
      const cachedData = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(cachedData);
    } catch (error) {
      // 缓存未命中，继续爬取
    }

    let result;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const pageInfo = this.parseHTML(html, url);
      
      result = {
        ...pageInfo,
        success: true
      };
      
    } catch (error) {
      console.warn(`❌ 爬取失败: ${url} - ${error.message}`);
      result = {
        url: url,
        title: '解析失败',
        description: '无法获取网页内容',
        keywords: [],
        content: '',
        success: false,
        error: error.message || '未知错误'
      };
    }
    
    // 无论成功或失败，都写入缓存
    try {
      await fs.writeFile(cachePath, JSON.stringify(result, null, 2));
    } catch (cacheError) {
      console.error(`❌ 写入缓存失败: ${url}`, cacheError);
    }
    
    return result;
  }

  /**
   * 解析HTML并提取标准化信息
   * @param {string} html - HTML内容
   * @param {string} url - 原始URL
   * @returns {Object} 解析后的网页信息
   */
  parseHTML(html, url) {
    const $ = cheerio.load(html);
    
    // 移除不需要的元素
    $('script, style, noscript, nav, footer, aside, .ad, .advertisement').remove();
    
    // 提取标题
    const title = this.extractTitle($);
    
    // 提取描述
    const description = this.extractDescription($);
    
    // 提取关键词
    const keywords = this.extractKeywords($);
    
    // 提取主要内容
    const content = this.extractMainContent($);
    
    // 识别网站类型
    const siteType = this.identifySiteType(url, $);
    
    return {
      url,
      title: title.trim(),
      description: description.trim(),
      keywords,
      content: content.trim(),
      siteType,
      contentLength: content.length,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * 提取网页标题
   */
  extractTitle($) {
    // 尝试多种方式获取标题
    let title = $('title').text() ||
                $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('h1').first().text() ||
                '无标题';
    
    return title.substring(0, 200); // 限制长度
  }

  /**
   * 提取网页描述
   */
  extractDescription($) {
    let description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      $('meta[name="twitter:description"]').attr('content') ||
                      $('p').first().text() ||
                      '';
    
    return description.substring(0, 500); // 限制长度
  }

  /**
   * 提取关键词
   */
  extractKeywords($) {
    const keywordsContent = $('meta[name="keywords"]').attr('content');
    if (keywordsContent) {
      return keywordsContent.split(',').map(k => k.trim()).filter(k => k);
    }
    
    // 从标题和描述中提取关键词
    const title = this.extractTitle($);
    const description = this.extractDescription($);
    const text = (title + ' ' + description).toLowerCase();
    
    // 简单的关键词提取（可以用更复杂的NLP）
    const keywords = [];
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', '的', '了', '在', '是', '有', '和', '与'];
    const words = text.match(/\b\w{3,}\b/g) || [];
    
    words.forEach(word => {
      if (!commonWords.includes(word) && keywords.length < 10) {
        keywords.push(word);
      }
    });
    
    return [...new Set(keywords)]; // 去重
  }

  /**
   * 提取主要内容
   */
  extractMainContent($) {
    // 尝试提取主要内容区域
    let content = '';
    
    // 常见的内容选择器
    const contentSelectors = [
      'main', 'article', '[role="main"]', '.content', '.post-content', 
      '.entry-content', '.article-content', '#content', '.main-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }
    
    // 如果没找到主要内容区域，提取body文本
    if (!content.trim()) {
      content = $('body').text();
    }
    
    // 清理文本
    content = content.replace(/\s+/g, ' ').trim();
    
    return content.substring(0, 3000); // 限制长度，避免token过多
  }

  /**
   * 识别网站类型
   */
  identifySiteType(url, $) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // 技术相关
    if (hostname.includes('github') || hostname.includes('stackoverflow') || 
        hostname.includes('dev.to') || hostname.includes('medium') && url.includes('tech')) {
      return 'tech';
    }
    
    // 设计相关
    if (hostname.includes('figma') || hostname.includes('dribbble') || 
        hostname.includes('behance')) {
      return 'design';
    }
    
    // 新闻媒体
    if (hostname.includes('news') || hostname.includes('blog') || 
        $('article').length > 0) {
      return 'news';
    }
    
    // 学习教育
    if (hostname.includes('learn') || hostname.includes('edu') || 
        hostname.includes('course') || hostname.includes('tutorial')) {
      return 'education';
    }
    
    return 'general';
  }

  /**
   * 将数组分块
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

export default WebCrawler;
