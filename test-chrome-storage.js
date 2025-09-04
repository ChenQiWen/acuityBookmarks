// 测试新的Chrome Storage + 内存缓存方案

// 模拟Chrome Storage API
const mockChromeStorage = {
  local: {
    data: {},
    get: function(keys, callback) {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = this.data[key];
        });
      } else if (typeof keys === 'string') {
        result[keys] = this.data[keys];
      } else {
        Object.assign(result, this.data);
      }
      setTimeout(() => callback(result), 10);
    },
    set: function(data, callback) {
      Object.assign(this.data, data);
      setTimeout(() => callback && callback(), 10);
    }
  }
};

// 模拟Chrome API
global.chrome = {
  storage: mockChromeStorage,
  bookmarks: {
    getTree: function(callback) {
      // 模拟书签树数据
      const mockTree = [{
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: '书签栏',
            children: [
              {
                id: '10',
                title: 'Google',
                url: 'https://google.com'
              },
              {
                id: '11',
                title: 'GitHub',
                url: 'https://github.com'
              }
            ]
          }
        ]
      }];
      setTimeout(() => callback(mockTree), 20);
    }
  }
};

// 模拟BookmarkCacheManager
class BookmarkCacheManager {
  constructor() {
    this.bookmarks = new Map();
    this.folders = new Map();
    this.searchIndex = new Map();
    this.metadata = {};
    this.isLoaded = false;
  }

  // 提取搜索关键词
  extractSearchTerms(title, url) {
    const terms = new Set();
    title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 1) terms.add(word);
    });

    if (url) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        domain.split('.').forEach(part => {
          if (part.length > 2) terms.add(part);
        });
      } catch (e) {
        // URL解析失败，跳过
      }
    }

    return Array.from(terms);
  }

  // 展平书签树结构
  flattenBookmarksTree(node, bookmarks = [], folders = [], parentId = null) {
    if (node.children) {
      for (const child of node.children) {
        if (child.url) {
          bookmarks.push({
            id: child.id,
            title: child.title,
            url: child.url,
            parentId: parentId,
            dateAdded: child.dateAdded,
            type: 'bookmark',
            searchTerms: this.extractSearchTerms(child.title, child.url)
          });
        } else if (child.children) {
          folders.push({
            id: child.id,
            title: child.title,
            parentId: parentId,
            dateAdded: child.dateAdded,
            type: 'folder',
            searchTerms: this.extractSearchTerms(child.title, '')
          });
          this.flattenBookmarksTree(child, bookmarks, folders, child.id);
        }
      }
    }
    return { bookmarks, folders };
  }

  // 构建搜索索引
  buildSearchIndex(bookmarks, folders) {
    const searchIndex = {};
    const allItems = [...bookmarks, ...folders];

    allItems.forEach(item => {
      if (item.searchTerms && Array.isArray(item.searchTerms)) {
        item.searchTerms.forEach(term => {
          if (!searchIndex[term]) {
            searchIndex[term] = [];
          }
          searchIndex[term].push(item.id);
        });
      }
    });

    return searchIndex;
  }

  // 处理和存储书签数据
  async processAndStoreBookmarks() {
    const bookmarksTree = await new Promise(resolve => {
      chrome.bookmarks.getTree(resolve);
    });

    const { bookmarks, folders } = this.flattenBookmarksTree(bookmarksTree[0]);
    const searchIndex = this.buildSearchIndex(bookmarks, folders);

    // 保存到Chrome Storage
    await new Promise(resolve => {
      chrome.storage.local.set({
        bookmarks: bookmarks,
        folders: folders,
        searchIndex: searchIndex,
        metadata: {
          version: "1.0",
          lastUpdate: Date.now(),
          bookmarkCount: bookmarks.length + folders.length,
          status: "ready"
        }
      }, resolve);
    });

    return {
      bookmarkCount: bookmarks.length + folders.length,
      processedAt: Date.now()
    };
  }

  // 从Chrome Storage加载数据
  async loadFromStorage() {
    if (this.isLoaded) return;

    const data = await new Promise(resolve => {
      chrome.storage.local.get(['bookmarks', 'folders', 'searchIndex', 'metadata'], resolve);
    });

    this.bookmarks = new Map(data.bookmarks?.map(b => [b.id, b]) || []);
    this.folders = new Map(data.folders?.map(f => [f.id, f]) || []);
    this.searchIndex = new Map(Object.entries(data.searchIndex || {}));
    this.metadata = data.metadata || {};
    this.isLoaded = true;

  }

  // 获取所有书签
  async getAllBookmarks() {
    if (!this.isLoaded) {
      await this.loadFromStorage();
    }

    const allItems = [];
    this.folders.forEach(folder => allItems.push(folder));
    this.bookmarks.forEach(bookmark => allItems.push(bookmark));

    return allItems;
  }

  // 搜索书签
  async searchBookmarks(query, options = {}) {
    const { limit = 20 } = options;
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);

    if (!this.isLoaded) {
      await this.loadFromStorage();
    }

    const results = new Map();

    searchTerms.forEach(term => {
      const itemIds = this.searchIndex.get(term) || [];
      itemIds.forEach(itemId => {
        const existing = results.get(itemId) || {
          id: itemId,
          score: 0,
          matches: [],
          bookmark: this.bookmarks.get(itemId) || this.folders.get(itemId)
        };

        if (existing.bookmark) {
          existing.score += 1;
          existing.matches.push(term);
          results.set(itemId, existing);
        }
      });
    });

    const sortedResults = Array.from(results.values())
      .filter(item => item.bookmark)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.bookmark);

    return sortedResults;
  }
}

// 测试函数
async function testChromeStorageSolution() {
  const manager = new BookmarkCacheManager();

  const result = await manager.processAndStoreBookmarks();

  await manager.loadFromStorage();

  const allBookmarks = await manager.getAllBookmarks();

  const searchResults = await manager.searchBookmarks('google');

  const storageData = await new Promise(resolve => {
    chrome.storage.local.get(null, resolve);
  });
  Object.keys(storageData).forEach(key => {
    const value = storageData[key];
    if (Array.isArray(value)) {
    } else if (typeof value === 'object') {
    } else {
    }
  });

}

// 运行测试
testChromeStorageSolution().catch(() => {});
