// --- State ---
let pollingInterval = null;
let currentJobId = null;

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
    const bookmarksBar = (await chrome.bookmarks.getChildren('1')) || [];
    const otherBookmarks = (await chrome.bookmarks.getChildren('2')) || [];

    console.log('🗑️ Clearing existing bookmarks...');
    for (const node of [...bookmarksBar, ...otherBookmarks]) {
      if (node.url) {
        await chrome.bookmarks.remove(node.id);
      } else {
        await chrome.bookmarks.removeTree(node.id);
      }
    }
    console.log('✅ Existing bookmarks cleared.');

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
  }
}


// --- Event Listeners ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showManagementPage') {
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
          // Correctly handle bookmarks at the root of the bookmarks bar
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
  }
  
  if (request.action === 'showManagementPageAndOrganize') {
    openManagementTab();
    triggerRestructure();
    return true;
  }
  
  if (request.action === 'clearCacheAndRestructure') {
    stopPolling();
    fetch('http://localhost:3000/api/clear-cache', { method: 'POST' }).then(() => {
      console.log('🧹 Cache cleared.');
      chrome.storage.local.remove('newProposal', triggerRestructure);
    });
  }

  if (request.action === 'applyChanges') {
    applyChanges(request.proposal);
  }

  if (request.action === 'searchBookmarks') {
    getAllBookmarks(async (bookmarks) => {
      try {
        const response = await fetch('http://localhost:3000/api/search-bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: request.query, bookmarks }),
        });
        if (!response.ok) throw new Error('Failed to search bookmarks');
        const matchedBookmarks = await response.json();
        sendResponse(matchedBookmarks);
      } catch (error) {
        console.error('Error searching bookmarks:', error);
        sendResponse([]);
      }
    });
    return true; // Indicates that the response is sent asynchronously
  }
});
