
// --- State ---
let pollingInterval = null;
let currentJobId = null;
let isServiceWorkerActive = false;

// --- Cache Management ---
let bookmarksCache = {
  data: null,
  lastUpdate: null,
  checksum: null
};

let bookmarksChangeListeners = [];

// 计算书签数据的校验和
function calculateBookmarksChecksum(bookmarks) {
  const simplified = JSON.stringify(bookmarks, (key, value) => {
    // 只包含关键字段用于校验和计算
    if (['id', 'title', 'url', 'children'].includes(key)) {
      return value;
    }
    return undefined;
  });
  return btoa(simplified).slice(0, 16); // 简化的校验和
}

// 检查书签是否有变化
function hasBookmarksChanged() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((tree) => {
      const newChecksum = calculateBookmarksChecksum(tree);
      const hasChanged = bookmarksCache.checksum !== newChecksum;
      resolve(hasChanged);
    });
  });
}

// --- Performance Monitoring ---
const performanceMetrics = {
  dataProcessingTimes: [],
  storageOperationTimes: [],
  messageResponseTimes: []
};

function recordPerformanceMetric(type, duration) {
  if (performanceMetrics[type]) {
    performanceMetrics[type].push(duration);
    // Keep only last 10 measurements
    if (performanceMetrics[type].length > 10) {
      performanceMetrics[type].shift();
    }
  }
}

function getAveragePerformance(type) {
  if (!performanceMetrics[type] || performanceMetrics[type].length === 0) {
    return 0;
  }
  return performanceMetrics[type].reduce((a, b) => a + b, 0) / performanceMetrics[type].length;
}

// --- Core Functions ---

function getAllBookmarks(callback) {
  chrome.bookmarks.getTree((bookmarkTree) => {
    const bookmarks = [];
    function traverse(nodes) {
      for (const node of nodes) {
        if (node.url) {
          bookmarks.push({ title: node.title, url: node.url, id: node.id, parentId: node.parentId });
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    }
    traverse(bookmarkTree);
    callback(bookmarks);
  });
}

async function pollJobStatus(jobId) {
  if (currentJobId !== jobId) return;
  try {
    const response = await fetch(`http://localhost:3000/api/get-progress/${jobId}`);
    if (!response.ok) throw new Error('Failed to fetch progress');
    const job = await response.json();
    await chrome.storage.local.set({
      isGenerating: job.status !== 'complete' && job.status !== 'failed',
      progressCurrent: job.progress,
      progressTotal: job.total,
    });
    if (job.status === 'complete') {
      const originalTree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
      await chrome.storage.local.set({
        originalTree,
        newProposal: job.result,
        processedAt: new Date().toISOString(),
      });
      stopPolling();

      // 通知前端AI整理已完成
      chrome.runtime.sendMessage({ action: 'aiOrganizeComplete' });
    } else if (job.status === 'failed') {
      stopPolling();
    }
  } catch (error) {
    stopPolling();
    await chrome.storage.local.set({ isGenerating: false });
  }
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    currentJobId = null;
  }
}

async function triggerRestructure() {
  if (currentJobId) {
    return;
  }


  // 通知前端AI整理已开始
  chrome.runtime.sendMessage({ action: 'aiOrganizeStarted' });

  try {
    // Obsolete quickAddedBookmarks logic removed.
    const bookmarks = await new Promise(resolve => getAllBookmarks(resolve));
    const response = await fetch('http://localhost:3000/api/start-processing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmarks }),
    });
    if (!response.ok) throw new Error('Failed to start processing job');
    const { jobId } = await response.json();
    currentJobId = jobId;
    pollingInterval = setInterval(() => pollJobStatus(jobId), 2000);
  } catch (error) {
    await chrome.storage.local.set({ isGenerating: false });
  }
}

function openManagementTab(mode = null) {
  let managementUrl = 'dist/management.html';
  if (mode) {
    managementUrl += `?mode=${mode}`;
  }

  const fullUrl = chrome.runtime.getURL(managementUrl);

  chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html*') }, (tabs) => {
    if (tabs.length > 0) {
      // 检查当前页面的URL是否已经包含正确的参数
      const currentTab = tabs[0];
      const currentUrl = currentTab.url || '';

      if (currentUrl === fullUrl) {
        // URL已经正确，只需要激活页面
        chrome.tabs.update(currentTab.id, { active: true });
        chrome.windows.update(currentTab.windowId, { focused: true });
      } else {
        // URL不匹配，需要更新
        chrome.tabs.update(currentTab.id, { url: fullUrl, active: true });
        chrome.windows.update(currentTab.windowId, { focused: true });
      }
    } else {
      // 如果没有该页面，创建新页面
      chrome.tabs.create({ url: managementUrl });
    }
  });
}

