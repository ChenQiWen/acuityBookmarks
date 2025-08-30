import { WebCrawler } from '../utils/web-crawler.js';
import { BatchClassifier } from '../utils/batch-classifier.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function classifySingle(req, res) {
  try {
    const { bookmark } = req.body;
    if (!bookmark || !bookmark.url) {
      return res.status(400).json({ message: 'Bookmark URL is required' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const crawler = new WebCrawler();
    const classifier = new BatchClassifier(model);

    // Crawl single page
    const pageInfo = await crawler.crawlSingle(bookmark.url);

    if (!pageInfo.success) {
      return res.status(200).json({
        category: '无法自动分类',
        error: pageInfo.error,
        bookmark: { ...bookmark, category: '无法自动分类' }
      });
    }

    // Classify single page
    const classificationResult = await classifier.classifyBatch([pageInfo]);
    const category = classificationResult[0]?.category || '其他';

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
