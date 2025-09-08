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
  let managementUrl = 'management.html';
  if (mode) {
    managementUrl += `?mode=${mode}`;
  }

  const fullUrl = chrome.runtime.getURL(managementUrl);

  chrome.tabs.query({}, (tabs) => {
    const managementTabs = tabs.filter(tab =>
      tab.url && tab.url.includes('management.html')
    );
    if (managementTabs.length > 0) {
      // 检查当前页面的URL是否已经包含正确的参数
      const currentTab = managementTabs[0];
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
      chrome.tabs.create({ url: fullUrl });
    }
  });
}

async function applyChanges(proposal) {
  console.log('🔄 [applyChanges] 开始应用书签结构变更');
  console.log('🔄 [applyChanges] 收到的proposal:', JSON.stringify(proposal, null, 2));
  
  try {
    // 1. Create a backup folder with a timestamp
    console.log('🔄 [applyChanges] 步骤1: 创建备份文件夹');
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const backupFolder = await chrome.bookmarks.create({
      parentId: '2', // 'Other bookmarks'
      title: `AcuityBookmarks Backup [${timestamp}]`,
    });
    console.log('🔄 [applyChanges] 备份文件夹创建成功:', backupFolder);

    // 2. Move existing bookmarks to the backup folder
    console.log('🔄 [applyChanges] 步骤2: 移动现有书签到备份文件夹');
    const bookmarksBar = (await chrome.bookmarks.getChildren('1')) || [];
    const otherBookmarks = (await chrome.bookmarks.getChildren('2')) || [];
    
    console.log('🔄 [applyChanges] 书签栏现有内容:', bookmarksBar);
    console.log('🔄 [applyChanges] 其他书签现有内容:', otherBookmarks);

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
    console.log('🔄 [applyChanges] 步骤3: 创建新的书签结构');
    const proposalRoot = proposal.children || [];
    const proposalBookmarksBar = proposalRoot.find(n => n.title === '书签栏');
    const proposalOtherBookmarks = proposalRoot.find(n => n.title === '其他书签');
    
    console.log('🔄 [applyChanges] 提案中的书签栏:', proposalBookmarksBar);
    console.log('🔄 [applyChanges] 提案中的其他书签:', proposalOtherBookmarks);

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
      console.log('🔄 [applyChanges] 创建书签栏内容...');
      await createNodes(proposalBookmarksBar.children, '1');
    }
    if (proposalOtherBookmarks && proposalOtherBookmarks.children) {
      console.log('🔄 [applyChanges] 创建其他书签内容...');
      await createNodes(proposalOtherBookmarks.children, '2');
    }

    console.log('🔄 [applyChanges] 书签结构创建完成');
    
    // 验证最终结果
    const finalBookmarksBar = await chrome.bookmarks.getChildren('1');
    const finalOtherBookmarks = await chrome.bookmarks.getChildren('2');
    console.log('🔄 [applyChanges] 最终书签栏内容:', finalBookmarksBar);
    console.log('🔄 [applyChanges] 最终其他书签内容:', finalOtherBookmarks);

    // Notify frontend that the apply is complete so it can refresh the left panel
    console.log('🔄 [applyChanges] 发送applyComplete消息到前端');
    chrome.runtime.sendMessage({ action: 'applyComplete' });

  } catch (error) {
    console.error('🔄 [applyChanges] 应用更改失败:', error);
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

// --- 简化的书签变化监听器 ---
function setupBookmarksChangeListeners() {
  // 监听书签创建
  chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
    // 更新缓存时间戳
    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });

  // 监听书签删除
  chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });

  // 监听书签修改
  chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });

  // 监听书签移动
  chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
    bookmarksCache.lastUpdate = Date.now();
    bookmarksCache.checksum = null;
  });
}

// --- 简化的书签数据处理 ---
// 移除复杂的BookmarkCacheManager类，改为简单的函数

// 预处理书签数据并保存到Chrome Storage
async function processAndStoreBookmarks() {
  try {
    // 获取Chrome书签数据
    const bookmarksTree = await chrome.bookmarks.getTree();
    
    if (!bookmarksTree || bookmarksTree.length === 0) {
      return { bookmarkCount: 0, processedAt: Date.now() };
    }

    // 直接保存书签树到Chrome Storage
    const totalCount = countBookmarksInTree(bookmarksTree);
    await chrome.storage.local.set({
      originalTree: bookmarksTree,
      localDataStatus: 'ready',
      lastLocalUpdate: Date.now(),
      localBookmarkCount: totalCount
    });

    return {
      bookmarkCount: totalCount,
      processedAt: Date.now()
    };

  } catch (error) {
    console.error('处理书签数据失败:', error);
    throw error;
  }
}