async function applyChanges(proposal) {
  try {
    // 1. Create a backup folder with a timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const backupFolder = await chrome.bookmarks.create({
      parentId: '2', // 'Other bookmarks'
      title: `AcuityBookmarks Backup [${timestamp}]`,
    });

    // 2. Move existing bookmarks to the backup folder
    const bookmarksBar = (await chrome.bookmarks.getChildren('1')) || [];
    const otherBookmarks = (await chrome.bookmarks.getChildren('2')) || [];

    for (const node of bookmarksBar) {
      await chrome.bookmarks.move(node.id, { parentId: backupFolder.id });
    }
    // Move all children of "Other Bookmarks" except the newly created backup folder
    for (const node of otherBookmarks) {
      if (node.id !== backupFolder.id) {
        await chrome.bookmarks.move(node.id, { parentId: backupFolder.id });
      }
    }

    // 3. Create the new structure
    const proposalRoot = proposal.children || [];
    const proposalBookmarksBar = proposalRoot.find(n => n.title === '书签栏');
    const proposalOtherBookmarks = proposalRoot.find(n => n.title === '其他书签');

    const createNodes = async (nodes, parentId) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) { // It's a folder with content
          const newFolder = await chrome.bookmarks.create({ parentId, title: node.title });
          await createNodes(node.children, newFolder.id);
        } else if (!node.children) { // It's a bookmark
          await chrome.bookmarks.create({ parentId, title: node.title, url: node.url });
        }
        // Empty folders from the proposal are ignored
      }
    };

    if (proposalBookmarksBar && proposalBookmarksBar.children) {
      await createNodes(proposalBookmarksBar.children, '1');
    }
    if (proposalOtherBookmarks && proposalOtherBookmarks.children) {
      await createNodes(proposalOtherBookmarks.children, '2');
    }

    // Notify frontend that the apply is complete so it can refresh the left panel
    chrome.runtime.sendMessage({ action: 'applyComplete' });

  } catch (error) {
    throw error; // Re-throw error so it can be caught by the message handler
  }
}


// --- New Helper Functions for Smart Bookmark ---

function getFolders(callback) {
  chrome.bookmarks.getTree((bookmarkTree) => {
    const folders = [];
    function traverse(nodes, path) {
      for (const node of nodes) {
        if (node.children) {
          const currentPath = path ? `${path}/${node.title}` : node.title;
          // We only care about user-created folders, not the root nodes
          if (node.id !== '0' && node.id !== '1' && node.id !== '2') {
            folders.push({ id: node.id, path: currentPath });
          }
          traverse(node.children, currentPath);
        }
      }
    }
    traverse(bookmarkTree[0].children, '');
    callback(folders);
  });
}

async function findOrCreateFolder(category) {
  return new Promise((resolve) => {
    getFolders(async (folders) => {
      // Simple match for now, find a folder whose path ends with the category name
      const existingFolder = folders.find(f => f.path.endsWith(category));
      if (existingFolder) {
        resolve(existingFolder.id);
        return;
      }
      
      // If not found, create it under the "Bookmarks Bar" (id: '1')
      try {
        const newFolder = await chrome.bookmarks.create({
          parentId: '1',
          title: category,
        });
        resolve(newFolder.id);
      } catch (e) {
        // If creation fails (e.g., name conflict), default to "Other Bookmarks"
        resolve('2');
      }
    });
  });
}

// --- Event Listeners ---

// Service Worker lifecycle management
chrome.runtime.onStartup.addListener(() => {
  isServiceWorkerActive = true;
});

chrome.runtime.onSuspend.addListener(() => {
  isServiceWorkerActive = false;
  // Clean up any ongoing operations
  stopPolling();
});

