document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const quickAddSection = document.getElementById('quickAddSection');
  const currentPageTitle = document.getElementById('currentPageTitle');
  const currentPageUrl = document.getElementById('currentPageUrl');
  const quickAddBtn = document.getElementById('quickAddBtn');
  
  const statsTotal = document.getElementById('statsTotal');
  const statsFolders = document.getElementById('statsFolders');
  const lastProcessedInfo = document.getElementById('last-processed-info');
  
  const manageBtn = document.getElementById('manageBtn');
  const refreshProposalBtn = document.getElementById('refreshProposalBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');

  let currentTab = null;

  // --- Initialization ---
  function initialize() {
    // 1. Get current tab info for Quick Add
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
        currentTab = tabs[0];
        currentPageTitle.textContent = currentTab.title;
        currentPageUrl.textContent = currentTab.url;
        quickAddSection.style.display = 'block';
      }
    });

    // 2. Get bookmark stats
    chrome.bookmarks.getTree(function(tree) {
      const stats = countBookmarks(tree);
      statsTotal.textContent = stats.bookmarks;
      statsFolders.textContent = stats.folders;
    });
    
    // 3. Get last processed info
    chrome.storage.local.get('processedAt', function(data) {
        if (data.processedAt) {
            const date = new Date(data.processedAt);
            lastProcessedInfo.textContent = `上次整理于: ${date.toLocaleString()}`;
        } else {
            lastProcessedInfo.textContent = '尚未进行过AI整理';
        }
    });
  }

  // --- Event Listeners ---
  quickAddBtn.addEventListener('click', function() {
    if (!currentTab) return;

    quickAddBtn.classList.add('disabled');
    quickAddBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>添加中...';

    const bookmark = {
      title: currentTab.title,
      url: currentTab.url,
      id: `temp-${Date.now()}` // Temporary ID for new items
    };

    chrome.runtime.sendMessage({ action: 'quickAddBookmark', bookmark }, function(response) {
      if (response && response.success) {
        showToast(response.message, 'success');
        setTimeout(() => window.close(), 1000);
      } else {
        showToast(response ? response.message : '添加失败', 'error');
        quickAddBtn.classList.remove('disabled');
        quickAddBtn.innerHTML = '<i class="material-icons left">add_circle</i>添加到AI建议';
      }
    });
  });

  manageBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'showManagementPage' });
    window.close();
  });

  refreshProposalBtn.addEventListener('click', function() {
    showToast('后台正在重新生成建议...', 'info');
    chrome.runtime.sendMessage({ action: 'startRestructure' });
    window.close();
  });

  clearCacheBtn.addEventListener('click', function() {
    showToast('正在清除缓存并重新生成...', 'warning');
    chrome.runtime.sendMessage({ action: 'clearCacheAndRestructure' });
    window.close();
  });

  // --- Utility Functions ---
  function countBookmarks(nodes) {
    let folders = 0;
    let bookmarks = 0;
    nodes.forEach(node => {
      if (node.url) {
        bookmarks++;
      } else if (node.children) {
        folders++; // Count this folder
        const childStats = countBookmarks(node.children);
        folders += childStats.folders;
        bookmarks += childStats.bookmarks;
      }
    });
    // Subtract the root node which is also a folder
    return { folders: folders > 0 ? folders - 1 : 0, bookmarks };
  }

  function showToast(message, type = 'info') {
    if (typeof M !== 'undefined' && M.toast) {
        const toastClass = type === 'success' ? 'green' : 'red';
        M.toast({ html: message, classes: toastClass });
    } else {
        alert(message);
    }
  }

  initialize();
});
