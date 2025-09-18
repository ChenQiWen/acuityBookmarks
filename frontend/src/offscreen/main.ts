// Offscreen Document for Heavy Computation
// 用于处理AI分析、书签处理等重计算任务

interface OffscreenMessage {
  target: 'offscreen'
  action: string
  data?: any
  requestId?: string
}

interface OffscreenResponse {
  success: boolean
  data?: any
  error?: string
  requestId?: string
}

// 书签处理工具
class BookmarkProcessor {
  static async processBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): Promise<any> {
    console.log('🔄 开始处理书签数据...');
    
    const result = {
      totalCount: 0,
      urlCount: 0,
      folderCount: 0,
      duplicates: [] as any[],
      categories: {} as Record<string, number>
    };
    
    // 递归处理书签
    const processNode = (node: chrome.bookmarks.BookmarkTreeNode) => {
      result.totalCount++;
      
      if (node.url) {
        result.urlCount++;
        
        // 分析域名分类
        try {
          const domain = new URL(node.url).hostname;
          result.categories[domain] = (result.categories[domain] || 0) + 1;
        } catch {
          // 忽略无效URL
        }
      } else {
        result.folderCount++;
      }
      
      // 处理子节点
      if (node.children) {
        node.children.forEach(processNode);
      }
    };
    
    bookmarks.forEach(processNode);
    
    console.log('✅ 书签处理完成:', result);
    return result;
  }
  
  static async findDuplicates(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): Promise<any[]> {
    console.log('🔍 开始查找重复书签...');
    
    const urlMap = new Map<string, chrome.bookmarks.BookmarkTreeNode[]>();
    const duplicates: any[] = [];
    
    const collectUrls = (node: chrome.bookmarks.BookmarkTreeNode) => {
      if (node.url) {
        if (!urlMap.has(node.url)) {
          urlMap.set(node.url, []);
        }
        urlMap.get(node.url)!.push(node);
      }
      
      if (node.children) {
        node.children.forEach(collectUrls);
      }
    };
    
    bookmarks.forEach(collectUrls);
    
    // 找出重复的URL
    urlMap.forEach((nodes, url) => {
      if (nodes.length > 1) {
        duplicates.push({
          url,
          count: nodes.length,
          bookmarks: nodes.map(n => ({
            id: n.id,
            title: n.title,
            parentId: n.parentId
          }))
        });
      }
    });
    
    console.log(`✅ 发现 ${duplicates.length} 组重复书签`);
    return duplicates;
  }
  
  static async classifyBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): Promise<any> {
    console.log('🧠 开始AI分类书签...');
    
    // 模拟AI分类逻辑
    const categories = {
      'Work': [] as any[],
      'Entertainment': [] as any[],
      'Education': [] as any[],
      'Shopping': [] as any[],
      'Social': [] as any[],
      'Technology': [] as any[],
      'News': [] as any[],
      'Other': [] as any[]
    };
    
    function classifyByDomain(url: string): string {
      try {
        const domain = new URL(url).hostname.toLowerCase();
        
        if (domain.includes('github') || domain.includes('stackoverflow') || domain.includes('dev')) {
          return 'Technology';
        }
        if (domain.includes('youtube') || domain.includes('netflix') || domain.includes('spotify')) {
          return 'Entertainment';
        }
        if (domain.includes('amazon') || domain.includes('shop') || domain.includes('store')) {
          return 'Shopping';
        }
        if (domain.includes('facebook') || domain.includes('twitter') || domain.includes('instagram')) {
          return 'Social';
        }
        if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) {
          return 'News';
        }
        if (domain.includes('edu') || domain.includes('course') || domain.includes('learn')) {
          return 'Education';
        }
        if (domain.includes('office') || domain.includes('workspace') || domain.includes('calendar')) {
          return 'Work';
        }
        
        return 'Other';
      } catch {
        return 'Other';
      }
    }
    
    const processNode = (node: chrome.bookmarks.BookmarkTreeNode) => {
      if (node.url) {
        const categoryName: string = classifyByDomain(node.url)
        ;(categories as any)[categoryName].push({
          id: node.id,
          title: node.title,
          url: node.url,
          parentId: node.parentId
        });
      }
      
      if (node.children) {
        node.children.forEach(processNode);
      }
    };
    
    bookmarks.forEach(processNode);
    
    console.log('✅ 书签分类完成:', Object.entries(categories).map(([cat, items]) => `${cat}: ${items.length}`));
    return categories;
  }
}

// URL检查工具
class UrlChecker {
  static async checkUrls(urls: string[]): Promise<any[]> {
    console.log(`🌐 开始检查 ${urls.length} 个URL...`);
    
    const results: any[] = [];
    const batchSize = 10; // 批处理大小
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(async (url) => {
        try {
          const response = await fetch(url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(10000) // 10秒超时
          });
          
          return {
            url,
            status: response.status,
            ok: response.ok,
            error: null
          };
        } catch (error) {
          return {
            url,
            status: 0,
            ok: false,
            error: (error as Error).message
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 进度通知
      const progress = Math.min(100, Math.round((i + batch.length) / urls.length * 100));
      self.postMessage({
        type: 'progress',
        data: { completed: i + batch.length, total: urls.length, progress }
      });
    }
    
    console.log('✅ URL检查完成');
    return results;
  }
}

// 消息处理器
const messageHandlers = {
  async processBookmarks(data: any): Promise<any> {
    return await BookmarkProcessor.processBookmarks(data.bookmarks);
  },
  
  async findDuplicates(data: any): Promise<any> {
    return await BookmarkProcessor.findDuplicates(data.bookmarks);
  },
  
  async classifyBookmarks(data: any): Promise<any> {
    return await BookmarkProcessor.classifyBookmarks(data.bookmarks);
  },
  
  async checkUrls(data: any): Promise<any> {
    return await UrlChecker.checkUrls(data.urls);
  },
  
  async benchmark(data: any): Promise<any> {
    console.log('⚡ 运行性能基准测试...');
    
    const start = performance.now();
    
    // 模拟重计算任务
    let result = 0;
    for (let i = 0; i < (data.iterations || 1000000); i++) {
      result += Math.sqrt(i);
    }
    
    const duration = performance.now() - start;
    
    return {
      iterations: data.iterations || 1000000,
      duration,
      result,
      performance: `${(data.iterations || 1000000) / duration * 1000} ops/sec`
    };
  }
};

// Chrome消息监听器
chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;
  
  console.log('📨 Offscreen收到消息:', message.action);
  
  const handler = messageHandlers[message.action as keyof typeof messageHandlers];
  if (!handler) {
    const response: OffscreenResponse = {
      success: false,
      error: `未知操作: ${message.action}`,
      requestId: message.requestId
    };
    sendResponse(response);
    return;
  }
  
  // 异步处理
  handler(message.data || {})
    .then((result) => {
      const response: OffscreenResponse = {
        success: true,
        data: result,
        requestId: message.requestId
      };
      sendResponse(response);
    })
    .catch((error) => {
      console.error('❌ Offscreen处理失败:', error);
      const response: OffscreenResponse = {
        success: false,
        error: error.message || '处理失败',
        requestId: message.requestId
      };
      sendResponse(response);
    });
  
  return true; // 保持消息通道开放
});

console.log('🟢 Offscreen Document 已启动');
console.log('⚡ 重计算处理器就绪');

// 导出类型供TypeScript使用
export type { OffscreenMessage, OffscreenResponse };
