import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import WebCrawler from '../utils/web-crawler.js';
import BatchClassifier from '../utils/batch-classifier.js';

export default async function processBookmarks(request, response) {
  console.log('Debug: GEMINI_API_KEY =', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'UNDEFINED');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const { bookmarks } = request.body;

  if (!bookmarks || !Array.isArray(bookmarks)) {
    return response.status(400).json({ message: 'Invalid bookmarks data' });
  }

  console.log(`📚 Received ${bookmarks.length} bookmarks to process.`);

  try {
    // 初始化爬虫和分类器
    const crawler = new WebCrawler({
      maxConcurrent: 5,  // 并发数
      timeout: 10000     // 超时10秒
    });
    
    const classifier = new BatchClassifier(model);
    
    // 提取所有URL
    const urls = bookmarks
      .filter(bookmark => bookmark && bookmark.url)
      .slice(0, 50) // 限制处理数量，避免过多API调用
      .map(bookmark => bookmark.url);
    
    if (urls.length === 0) {
      return response.status(400).json({ message: 'No valid URLs to process.' });
    }
    
    console.log(`🎯 将处理 ${urls.length} 个URL`);
    
    // 步骤1: 并发爬取所有网页内容
    const pageInfos = await crawler.crawlBatch(urls);
    
    // 步骤2: 批量AI分类
    console.log('🤖 尝试批量AI分类...');
    let classifications;
    
    try {
      classifications = await classifier.classifyBatch(pageInfos);
      
      // 检查批量分类是否成功
      const successfulClassifications = classifications.filter(c => c.confidence > 0.5);
      console.log(`批量分类结果: ${successfulClassifications.length}/${classifications.length} 成功`);
      
      // 如果批量分类效果不好，回退到单个分类
      if (successfulClassifications.length < classifications.length * 0.3) {
        console.log('⚠️ 批量分类效果不佳，回退到单个分类模式...');
        classifications = await this.fallbackToIndividualClassification(pageInfos, model);
      }
    } catch (error) {
      console.error('❌ 批量分类失败，使用单个分类:', error);
      classifications = await this.fallbackToIndividualClassification(pageInfos, model);
    }
    
    // 步骤3: 将分类结果与原始书签匹配
    const processedBookmarks = bookmarks.map(bookmark => {
      if (!bookmark || !bookmark.url) return null;
      
      const classification = classifications.find(c => c.url === bookmark.url);
      
      if (classification) {
        return {
          url: bookmark.url,
          title: classification.title || bookmark.title,
          category: classification.category,
          confidence: classification.confidence,
          originalTitle: bookmark.title,
          pageInfo: {
            description: classification.pageInfo?.description,
            keywords: classification.pageInfo?.keywords,
            siteType: classification.pageInfo?.siteType
          }
        };
      }
      
      // 如果没有找到分类结果，使用默认分类
      return {
        url: bookmark.url,
        title: bookmark.title,
        category: '其他',
        confidence: 0,
        originalTitle: bookmark.title
      };
    }).filter(Boolean); // 过滤null值
    
    // 统计结果
    const stats = {
      totalReceived: bookmarks.length,
      totalProcessed: processedBookmarks.length,
      successfulCrawls: pageInfos.filter(p => p.success !== false).length,
      categories: {}
    };
    
    processedBookmarks.forEach(bookmark => {
      stats.categories[bookmark.category] = (stats.categories[bookmark.category] || 0) + 1;
    });
    
    console.log('\n📊 处理统计:');
    console.log('- 接收书签:', stats.totalReceived);
    console.log('- 处理书签:', stats.totalProcessed); 
    console.log('- 成功爬取:', stats.successfulCrawls);
    console.log('- 分类分布:', stats.categories);
    
    response.status(200).json({ 
      message: `Successfully processed ${processedBookmarks.length} bookmarks using batch AI classification.`,
      processedBookmarks: processedBookmarks,
      stats: stats,
      method: 'batch_crawler_ai'
    });

  } catch (error) {
    console.error('Error processing bookmark:', error);
    response.status(500).json({ message: 'Failed to process bookmark.' });
  }
}

// 备用的单个分类方法
async function fallbackToIndividualClassification(pageInfos, model) {
  console.log('📝 使用单个分类模式处理...');
  const classifications = [];
  const categories = [
    '前端开发', '后端开发', '移动开发', 'AI/机器学习', '数据科学', 
    '设计工具', 'UI/UX设计', '产品设计',
    '新闻资讯', '技术博客', '学习教程', '文档参考',
    '工具软件', '浏览器扩展', '开发工具',
    '娱乐休闲', '生活方式', '购物网站',
    '社交媒体', '视频平台', '音乐平台',
    '其他'
  ];
  
  // 只处理前5个，避免过多API调用
  const limitedPageInfos = pageInfos.filter(p => p.success !== false).slice(0, 5);
  
  for (const pageInfo of limitedPageInfos) {
    try {
      const prompt = `你是专业的网页分类专家。请从以下分类中选择最合适的一个：

分类选项：[${categories.join(', ')}]

网页信息：
- URL: ${pageInfo.url}
- 标题: ${pageInfo.title}
- 描述: ${pageInfo.description}
- 关键词: ${pageInfo.keywords?.join(', ')}
- 内容: ${pageInfo.content.substring(0, 1000)}

请只回复分类名称，不要其他内容：`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let category = response.text().trim();
      
      if (!categories.includes(category)) {
        category = '其他';
      }
      
      classifications.push({
        url: pageInfo.url,
        title: pageInfo.title,
        category: category,
        confidence: categories.includes(category) ? 0.8 : 0.1,
        pageInfo: pageInfo
      });
      
    } catch (error) {
      console.error(`单个分类失败 ${pageInfo.url}:`, error);
      classifications.push({
        url: pageInfo.url,
        title: pageInfo.title,
        category: '其他',
        confidence: 0,
        pageInfo: pageInfo
      });
    }
  }
  
  console.log(`✅ 单个分类完成: ${classifications.length} 个网页`);
  return classifications;
}