// 计算书签树中的书签数量
function countBookmarksInTree(tree) {
  let count = 0;
  
  function traverse(node) {
    if (node.url) {
      count++;
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  if (Array.isArray(tree)) {
    tree.forEach(traverse);
  } else {
    traverse(tree);
  }
  
  return count;
}

// 简化的搜索功能
async function searchBookmarks(query, options = {}) {
  const { limit = 20 } = options;
  
  try {
    // 直接从Chrome API搜索
    const results = await new Promise((resolve) => {
      chrome.bookmarks.search(query, resolve);
    });
    
    return {
      success: true,
      results: results.slice(0, limit),
      total: results.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      results: [],
      total: 0
    };
  }
}

// On install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  isServiceWorkerActive = true;

  // Initialize storage with default values
  await chrome.storage.local.set({
    isGenerating: false,
    progressCurrent: 0,
    progressTotal: 0,
    processedAt: null,
    localDataStatus: 'pending'
  });

  // Setup bookmarks change listeners
  setupBookmarksChangeListeners();

  // 预加载书签数据（仅在首次安装时）
  if (details.reason === 'install') {
    try {
      const result = await processAndStoreBookmarks();

      // 显示通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'AcuityBookmarks',
        message: `已成功处理 ${result.bookmarkCount} 个书签数据！`
      });

    } catch (error) {
      console.error('书签数据预加载失败:', error);

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
  console.log('🎯 [后台脚本] 收到消息:', request.action, request);
  // Using a switch statement for better organization
  switch (request.action) {
    case 'prepareManagementData':
      console.log('📊 [数据准备] 开始处理prepareManagementData请求');
      // 简化数据准备逻辑
      (async () => {
        try {
          // 检查chrome.storage状态
          console.log('📊 [存储检查] 检查本地存储状态');
          const data = await new Promise(resolve => {
            chrome.storage.local.get(['localDataStatus', 'lastLocalUpdate', 'localBookmarkCount'], resolve);
          });
          console.log('📊 [存储状态] 当前存储数据:', data);

          if (data.localDataStatus === 'ready') {
            console.log('✅ [缓存数据] 数据已准备好，发送dataReady消息');
            // 数据已准备好，直接通知前端
            chrome.tabs.query({}, (tabs) => {
              const managementTabs = tabs.filter(tab =>
                tab.url && tab.url.includes('management.html')
              );
              console.log('📋 [标签查询] 找到management标签页:', managementTabs.length);
              if (managementTabs.length > 0) {
                const message = {
                  action: 'dataReady',
                  fromCache: true,
                  localData: {
                    status: 'ready',
                    bookmarkCount: data.localBookmarkCount || 0,
                    lastUpdate: data.lastLocalUpdate || Date.now()
                  }
                };
                console.log('📤 [发送消息] 向前端发送dataReady:', message);
                chrome.tabs.sendMessage(managementTabs[0].id, message);
              }
            });
          } else {
            console.log('⚙️ [数据处理] 数据未准备好，开始处理书签数据');
            // 需要处理数据
            const result = await processAndStoreBookmarks();
            console.log('✅ [处理完成] 书签数据处理结果:', result);
            
            // 通知前端数据已更新
            chrome.tabs.query({}, (tabs) => {
              const managementTabs = tabs.filter(tab =>
                tab.url && tab.url.includes('management.html')
              );
              if (managementTabs.length > 0) {
                chrome.tabs.sendMessage(managementTabs[0].id, {
                  action: 'dataReady',
                  fromCache: false,
                  localData: {
                    status: 'ready',
                    bookmarkCount: result.bookmarkCount,
                    lastUpdate: result.processedAt
                  }
                });
              }
            });
          }

        } catch (error) {
          console.error('数据准备失败:', error);
          // 通知前端数据准备失败
          chrome.tabs.query({}, (tabs) => {
            const managementTabs = tabs.filter(tab =>
              tab.url && tab.url.includes('management.html')
            );
            if (managementTabs.length > 0) {
              chrome.tabs.sendMessage(managementTabs[0].id, {
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
      const mode = request.mode || 'manual';
      openManagementTab(mode);
      sendResponse({ success: true, status: 'page_opened' });
      return true;

    case 'searchBookmarks':
      (async () => {
        try {
          const result = await searchBookmarks(request.query, { limit: request.limit || 20 });
          sendResponse(result);
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message,
            results: [],
            total: 0
          });
        }
      })();
      return true;

    case 'showManagementPageAndOrganize':
      openManagementTab('ai');
      sendResponse({ success: true, status: 'ai_organize_started' });
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
          await chrome.storage.local.remove('newProposal');
          sendResponse({ status: 'success', message: data.message });
        } catch (error) {
          sendResponse({ status: 'error', message: error.message });
        }
      })();
      return true;

    case 'applyChanges':
      (async () => {
        try {
          await applyChanges(request.proposal);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message || 'Unknown error' });
        }
      })();
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
            // Bookmark already exists
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
      return true;

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
      chrome.bookmarks.getTree(async (tree) => {
        const startTime = performance.now();

        // 更新缓存信息
        bookmarksCache.data = tree;
        bookmarksCache.lastUpdate = Date.now();
        bookmarksCache.checksum = calculateBookmarksChecksum(tree);

        // 处理数据
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
          chrome.tabs.query({ url: chrome.runtime.getURL('management.html') }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'dataRefreshed', forceRefresh: true });
            }
          });

          sendResponse({ success: true, message: '数据已强制刷新' });
        });
      });

      return true;
  }
});

// --- Command Shortcuts ---
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'open-management':
      openManagementTab('manual');
      break;

    case 'smart-bookmark':
      openManagementTab('ai');
      setTimeout(() => {
        triggerRestructure();
      }, 1000);
      break;

    case 'search-bookmarks':
      const searchPopupUrl = 'search-popup.html';

      // 简化窗口创建，让Chrome自动决定位置
      chrome.windows.create({
        url: chrome.runtime.getURL(searchPopupUrl),
        type: 'popup',
        width: 650,
        height: 500,
        focused: true
      });
      break;

    default:
  }
});