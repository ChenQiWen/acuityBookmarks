/**
 * LLM Prompt 模板
 *
 * 包含各种 AI 任务的 Prompt 模板
 */

/**
 * 书签分类 Prompt
 */
export function createCategorizePrompt(bookmark: {
  title: string
  url: string
  description?: string
}): string {
  return `请将这个书签分类到以下类别之一：
- 技术
- 设计
- 学习
- 工具
- 娱乐
- 新闻
- 商业
- 其他

书签信息：
标题：${bookmark.title}
URL：${bookmark.url}
${bookmark.description ? `描述：${bookmark.description}` : ''}

只返回类别名称，不要其他内容。`
}

/**
 * 书签摘要 Prompt
 */
export function createSummarizePrompt(bookmark: {
  title: string
  url: string
  content?: string
}): string {
  return `请为这个书签生成一个简洁的摘要（50字以内）：

标题：${bookmark.title}
URL：${bookmark.url}
${bookmark.content ? `内容：${bookmark.content.slice(0, 500)}` : ''}

摘要：`
}

/**
 * 书签整理 Prompt（批量）
 *
 * 注意：只发送书签的标题、URL 和元数据（如果有），用于分类判断
 * LLM 只需要返回分类结果，不需要返回完整书签数据
 */
export function createOrganizePrompt(
  bookmarks: Array<{
    id: string
    title: string
    url: string
    // 可选：爬虫获取的元数据（如果有，会提高分类准确率）
    metaTitle?: string
    metaDescription?: string
    metaKeywords?: string[]
  }>
): string {
  const bookmarkList = bookmarks
    .map((b, index) => {
      let item = `${index + 1}. [${b.id}] ${b.title} - ${b.url}`

      // 如果有元数据，附加上（提高分类准确率）
      if (b.metaDescription) {
        item += `\n   描述：${b.metaDescription.slice(0, 120)}`
      }
      if (b.metaKeywords && b.metaKeywords.length > 0) {
        item += `\n   关键词：${b.metaKeywords.slice(0, 5).join(', ')}`
      }

      return item
    })
    .join('\n\n')

  return `你是一个书签分类专家。请严格按照以下要求分类书签。

⚠️ 重要：必须返回有效的 JSON 数组，不要添加任何解释文本。

可用分类（只能从以下选择）：
• 技术 - 编程、开发、框架、代码
• 设计 - UI/UX、设计资源、创意
• 学习 - 教程、文档、课程、知识库
• 工具 - 在线工具、实用网站
• 娱乐 - 视频、游戏、音乐、社交
• 新闻 - 资讯、博客、媒体
• 商业 - 电商、服务、平台
• 其他 - 无法归类的书签

书签列表：
${bookmarkList}

输出格式（必须严格遵守）：
[
  { "id": "bookmark_id", "category": "分类名称" }
]

示例输出：
[
  { "id": "123", "category": "技术" },
  { "id": "456", "category": "设计" }
]

现在开始分类，只返回 JSON 数组：`
}

/**
 * 语义搜索增强 Prompt
 */
export function createSemanticSearchPrompt(query: string): string {
  return `用户搜索查询："${query}"

请理解用户的搜索意图，并提取关键概念和同义词。
返回一个 JSON 对象，包含：
- keywords: 关键词数组
- concepts: 核心概念数组
- synonyms: 同义词数组

只返回 JSON，不要其他内容。`
}

/**
 * 标签生成 Prompt
 */
export function createTagGenerationPrompt(bookmark: {
  title: string
  url: string
  content?: string
}): string {
  return `基于这个书签的信息，生成 2-3 个相关标签：
- 标签应该简洁且高级（例如："React", "JavaScript", "Web开发"）
- 只返回 JSON 数组格式的字符串，不要额外解释

书签信息：
标题：${bookmark.title}
URL：${bookmark.url}
${bookmark.content ? `内容摘要：${bookmark.content.slice(0, 300)}` : ''}

返回格式示例：["React", "Hook", "性能优化"]`
}
