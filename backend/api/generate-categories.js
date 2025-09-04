import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function generateCategories(request, response) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

  const { pageInfos } = request.body;

  const bookmarksSummary = pageInfos.map(p => 
    `- 标题: ${p.title}\n  描述: ${p.description}`
  ).join('\n');

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

  try {
    const result = await model.generateContent(prompt);
    const rawCategories = await result.response.text();
    const categories = rawCategories.split(',').map(c => c.trim()).filter(Boolean);
    
    response.status(200).json({ categories });
  } catch (error) {
    response.status(500).json({ message: 'Failed to generate categories' });
  }
}
