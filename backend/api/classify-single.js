import { GoogleGenerativeAI } from '@google/generative-ai';
import WebCrawler from '../utils/web-crawler.js';

const PREDEFINED_CATEGORIES = [
    '技术文档', '设计工具', '新闻资讯', '学习教程', '开发工具',
    'AI 人工智能', '前端技术', '后端技术', '数据库',
    '娱乐休闲', '生活方式', '购物网站', '社交媒体', 
    '视频平台', '音乐平台', '其他'
];

async function classifySingle(req, res) {
  try {
    const { bookmark } = req.body;
    if (!bookmark || !bookmark.url) {
      return res.status(400).json({ message: 'Bookmark URL is required' });
    }

    // 1. Crawl the single page content
    const crawler = new WebCrawler();
    const pageInfo = await crawler.crawlSingle(bookmark.url);

    if (!pageInfo.success) {
      return res.status(200).json({
        category: '无法自动分类',
        error: pageInfo.error,
        bookmark: { ...bookmark, category: '无法自动分类' }
      });
    }

    // 2. Assign to a predefined category
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

    const prompt = `你是一个分类助手。你的任务是将给定的网页，分配到预设的分类目录中最合适的一个。

**预设分类目录:**
[${PREDEFINED_CATEGORIES.join(', ')}]

**网页信息:**
- 标题: ${pageInfo.title}
- 描述: ${pageInfo.description}
- 内容摘要: ${pageInfo.content.substring(0, 800)}

**输出要求:**
请严格从**预设分类目录**中选择一个最匹配的分类名称，并且只返回这个名称，不要有任何其他多余的文字或解释。`;

    const result = await model.generateContent(prompt);
    const rawCategory = await result.response.text();
    let category = rawCategory.trim();

    if (!PREDEFINED_CATEGORIES.includes(category)) {
      console.warn(`⚠️ LLM返回了非预设分类 "${category}" for ${pageInfo.url}，已自动归入“其他”。`);
      category = '其他';
    }

    res.status(200).json({ 
      category,
      bookmark: { ...bookmark, category }
    });

  } catch (error) {
    console.error('Error in classifySingle:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

export default classifySingle;
