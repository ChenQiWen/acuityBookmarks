/**
 * 批量LLM分类器
 * 将多个网页信息一次性发送给LLM进行智能分类
 */
export class BatchClassifier {
  constructor(model) {
    this.model = model;
    this.categories = [
      '前端开发', '后端开发', '移动开发', 'AI/机器学习', '数据科学', 
      '设计工具', 'UI/UX设计', '产品设计',
      '新闻资讯', '技术博客', '学习教程', '文档参考',
      '工具软件', '浏览器扩展', '开发工具',
      '娱乐休闲', '生活方式', '购物网站',
      '社交媒体', '视频平台', '音乐平台',
      '其他'
    ];
  }

  /**
   * 批量分类网页
   * @param {Array} pageInfos - 标准化的网页信息数组
   * @returns {Array} 分类结果数组
   */
  async classifyBatch(pageInfos) {
    console.log(`🤖 开始批量分类 ${pageInfos.length} 个网页...`);
    const startTime = Date.now();

    try {
      // 将所有网页信息格式化为批量prompt
      const batchPrompt = this.createBatchPrompt(pageInfos);
      
      console.log('\n=== 批量LLM INPUT ===');
      console.log('网页数量:', pageInfos.length);
      console.log('Prompt长度:', batchPrompt.length, 'characters');
      console.log('分类选项:', this.categories);
      console.log('批量Prompt预览:\n', batchPrompt.substring(0, 1000) + '...');
      console.log('================\n');

      // 调用LLM
      const result = await this.model.generateContent(batchPrompt);
      const response = await result.response;
      const classificationResult = response.text().trim();

      console.log('\n=== 批量LLM OUTPUT ===');
      console.log('原始响应长度:', classificationResult.length);
      console.log('原始响应:', classificationResult);
      console.log('响应前500字符:', classificationResult.substring(0, 500));
      console.log('================\n');

      // 解析批量分类结果
      const classifications = this.parseBatchResult(classificationResult, pageInfos);
      
      const endTime = Date.now();
      console.log(`✅ 批量分类完成，耗时 ${endTime - startTime}ms`);
      
      return classifications;

    } catch (error) {
      console.error('❌ 批量分类失败:', error);
      // 返回默认分类
      return pageInfos.map(pageInfo => ({
        url: pageInfo.url,
        title: pageInfo.title,
        category: '其他',
        confidence: 0,
        error: error.message
      }));
    }
  }

  /**
   * 创建批量分类的prompt
   */
  createBatchPrompt(pageInfos) {
    const successfulPages = pageInfos.filter(p => p.success !== false);
    
    const prompt = `你是一个专业的网页内容分类专家。请对以下 ${successfulPages.length} 个网页进行分类。

分类选项：[${this.categories.join(', ')}]

请按照以下格式返回结果，每行一个分类结果：
1. [分类名称]
2. [分类名称]
...

网页信息：

${successfulPages.map((pageInfo, index) => {
  return `${index + 1}. 网页URL: ${pageInfo.url}
   标题: ${pageInfo.title}
   描述: ${pageInfo.description}
   关键词: ${pageInfo.keywords.join(', ')}
   网站类型: ${pageInfo.siteType}
   内容摘要: ${pageInfo.content.substring(0, 500)}...
   
`;
}).join('')}

请根据网页的标题、描述、关键词和内容，为每个网页选择最合适的分类。
只返回分类结果，格式如下：
1. [分类名称]
2. [分类名称]
...

开始分类：`;

    return prompt;
  }

  /**
   * 解析批量分类结果
   */
  parseBatchResult(rawResult, pageInfos) {
    const lines = rawResult.split('\n').filter(line => line.trim());
    const classifications = [];
    const successfulPages = pageInfos.filter(p => p.success !== false);

    console.log('🔍 解析批量分类结果...');
    console.log('分割后的行数:', lines.length);
    console.log('成功页面数:', successfulPages.length);
    console.log('前几行内容:', lines.slice(0, 5));
    
    // 尝试解析每一行
    lines.forEach((line, index) => {
      const match = line.match(/^\d+\.\s*(.+)$/);
      const category = match ? match[1].trim() : line.trim();
      
      console.log(`第${index + 1}行: "${line}" -> 提取分类: "${category}"`);
      
      if (index < successfulPages.length) {
        const pageInfo = successfulPages[index];
        
        // 验证分类是否在允许的列表中
        const validCategory = this.categories.includes(category) ? category : '其他';
        
        console.log(`URL: ${pageInfo.url} -> 原始分类: "${category}" -> 最终分类: "${validCategory}"`);
        
        classifications.push({
          url: pageInfo.url,
          title: pageInfo.title,
          category: validCategory,
          originalCategory: category,
          confidence: this.categories.includes(category) ? 0.9 : 0.1,
          pageInfo: pageInfo
        });
      }
    });

    // 处理解析失败的网页
    pageInfos.forEach(pageInfo => {
      if (pageInfo.success === false) {
        classifications.push({
          url: pageInfo.url,
          title: pageInfo.title || '解析失败',
          category: '其他',
          confidence: 0,
          error: pageInfo.error,
          pageInfo: pageInfo
        });
      }
    });

    // 确保返回的数量与输入一致
    while (classifications.length < pageInfos.length) {
      const missingIndex = classifications.length;
      if (missingIndex < pageInfos.length) {
        classifications.push({
          url: pageInfos[missingIndex].url,
          title: pageInfos[missingIndex].title,
          category: '其他',
          confidence: 0,
          error: '解析失败',
          pageInfo: pageInfos[missingIndex]
        });
      }
    }

    console.log('\n=== 分类结果统计 ===');
    const categoryStats = {};
    classifications.forEach(c => {
      categoryStats[c.category] = (categoryStats[c.category] || 0) + 1;
    });
    console.log('分类统计:', categoryStats);
    console.log('成功分类:', classifications.filter(c => c.confidence > 0.5).length);
    console.log('==================\n');

    return classifications;
  }

  /**
   * 分块处理大量网页（如果单次处理太多）
   */
  async classifyInChunks(pageInfos, chunkSize = 20) {
    const chunks = this.chunkArray(pageInfos, chunkSize);
    const allResults = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`处理第 ${i + 1}/${chunks.length} 批网页...`);
      const chunkResults = await this.classifyBatch(chunks[i]);
      allResults.push(...chunkResults);
      
      // 避免API速率限制
      if (i < chunks.length - 1) {
        await this.sleep(1000); // 等待1秒
      }
    }

    return allResults;
  }

  /**
   * 工具方法：数组分块
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 工具方法：等待
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BatchClassifier;
