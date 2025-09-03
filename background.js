console.log("--- AcuityBookmarks Service Worker starting up ---");

// --- State ---
let pollingInterval = null;
let currentJobId = null;
let isServiceWorkerActive = false;

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
      console.log('✅ Job complete, saving final result.');
      const originalTree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
      await chrome.storage.local.set({
        originalTree,
        newProposal: job.result,
        processedAt: new Date().toISOString(),
      });
      stopPolling();
    } else if (job.status === 'failed') {
      console.error('❌ Job failed:', job.error);
      stopPolling();
    }
  } catch (error) {
    console.error('Error polling job status:', error);
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
    console.log('🔄 Analysis is already in progress.');
    return;
  }
  console.log('🚀 Starting new bookmark processing job...');
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
    console.error('❌ Failed to trigger restructure:', error);
    await chrome.storage.local.set({ isGenerating: false });
  }
}

function openManagementTab() {
  const managementUrl = 'dist/management.html';
  chrome.tabs.query({ url: chrome.runtime.getURL(managementUrl) }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: managementUrl });
    }
  });
}

async function applyChanges(proposal) {
  console.log('🚀 Starting to apply new bookmark structure...');
  try {
    // 1. Create a backup folder with a timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const backupFolder = await chrome.bookmarks.create({
      parentId: '2', // 'Other bookmarks'
      title: `AcuityBookmarks Backup [${timestamp}]`,
    });
    console.log(`📦 Created backup folder: ${backupFolder.title}`);

    // 2. Move existing bookmarks to the backup folder
    const bookmarksBar = (await chrome.bookmarks.getChildren('1')) || [];
    const otherBookmarks = (await chrome.bookmarks.getChildren('2')) || [];

    console.log('🛡️ Moving existing bookmarks to backup...');
    for (const node of bookmarksBar) {
      await chrome.bookmarks.move(node.id, { parentId: backupFolder.id });
    }
    // Move all children of "Other Bookmarks" except the newly created backup folder
    for (const node of otherBookmarks) {
      if (node.id !== backupFolder.id) {
        await chrome.bookmarks.move(node.id, { parentId: backupFolder.id });
      }
    }
    console.log('✅ Existing bookmarks safely backed up.');

    // 3. Create the new structure
    console.log('✨ Creating new structure...');
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

    console.log('🎉 Successfully applied new structure!');
    // Notify frontend that the apply is complete so it can refresh the left panel
    chrome.runtime.sendMessage({ action: 'applyComplete' });

  } catch (error) {
    console.error('❌ Error applying changes:', error);
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
  console.log('[AcuityBookmarks] Service Worker started up');
  isServiceWorkerActive = true;
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('[AcuityBookmarks] Service Worker suspending');
  isServiceWorkerActive = false;
  // Clean up any ongoing operations
  stopPolling();
});