// --- Bookmarks Change Listeners ---
function setupBookmarksChangeListeners() {
  // 监听书签创建
  chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {

    try {
      // 如果IndexedDB已初始化，同步更新
      if (localBookmarksManager.isInitialized && bookmark.url) {
        const bookmarkData = {
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          parentId: bookmark.parentId,
          dateAdded: bookmark.dateAdded,
          searchTerms: localBookmarksManager.extractSearchTerms(bookmark.title, bookmark.url)
        };

        await localBookmarksManager.updateBookmark(bookmarkData);
      }
    } catch (error) {
    }

    // 更新缓存时间戳
    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });

  // 监听书签删除
  chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {

    try {
      // 如果IndexedDB已初始化，删除对应记录
      if (localBookmarksManager.isInitialized) {
        const transaction = localBookmarksManager.db.transaction(['bookmarks', 'searchIndex'], 'readwrite');

        // 删除书签记录
        const bookmarkStore = transaction.objectStore('bookmarks');
        await new Promise((resolve, reject) => {
          const request = bookmarkStore.delete(id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // 删除搜索索引记录
        const searchStore = transaction.objectStore('searchIndex');
        await new Promise((resolve, reject) => {
          const request = searchStore.delete(id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

      }
    } catch (error) {
    }

    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });

  // 监听书签修改
  chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {

    try {
      // 如果IndexedDB已初始化，更新对应记录
      if (localBookmarksManager.isInitialized) {
        // 获取完整的书签信息
        const bookmark = await new Promise((resolve) => {
          chrome.bookmarks.get(id, (results) => {
            resolve(results[0]);
          });
        });

        if (bookmark && bookmark.url) {
          const bookmarkData = {
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            parentId: bookmark.parentId,
            dateAdded: bookmark.dateAdded,
            searchTerms: localBookmarksManager.extractSearchTerms(bookmark.title, bookmark.url)
          };

          await localBookmarksManager.updateBookmark(bookmarkData);
        }
      }
    } catch (error) {
    }

    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });

  // 监听书签移动
  chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {

    try {
      // 如果IndexedDB已初始化，更新parentId
      if (localBookmarksManager.isInitialized) {
        const transaction = localBookmarksManager.db.transaction(['bookmarks'], 'readwrite');
        const store = transaction.objectStore('bookmarks');

        await new Promise((resolve, reject) => {
          const request = store.get(id);
          request.onsuccess = (event) => {
            const bookmark = event.target.result;
            if (bookmark) {
              bookmark.parentId = moveInfo.parentId;
              store.put(bookmark);
            }
            resolve();
          };
          request.onerror = () => reject(request.error);
        });

      }
    } catch (error) {
    }

    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });

}

// 本地化书签数据预处理和索引构建
// --- Optimized Bookmark Cache Manager ---
// 书签缓存管理器：使用Chrome Storage + 内存缓存
class BookmarkCacheManager {
  constructor() {
    this.bookmarks = new Map();
    this.folders = new Map();
    this.searchIndex = new Map();
    this.metadata = {};
    this.isLoaded = false;
  }

  // 预处理和存储书签数据
  async processAndStoreBookmarks() {
    try {

      // 获取Chrome书签数据
      const bookmarksTree = await chrome.bookmarks.getTree();
      const { bookmarks, folders } = this.flattenBookmarksTree(bookmarksTree[0]);


      if (bookmarks.length === 0 && folders.length === 0) {
        return;
      }

      // 构建搜索索引
      const searchIndex = this.buildSearchIndex(bookmarks, folders);

      // 保存到Chrome Storage
      const totalCount = bookmarks.length + folders.length;
      await chrome.storage.local.set({
        bookmarks: bookmarks,
        folders: folders,
        searchIndex: searchIndex,
        metadata: {
          version: "1.0",
          lastUpdate: Date.now(),
          bookmarkCount: totalCount,
          status: "ready"
        }
      });


      return {
        bookmarkCount: totalCount,
        processedAt: Date.now()
      };

    } catch (error) {
      throw error;
    }
  }

  // 展平书签树结构，返回分离的bookmarks和folders
  flattenBookmarksTree(node, bookmarks = [], folders = [], parentId = null) {
    if (node.children) {
      for (const child of node.children) {
        if (child.url) {
          // 这是书签
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
          // 这是文件夹
          folders.push({
            id: child.id,
            title: child.title,
            parentId: parentId,
            dateAdded: child.dateAdded,
            type: 'folder',
            searchTerms: this.extractSearchTerms(child.title, '')
          });
          // 继续递归处理子节点
          this.flattenBookmarksTree(child, bookmarks, folders, child.id);
        }
      }
    }
    return { bookmarks, folders };
  }

  // 提取搜索关键词
  extractSearchTerms(title, url) {
    const terms = new Set();

    // 添加标题词
    title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 1) terms.add(word);
    });

    // 添加URL关键词
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      domain.split('.').forEach(part => {
        if (part.length > 2) terms.add(part);
      });

      // 添加路径关键词
      urlObj.pathname.split('/').forEach(part => {
        if (part.length > 2 && !part.includes('.')) {
          terms.add(part.toLowerCase());
        }
      });
    } catch (e) {
      // URL解析失败，跳过
    }

    return Array.from(terms);
  }

  // 存储书签数据
  async storeBookmarks(bookmarks) {
    const transaction = this.db.transaction(['bookmarks'], 'readwrite');
    const store = transaction.objectStore('bookmarks');

    for (const bookmark of bookmarks) {
      await new Promise((resolve, reject) => {
        const request = store.put(bookmark);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // 构建搜索索引
  // 构建搜索索引，返回对象格式
  buildSearchIndex(bookmarks, folders) {
    const searchIndex = {};

    // 处理所有书签和文件夹
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

  // 保存元数据（不再需要，元数据直接保存到Chrome Storage）
  async saveMetadata(metadata) {
  }

  // 搜索书签（基于内存缓存）
  async searchBookmarks(query, options = {}) {
    const { limit = 20 } = options;
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);

    if (!this.isLoaded) {
      await this.loadFromStorage();
    }

    const results = new Map();

    // 搜索所有关键词
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

    // 转换为数组并排序
    const sortedResults = Array.from(results.values())
      .filter(item => item.bookmark) // 确保有对应的书签/文件夹
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.bookmark);

    return sortedResults;
  }

  // 获取所有书签和文件夹
  async getAllBookmarks() {
    if (!this.isLoaded) {
      await this.loadFromStorage();
    }

    const allItems = [];
    // 合并书签和文件夹
    this.folders.forEach(folder => allItems.push(folder));
    this.bookmarks.forEach(bookmark => allItems.push(bookmark));

    return allItems;
  }

  // 从Chrome Storage加载数据
  async loadFromStorage() {
    if (this.isLoaded) return;

    try {
      const data = await chrome.storage.local.get([
        'bookmarks', 'folders', 'searchIndex', 'metadata'
      ]);

      // 转换为Map结构
      this.bookmarks = new Map(data.bookmarks?.map(b => [b.id, b]) || []);
      this.folders = new Map(data.folders?.map(f => [f.id, f]) || []);
      this.searchIndex = new Map(Object.entries(data.searchIndex || {}));
      this.metadata = data.metadata || {};

      this.isLoaded = true;

    } catch (error) {
    }
  }

  // 更新书签数据（内存缓存版本）
  async updateBookmark(bookmark) {
    if (!this.isLoaded) {
      await this.loadFromStorage();
    }

    // 更新搜索关键词
    bookmark.searchTerms = this.extractSearchTerms(bookmark.title, bookmark.url);

    // 更新内存缓存
    if (bookmark.type === 'bookmark') {
      this.bookmarks.set(bookmark.id, bookmark);
    } else {
      this.folders.set(bookmark.id, bookmark);
    }

  }

  // 获取书签数量统计
  async getBookmarkCount() {
    if (!this.isLoaded) {
      await this.loadFromStorage();
    }
    return this.bookmarks.size + this.folders.size;
  }
}

// 全局实例
const localBookmarksManager = new BookmarkCacheManager();

// 兼容性函数
async function preloadBookmarksToVercel() {
  return await localBookmarksManager.processAndStoreBookmarks();
}

// 从扁平化的书签数据构建树状结构
function buildTreeFromBookmarks(bookmarks) {

  // 创建节点映射
  const nodeMap = new Map();
  const root = { id: '0', title: '', children: [] };

  // 首先创建所有节点
  bookmarks.forEach(bookmark => {
    const node = {
      id: bookmark.id,
      title: bookmark.title,
      parentId: bookmark.parentId,
      dateAdded: bookmark.dateAdded
    };

    // 只有文件夹节点才有children属性
    if (bookmark.type === 'folder') {
      node.children = [];
    } else if (bookmark.type === 'bookmark') {
      node.url = bookmark.url;
    }

    nodeMap.set(bookmark.id, node);
  });

  // 构建树结构
  bookmarks.forEach(bookmark => {
    const node = nodeMap.get(bookmark.id);

    if (bookmark.parentId && bookmark.parentId !== '0') {
      const parent = nodeMap.get(bookmark.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // 父节点不存在，添加到根节点
        root.children.push(node);
      }
    } else {
      // 根级书签
      root.children.push(node);
    }
  });

  // 对文件夹进行排序（文件夹排在前面，书签排在后面）
  function sortChildren(node) {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => {
        // 文件夹（有children属性）排在前面
        if (a.children && !b.children) return -1;
        if (!a.children && b.children) return 1;
        // 同类型按标题排序
        return a.title.localeCompare(b.title);
      });

      // 递归排序子节点
      node.children.forEach(child => {
        if (child.children) {
          sortChildren(child);
        }
      });
    }
  }

  root.children.forEach(sortChildren);

  return {
    totalNodes: root.children.length,
    folders: root.children.filter(n => n.children).length,
    bookmarks: root.children.filter(n => !n.children).length
  };

  return [root];
}

