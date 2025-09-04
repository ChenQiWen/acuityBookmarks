import { GoogleGenerativeAI } from '@google/generative-ai';
import WebCrawler from '../utils/web-crawler.js';
import { updateJob } from '../utils/job-store.js';

// This function is exported and called by server.js. It runs in the background.
export async function processAllBookmarks(bookmarks, jobId) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

    // Step 1: Crawl all pages
    await updateJob(jobId, { status: 'crawling' });
    const crawler = new WebCrawler();
    const urls = bookmarks.map(b => b.url);
    const pageInfos = await crawler.crawlBatch(urls);
    const successfulPages = pageInfos.filter(p => p && p.success !== false);

    // Step 2: Generate Categories
    await updateJob(jobId, { status: 'generating categories', progress: 0, total: successfulPages.length });
    const categories = await generateCategories(successfulPages, model);
    if (!categories || categories.length === 0) {
      throw new Error('Failed to generate categories');
    }

    // Step 3: Assign each bookmark to a category
    await updateJob(jobId, { status: 'assigning bookmarks' });
    const classifiedBookmarks = [];
    for (let i = 0; i < successfulPages.length; i++) {
      const pageInfo = successfulPages[i];
      const originalBookmark = bookmarks.find(b => b.url === pageInfo.url);
      try {
        const category = await assignPageToCategory(pageInfo, categories, model);
        classifiedBookmarks.push({ ...originalBookmark, category });
      } catch (error) {
        classifiedBookmarks.push({ ...originalBookmark, category: '其他' });
      }
      // Update progress
      await updateJob(jobId, { progress: i + 1 });
    }

    // Step 4: Construct the final proposal
    const newProposal = { '书签栏': {}, '其他书签': [] };
    classifiedBookmarks.forEach(b => {
      if (b.category === '其他') {
        newProposal['其他书签'].push(b);
      } else {
        if (!newProposal['书签栏'][b.category]) {
          newProposal['书签栏'][b.category] = [];
        }
        newProposal['书签栏'][b.category].push(b);
      }
    });

    // Step 5: Finalize the job
    await updateJob(jobId, { status: 'complete', result: newProposal });

  } catch (error) {
    await updateJob(jobId, { status: 'failed', error: error.message });
  }
}

// --- Helper functions (previously separate files) ---

async function generateCategories(pageInfos, model) {
  const bookmarksSummary = pageInfos.map(p => `- 标题: ${p.title}\n  描述: ${p.description}`).join('\n');
  const prompt = `你是一位专业的图书信息管理专家。你的任务是分析以下的书签列表，并设计一个简洁、合理、高度概括的文件夹分类体系来组织它们。

**要求:**
1.  **全局视角**: 请通盘考虑所有的书签，创建一个能涵盖大部分内容的分类体系。
2.  **高度概括**: 分类名称应具有普遍性，避免为单个书签创建过于具体的分类。例如，“AI开发工具”优于“AI模型可视化工具”。
3.  **数量控制**: 生成 8 到 15 个顶层分类。
4.  **简洁明了**: 分类名使用2-5个字的中文。

**书签列表 (仅含标题和描述):**
${bookmarksSummary}

**输出格式:**
请严格按照以下格式返回你设计的分类名称，用逗号分隔，不要有任何其他多余的文字、解释或序号。
例如: "技术文档,设计工具,新闻资讯,学习教程,开发工具,娱乐休闲,生活方式,购物网站,社交媒体,其他"`;
  const result = await model.generateContent(prompt);
  const rawCategories = await result.response.text();
  return rawCategories.split(',').map(c => c.trim()).filter(Boolean);
}

async function assignPageToCategory(pageInfo, categories, model) {
  const prompt = `你是一个分类助手。你的任务是将给定的网页，分配到预设的分类目录中最合适的一个。

**预设分类目录:**
[${categories.join(', ')}]

**网页信息:**
- 标题: ${pageInfo.title}
- 描述: ${pageInfo.description}
- 内容摘要: ${pageInfo.content.substring(0, 800)}

**输出要求:**
你的回答必须是，也只能是“预设分类目录”中的一个分类名称。请不要添加任何解释、前缀、后缀或任何其他文字。`;
  const result = await model.generateContent(prompt);
  let category = (await result.response.text()).trim();
  if (!categories.includes(category)) {
    category = '其他';
  }
  return category;
}
