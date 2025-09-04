// 测试预加载功能的简单脚本
// 这个脚本用于测试书签预加载功能


// 模拟Chrome扩展环境
const mockChrome = {
  bookmarks: {
    getTree: async () => {
      return [{
        id: '0',
        children: [
          {
            id: '1',
            title: 'Bookmarks bar',
            children: [
              { id: '101', title: 'Google', url: 'https://google.com' },
              { id: '102', title: 'GitHub', url: 'https://github.com' },
              {
                id: '103',
                title: 'Development',
                children: [
                  { id: '104', title: 'MDN', url: 'https://developer.mozilla.org' },
                  { id: '105', title: 'Stack Overflow', url: 'https://stackoverflow.com' }
                ]
              }
            ]
          },
          {
            id: '2',
            title: 'Other bookmarks',
            children: [
              { id: '201', title: 'YouTube', url: 'https://youtube.com' }
            ]
          }
        ]
      }];
    }
  },
  storage: {
    local: {
      set: (data) => {
        return Promise.resolve();
      },
      get: (keys) => {
        return Promise.resolve({ preloadStatus: 'completed', userId: 'test_user_123' });
      }
    }
  },
  notifications: {
    create: (options) => {
    }
  }
};

// 全局对象定义
global.chrome = mockChrome;
global.fetch = async (url, options) => {

  return {
    ok: true,
    json: () => Promise.resolve({
      success: true,
      message: 'Processed 5 bookmarks',
      data: { bookmarksCount: 5, embeddingsCount: 5 }
    })
  };
};

// 导入预加载函数
import('./background.js').then(async () => {

  try {
    // 模拟扩展安装事件
    const installEvent = { reason: 'install' };

    // 调用预加载函数
    const result = await preloadBookmarksToVercel();

  } catch (error) {
  }

}).catch(error => {
});