// 删除旧的flattenBookmarksTree函数，已在LocalBookmarksManager中实现

// On install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  isServiceWorkerActive = true;

  // Initialize storage with default values
  await chrome.storage.local.set({
    isGenerating: false,
    progressCurrent: 0,
    progressTotal: 0,
    processedAt: null,
    preloadStatus: 'pending'
  });

  // Setup bookmarks change listeners
  setupBookmarksChangeListeners();

  // 初始化IndexedDB（无论安装还是更新）
  try {
    await localBookmarksManager.initDB();
  } catch (error) {
  }

  // 预加载书签数据（仅在首次安装时）
  if (details.reason === 'install') {

    try {
      const result = await preloadBookmarksToVercel();

      // 显示通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'AcuityBookmarks',
        message: `已成功处理 ${result.bookmarkCount} 个书签数据！`
      });

    } catch (error) {

      // 显示错误通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'AcuityBookmarks',
        message: '书签数据预加载失败，请稍后重试'
      });
    }
  }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Using a switch statement for better organization
  switch (request.action) {
    case 'prepareManagementData':

      // 立即开始数据准备，不延迟
      (async () => {
        try {

          // 1. 快速检查chrome.storage状态（同步读取）
          const data = await new Promise(resolve => {
            chrome.storage.local.get(['localDataStatus', 'lastLocalUpdate', 'localBookmarkCount'], resolve);
          });

          // 2. 检查内存缓存状态
          if (!localBookmarksManager.isLoaded) {
            await localBookmarksManager.loadFromStorage();
          }

          // 3. 快速检查IndexedDB是否有数据
          const bookmarks = await localBookmarksManager.getAllBookmarks();

          // 4. 根据状态决定处理方式
          if (bookmarks.length > 0 && data.localDataStatus === 'ready') {

            // 直接通知前端数据已准备好
            chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html*') }, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'dataReady',
                  fromCache: true,
                  localData: {
                    status: 'ready',
                    bookmarkCount: data.localBookmarkCount || bookmarks.length,
                    lastUpdate: data.lastLocalUpdate || Date.now()
                  }
                });
              }
            });

          } else {

            // 异步处理书签数据，但不阻塞前端响应
            (async () => {
              try {
                await localBookmarksManager.processAndStoreBookmarks();
                const newBookmarkCount = await localBookmarksManager.getBookmarkCount();

                await chrome.storage.local.set({
                  localDataStatus: 'ready',
                  lastLocalUpdate: Date.now(),
                  localBookmarkCount: newBookmarkCount
                });

                // 重新通知前端数据已更新
                chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html*') }, (tabs) => {
                  if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'dataReady',
                      fromCache: false,
                      localData: {
                        status: 'ready',
                        bookmarkCount: newBookmarkCount,
                        lastUpdate: Date.now()
                      }
                    });
                  }
                });
              } catch (error) {
              }
            })();

            // 先通知前端有缓存数据可用
            chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html*') }, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'dataReady',
                  fromCache: true,
                  localData: {
                    status: 'ready',
                    bookmarkCount: bookmarks.length,
                    lastUpdate: data.lastLocalUpdate || Date.now()
                  }
                });
              }
            });
          }

        } catch (error) {

          // 通知前端数据准备失败
          chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html*') }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'dataReady',
                fromCache: false,
                localData: {
                  status: 'error',
                  error: error.message
                }
              });
            }
          });
        }
      })();

      return true;

    case 'showManagementPage':

      // 支持popup页面传递的mode参数，默认使用manual模式
      const mode = request.mode || 'manual';

      // 打开管理页面，传递模式参数
      openManagementTab(mode);

      // 检查本地数据状态
      setTimeout(async () => {
        try {
          // 确保数据已加载到内存缓存
          if (!localBookmarksManager.isLoaded) {
            await localBookmarksManager.loadFromStorage();
          }

          // 检查内存缓存中的数据
          const bookmarks = await localBookmarksManager.getAllBookmarks();

          // 获取chrome.storage状态
          chrome.storage.local.get(['localDataStatus', 'lastLocalUpdate', 'localBookmarkCount'], async (data) => {

            // 如果IndexedDB有数据且状态一致，直接使用
            if (bookmarks.length > 0 && data.localDataStatus === 'ready') {

              // 通知前端数据已准备好
              chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html') }, (tabs) => {
                if (tabs.length > 0) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'dataReady',
                    fromCache: true,
                    localData: {
                      bookmarkCount: bookmarks.length,
                      lastUpdate: data.lastLocalUpdate || Date.now(),
                      status: 'cached'
                    }
                  });
                }
              });

              return;
            }

            // 如果IndexedDB有数据但状态不一致，重新同步状态
            if (bookmarks.length > 0 && data.localDataStatus !== 'ready') {

              // 更新chrome.storage状态
              await chrome.storage.local.set({
                localDataStatus: 'ready',
                lastLocalUpdate: Date.now(),
                localBookmarkCount: bookmarks.length
              });

              // 通知前端
              chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html') }, (tabs) => {
                if (tabs.length > 0) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'dataReady',
                    fromCache: true,
                    localData: {
                      bookmarkCount: bookmarks.length,
                      lastUpdate: Date.now(),
                      status: 'recovered'
                    }
                  });
                }
              });

              return;
            }

            // 如果IndexedDB没有数据，需要重新处理

            try {
              // 处理和存储书签数据
              const result = await localBookmarksManager.processAndStoreBookmarks();

              // 通知前端数据已准备好
              chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html') }, (tabs) => {
                if (tabs.length > 0) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'dataReady',
                    fromCache: false,
                    localData: {
                      bookmarkCount: result.bookmarkCount,
                      lastUpdate: result.processedAt,
                      status: 'processed'
                    }
                  });
                }
              });


            } catch (error) {

              // 降级到基础Chrome书签API

              chrome.bookmarks.getTree(tree => {
                const proposal = { '书签栏': {}, '其他书签': [] };
                const bookmarksBar = tree[0]?.children?.find(c => c.id === '1');
                const otherBookmarks = tree[0]?.children?.find(c => c.id === '2');

                if (bookmarksBar) {
                  const rootBookmarks = [];
                  bookmarksBar.children?.forEach(node => {
                    if (node.children) {
                      const simplifiedChildren = node.children.map(child => ({
                        id: child.id,
                        title: child.title,
                        url: child.url,
                        children: child.children ? child.children.map(c => ({
                          id: c.id,
                          title: c.title,
                          url: c.url
                        })) : undefined
                      }));
                      proposal['书签栏'][node.title] = simplifiedChildren;
                    } else {
                      rootBookmarks.push({
                        id: node.id,
                        title: node.title,
                        url: node.url
                      });
                    }
                  });
                  if (rootBookmarks.length > 0) {
                    proposal['书签栏']['书签栏根目录'] = rootBookmarks;
                  }
                }

                if (otherBookmarks) {
                  proposal['其他书签'] = otherBookmarks.children?.map(child => ({
                    id: child.id,
                    title: child.title,
                    url: child.url,
                    children: child.children ? child.children.map(c => ({
                      id: c.id,
                      title: c.title,
                      url: c.url
                    })) : undefined
                  })) || [];
                }

                // 保存基础数据
                chrome.storage.local.set({
                  originalTree: tree,
                  newProposal: proposal,
                  isGenerating: false,
                  processedAt: new Date().toISOString()
                });

                // 通知前端
                chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html') }, (tabs) => {
                  if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'dataReady',
                      fromCache: false,
                      localData: {
                        status: 'fallback',
                        error: 'IndexedDB初始化失败，使用基础模式'
                      }
                    });
                  }
                });
              });
            }
          });
        } catch (error) {
          // 如果整个setTimeout回调失败，尝试基础模式
          chrome.bookmarks.getTree(tree => {
            const proposal = { '书签栏': {}, '其他书签': [] };
            const bookmarksBar = tree[0]?.children?.find(c => c.id === '1');
            const otherBookmarks = tree[0]?.children?.find(c => c.id === '2');

            if (bookmarksBar) {
              const rootBookmarks = [];
              bookmarksBar.children?.forEach(node => {
                if (node.children) {
                  const simplifiedChildren = node.children.map(child => ({
                    id: child.id,
                    title: child.title,
                    url: child.url,
                    children: child.children ? child.children.map(c => ({
                      id: c.id,
                      title: c.title,
                      url: c.url
                    })) : undefined
                  }));
                  proposal['书签栏'][node.title] = simplifiedChildren;
                } else {
                  rootBookmarks.push({
                    id: node.id,
                    title: node.title,
                    url: node.url
                  });
                }
              });
              if (rootBookmarks.length > 0) {
                proposal['书签栏']['书签栏根目录'] = rootBookmarks;
              }
            }

            if (otherBookmarks) {
              proposal['其他书签'] = otherBookmarks.children?.map(child => ({
                id: child.id,
                title: child.title,
                url: child.url,
                children: child.children ? child.children.map(c => ({
                  id: c.id,
                  title: c.title,
                  url: c.url
                })) : undefined
              })) || [];
            }

            chrome.storage.local.set({
              originalTree: tree,
              newProposal: proposal,
              isGenerating: false,
              processedAt: new Date().toISOString()
            });

            chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html') }, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'dataReady',
                  fromCache: false,
                  localData: {
                    status: 'fallback',
                    error: 'setTimeout回调失败，使用基础模式'
                  }
                });
              }
            });
          });
        }
      }, 100); // 短暂延迟让页面先加载

      return true;

    case 'searchBookmarks':
      const { query, limit = 20 } = request;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        sendResponse({ error: 'Invalid search query' });
        return false;
      }

      // 异步搜索
      (async () => {
        try {
          const results = await localBookmarksManager.searchBookmarks(query, { limit });
          sendResponse({
            success: true,
            query,
            results,
            total: results.length
          });
        } catch (error) {
          sendResponse({
            error: 'Search failed',
            details: error.message
          });
        }
      })();

      return true; // 异步响应

    case 'getIndexedDBBookmarks':

      // 异步获取IndexedDB数据
      (async () => {
        try {
          // 确保IndexedDB已初始化
          if (!localBookmarksManager.isInitialized) {
            await localBookmarksManager.initDB();
          }

          // 获取所有书签数据
          const bookmarks = await localBookmarksManager.getAllBookmarks();

          // 构建树状结构（模拟Chrome书签树结构）
          const treeData = buildTreeFromBookmarks(bookmarks);

          sendResponse({
            success: true,
            data: treeData,
            bookmarkCount: bookmarks.length
          });
        } catch (error) {
          sendResponse({
            error: 'Failed to get IndexedDB data',
            details: error.message
          });
        }
      })();

      return true; // 异步响应

    case 'showManagementPageAndOrganize':
      // 打开管理页面，传递AI整理模式参数
      openManagementTab('ai');

      // 延迟触发重构，让页面先加载
      setTimeout(() => {
        triggerRestructure();
      }, 1000);

      return true;

    case 'clearCacheAndRestructure':
      stopPolling();
      (async () => {
        try {
          const response = await fetch('http://localhost:3000/api/clear-cache', { method: 'POST' });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Failed to clear cache');
          }
          // Do not trigger restructure automatically, let the user decide.
          await chrome.storage.local.remove('newProposal');
          sendResponse({ status: 'success', message: data.message });
        } catch (error) {
          sendResponse({ status: 'error', message: error.message });
        }
      })();
      return true; // Indicates asynchronous response

    case 'applyChanges':
      (async () => {
        try {
          await applyChanges(request.proposal);
          // Send success response to frontend
          sendResponse({ success: true });
        } catch (error) {
          // Send error response to frontend
          sendResponse({ success: false, error: error.message || 'Unknown error' });
        }
      })();
      return true; // Indicates asynchronous response

    case 'searchBookmarks':
      getAllBookmarks(async (bookmarks) => {
        try {
          const response = await fetch('http://localhost:3000/api/search-bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: request.query,
              bookmarks: bookmarks,
              mode: request.mode || 'fast'
            }),
          });
          if (!response.ok) throw new Error('Failed to search bookmarks');
          const result = await response.json();

          // Ensure the result has the correct structure
          const safeResult = {
            results: Array.isArray(result.results) ? result.results : [],
            stats: result.stats || {},
            mode: result.mode || request.mode || 'fast',
            query: result.query || request.query
          };

          sendResponse(safeResult);
        } catch (error) {
          sendResponse({
            results: [],
            stats: { totalBookmarks: 0, processedBookmarks: 0, networkRequests: 0, searchTime: 0 },
            mode: request.mode || 'fast',
            query: request.query,
            error: error.message
          });
        }
      });
      return true;

    case 'smartBookmark':
      (async () => {
        try {
          const { bookmark } = request;
          if (!bookmark || !bookmark.url) {
            throw new Error("Invalid bookmark data received.");
          }

          const existing = await chrome.bookmarks.search({ url: bookmark.url });

          if (existing.length > 0) {
            // As per user feedback, we will proceed even if the bookmark exists.
            // A future improvement would be to confirm with the user via a custom dialog in the popup.
          }

          const folders = await new Promise(resolve => getFolders(resolve));
          const folderPaths = folders.map(f => f.path);

          const response = await fetch('http://localhost:3000/api/classify-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: bookmark.title,
              url: bookmark.url,
              categories: folderPaths,
            }),
          });

          if (!response.ok) throw new Error('API classification failed');

          const { category } = await response.json();
          const parentId = await findOrCreateFolder(category);

          await chrome.bookmarks.create({
            parentId,
            title: bookmark.title,
            url: bookmark.url,
          });

          sendResponse({ status: 'success', folder: category });

        } catch (error) {
          sendResponse({ status: 'error', error: error.message });
        }
      })();
      return true; // Indicates asynchronous response

    case 'healthCheck':
      sendResponse({
        status: 'healthy',
        version: chrome.runtime.getManifest().version,
        serviceWorkerActive: isServiceWorkerActive,
        timestamp: new Date().toISOString(),
        pollingActive: pollingInterval !== null,
        currentJobId: currentJobId,
        performanceMetrics: {
          avgDataProcessingTime: getAveragePerformance('dataProcessingTimes'),
          avgStorageTime: getAveragePerformance('storageOperationTimes'),
          avgMessageResponseTime: getAveragePerformance('messageResponseTimes'),
          dataProcessingCount: performanceMetrics.dataProcessingTimes.length,
          storageOperationCount: performanceMetrics.storageOperationTimes.length
        }
      });
      return false;

    case 'forceRefreshData':

      // 清除缓存，强制重新获取数据
      bookmarksCache.data = null;
      bookmarksCache.lastUpdate = null;
      bookmarksCache.checksum = null;


      // 重新获取并处理数据
      chrome.bookmarks.getTree(tree => {

        const startTime = performance.now();

        // 更新缓存信息
        bookmarksCache.data = tree;
        bookmarksCache.lastUpdate = Date.now();
        bookmarksCache.checksum = calculateBookmarksChecksum(tree);

        // 处理数据（复用之前的逻辑）
        const proposal = { '书签栏': {}, '其他书签': [] };
        const bookmarksBar = tree[0]?.children?.find(c => c.id === '1');
        const otherBookmarks = tree[0]?.children?.find(c => c.id === '2');

        if (bookmarksBar) {
          const rootBookmarks = [];
          bookmarksBar.children?.forEach(node => {
            if (node.children) {
              const simplifiedChildren = node.children.map(child => ({
                id: child.id,
                title: child.title,
                url: child.url,
                children: child.children ? child.children.map(c => ({
                  id: c.id,
                  title: c.title,
                  url: c.url
                })) : undefined
              }));
              proposal['书签栏'][node.title] = simplifiedChildren;
            } else {
              rootBookmarks.push({
                id: node.id,
                title: node.title,
                url: node.url
              });
            }
          });
          if (rootBookmarks.length > 0) {
            proposal['书签栏']['书签栏根目录'] = rootBookmarks;
          }
        }

        if (otherBookmarks) {
          proposal['其他书签'] = otherBookmarks.children?.map(child => ({
            id: child.id,
            title: child.title,
            url: child.url,
            children: child.children ? child.children.map(c => ({
              id: c.id,
              title: c.title,
              url: c.url
            })) : undefined
          })) || [];
        }

        const processingTime = performance.now() - startTime;

        chrome.storage.local.set({
          originalTree: tree,
          newProposal: proposal,
          isGenerating: false,
          processedAt: new Date().toISOString(),
          cacheInfo: {
            lastUpdate: bookmarksCache.lastUpdate,
            checksum: bookmarksCache.checksum
          }
        }, () => {

          // 通知前端数据已刷新
          chrome.tabs.query({ url: chrome.runtime.getURL('dist/management.html') }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'dataRefreshed', forceRefresh: true });
            }
          });

          sendResponse({ success: true, message: '数据已强制刷新' });
        });
      });

      return true; // 异步响应
  }
});

// --- Command Shortcuts ---
chrome.commands.onCommand.addListener((command) => {

  switch (command) {
    case 'open-management':
      // 快捷键进入默认使用手动整理模式
      openManagementTab('manual');
      break;

    case 'smart-bookmark':
      // 快捷键触发AI整理功能
      openManagementTab('ai');

      // 延迟触发重构，让页面先加载
      setTimeout(() => {
        triggerRestructure();
      }, 1000);
      break;

    case 'search-bookmarks':
      // Open search popup window
      const searchPopupUrl = 'dist/search-popup.html';

      // Get display info for proper centering
      chrome.system.display.getInfo((displays) => {
        const primaryDisplay = displays[0] || { bounds: { width: 1920, height: 1080 } };
        const screenWidth = primaryDisplay.bounds.width;
        const screenHeight = primaryDisplay.bounds.height;

        const windowWidth = 650;
        const windowHeight = 500;

        chrome.windows.create({
          url: chrome.runtime.getURL(searchPopupUrl),
          type: 'popup',
          width: windowWidth,
          height: windowHeight,
          focused: true,
          top: Math.round((screenHeight - windowHeight) / 2),
          left: Math.round((screenWidth - windowWidth) / 2)
        });
      });
      break;

    default:
  }
});
