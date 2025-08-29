import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * 网页爬虫工具类
 * 并发获取多个网页内容并标准化格式
 */
export class WebCrawler {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5; // 最大并发数
    this.timeout = options.timeout || 10000; // 超时时间10秒
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  }

  /**
   * 批量爬取网页内容
   * @param {Array} urls - URL数组
   * @returns {Array} 标准化的网页信息数组
   */
  async crawlBatch(urls) {
    console.log(`🕷️ 开始批量爬取 ${urls.length} 个网页...`);
    const startTime = Date.now();
    
    // 分批处理，避免过多并发
    const batches = this.chunkArray(urls, this.maxConcurrent);
    const results = [];
    
    for (const batch of batches) {
      const batchPromises = batch.map(url => this.crawlSingle(url));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 处理结果，过滤失败的请求
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          console.warn(`❌ 爬取失败: ${batch[index]} - ${result.reason}`);
          // 添加失败的URL，但标记为解析失败
          results.push({
            url: batch[index],
            title: '解析失败',
            description: '无法获取网页内容',
            keywords: [],
            content: '',
            success: false,
            error: result.reason?.message || '未知错误'
          });
        }
      });
    }
    
    const endTime = Date.now();
    console.log(`✅ 批量爬取完成，耗时 ${endTime - startTime}ms，成功 ${results.filter(r => r.success).length}/${urls.length}`);
    
    return results;
  }

  /**
   * 爬取单个网页
   * @param {string} url - 网页URL
   * @returns {Object} 标准化的网页信息
   */
  async crawlSingle(url) {
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
      
      return {
        ...pageInfo,
        success: true
      };
      
    } catch (error) {
      throw new Error(`爬取 ${url} 失败: ${error.message}`);
    }
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