// On install or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[AcuityBookmarks] Extension ${details.reason} - ${chrome.runtime.getManifest().version}`);
  isServiceWorkerActive = true;

  // Initialize storage with default values
  chrome.storage.local.set({
    isGenerating: false,
    progressCurrent: 0,
    progressTotal: 0,
    processedAt: null
  });
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(`[AcuityBookmarks] Received action: "${request.action}"`, request);

  // Using a switch statement for better organization
  switch (request.action) {
    case 'showManagementPage':
      console.log('[AcuityBookmarks] Executing: showManagementPage');
      chrome.bookmarks.getTree(tree => {
        const proposal = { '书签栏': {}, '其他书签': [] };
        const bookmarksBar = tree[0]?.children?.find(c => c.id === '1');
        const otherBookmarks = tree[0]?.children?.find(c => c.id === '2');
        
        if (bookmarksBar) {
          const rootBookmarks = [];
          bookmarksBar.children?.forEach(node => {
            if (node.children) {
              proposal['书签栏'][node.title] = node.children;
            } else {
              rootBookmarks.push(node);
            }
          });
          if (rootBookmarks.length > 0) {
            proposal['书签栏']['书签栏根目录'] = rootBookmarks;
          }
        }
        if (otherBookmarks) {
          proposal['其他书签'] = otherBookmarks.children || [];
        }

        chrome.storage.local.set({ 
          originalTree: tree,
          newProposal: proposal,
          isGenerating: false,
          processedAt: new Date().toISOString()
        }, () => {
          openManagementTab();
        });
      });
      return true;

    case 'showManagementPageAndOrganize':
      console.log('[AcuityBookmarks] Executing: showManagementPageAndOrganize');
      openManagementTab();
      triggerRestructure();
      return true;

    case 'clearCacheAndRestructure':
      console.log('[AcuityBookmarks] Executing: clearCacheAndRestructure');
      stopPolling();
      (async () => {
        try {
          const response = await fetch('http://localhost:3000/api/clear-cache', { method: 'POST' });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Failed to clear cache');
          }
          console.log('🧹 Cache cleared:', data.message);
          // Do not trigger restructure automatically, let the user decide.
          await chrome.storage.local.remove('newProposal');
          sendResponse({ status: 'success', message: data.message });
        } catch (error) {
          console.error('❌ Error clearing cache:', error);
          sendResponse({ status: 'error', message: error.message });
        }
      })();
      return true; // Indicates asynchronous response

    case 'applyChanges':
      console.log('[AcuityBookmarks] Executing: applyChanges');
      (async () => {
        try {
          await applyChanges(request.proposal);
          // Send success response to frontend
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to apply changes:', error);
          // Send error response to frontend
          sendResponse({ success: false, error: error.message || 'Unknown error' });
        }
      })();
      return true; // Indicates asynchronous response

    case 'searchBookmarks':
      console.log('[AcuityBookmarks] Executing: searchBookmarks with mode:', request.mode);
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
          console.error('Error searching bookmarks:', error);
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
      console.log('[AcuityBookmarks] Executing: smartBookmark');
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
            console.log(`Bookmark for ${bookmark.url} already exists. Proceeding with classification.`);
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
          console.error('❌ Smart Bookmark failed:', error.message, error.stack);
          sendResponse({ status: 'error', error: error.message });
        }
      })();
      return true; // Indicates asynchronous response

    case 'healthCheck':
      console.log('[AcuityBookmarks] Executing: healthCheck');
      sendResponse({
        status: 'healthy',
        version: chrome.runtime.getManifest().version,
        serviceWorkerActive: isServiceWorkerActive,
        timestamp: new Date().toISOString(),
        pollingActive: pollingInterval !== null,
        currentJobId: currentJobId
      });
      return false;
  }
});

// --- Command Shortcuts ---
chrome.commands.onCommand.addListener((command) => {
  console.log(`[AcuityBookmarks] Command received: ${command}`);

  switch (command) {
    case 'open-management':
      console.log('[AcuityBookmarks] Opening management page via shortcut');
      // Prepare bookmark data and open management tab
      chrome.bookmarks.getTree(tree => {
        const proposal = { '书签栏': {}, '其他书签': [] };
        const bookmarksBar = tree[0]?.children?.find(c => c.id === '1');
        const otherBookmarks = tree[0]?.children?.find(c => c.id === '2');

        if (bookmarksBar) {
          const rootBookmarks = [];
          bookmarksBar.children?.forEach(node => {
            if (node.children) {
              proposal['书签栏'][node.title] = node.children;
            } else {
              rootBookmarks.push(node);
            }
          });
          if (rootBookmarks.length > 0) {
            proposal['书签栏']['书签栏根目录'] = rootBookmarks;
          }
        }
        if (otherBookmarks) {
          proposal['其他书签'] = otherBookmarks.children || [];
        }

        chrome.storage.local.set({
          originalTree: tree,
          // 通过快捷键进入时不设置newProposal，让前端复制原始数据
          newProposal: null,
          isGenerating: false,
          processedAt: new Date().toISOString()
        }, () => {
          openManagementTab();
        });
      });
      break;

    case 'smart-bookmark':
      console.log('[AcuityBookmarks] Triggering smart bookmark via shortcut');
      // Get current active tab and create bookmark from it
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          const currentTab = tabs[0];
          const bookmark = {
            title: currentTab.title,
            url: currentTab.url
          };

          try {
            const response = await fetch('http://localhost:3000/api/classify-single', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: bookmark.title,
                url: bookmark.url,
                categories: [], // Will be populated by the background script
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

            // Show notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'images/icon128.png',
              title: '智能书签已保存',
              message: `已保存到 "${category}" 文件夹`
            });

          } catch (error) {
            console.error('❌ Smart bookmark via shortcut failed:', error);
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'images/icon128.png',
              title: '保存失败',
              message: '智能书签保存失败，请重试'
            });
          }
        }
      });
      break;

    case 'search-bookmarks':
      console.log('[AcuityBookmarks] Opening search popup via shortcut');
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
      console.log(`[AcuityBookmarks] Unknown command: ${command}`);
  }
});
