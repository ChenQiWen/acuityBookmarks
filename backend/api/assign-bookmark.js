import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function assignBookmark(request, response) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

  const { pageInfo, categories } = request.body;

  const prompt = `你是一个分类助手。你的任务是将给定的网页，分配到预设的分类目录中最合适的一个。

**预设分类目录:**
[${categories.join(', ')}]

**网页信息:**
- 标题: ${pageInfo.title}
- 描述: ${pageInfo.description}
- 内容摘要: ${pageInfo.content.substring(0, 800)}

**输出要求:**
你的回答必须是，也只能是“预设分类目录”中的一个分类名称。请不要添加任何解释、前缀、后缀或任何其他文字。`;

  try {
    const result = await model.generateContent(prompt);
    const rawCategory = await result.response.text();
    let category = rawCategory.trim();

    // --- 增强调试日志 ---
    const isIncluded = categories.includes(category);
    // --- 结束调试日志 ---

    if (!isIncluded) {
      category = '其他';
    }

    response.status(200).json({ url: pageInfo.url, category });
  } catch (error) {
    response.status(500).json({ message: 'Failed to assign category' });
  }
}
