function getAllBookmarks(lockedFolderIds, callback) {
  chrome.bookmarks.getTree((bookmarkTree) => {
    const bookmarks = [];
    function traverse(nodes) {
      for (const node of nodes) {
        if (lockedFolderIds.includes(node.id)) {
          continue; // Skip locked folders
        }
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showManagementPage') {
    // First, check if a management page is already open.
    chrome.tabs.query({ url: chrome.runtime.getURL('management.html') }, (tabs) => {
      if (tabs.length > 0) {
        // If it exists, just focus it.
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        // If not, open a new one.
        chrome.tabs.create({ url: 'management.html' });
      }
    });

    // Then, check if data needs to be generated.
    chrome.storage.local.get('newProposal', (data) => {
      // A more robust check for empty or invalid proposal data
      const proposalExists = data.newProposal && 
                             (Object.keys(data.newProposal['书签栏']).length > 0 || data.newProposal['其他书签'].length > 0);
      if (!proposalExists) {
        // Trigger the restructure process, no need to wait for it.
        // The management page will be notified upon completion.
        triggerRestructure();
      }
    });
    return true;
  }

  if (request.action === 'quickAddBookmark') {
    const { bookmark } = request;
    console.log('🚀 Quick adding bookmark:', bookmark.title);
    
    fetch('http://localhost:3000/api/classify-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmark }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      console.log('✅ Classified single bookmark:', data.bookmark.title, '->', data.category);
      
      // Add the new bookmark to the proposal in storage
      chrome.storage.local.get('newProposal', (storageData) => {
        let proposal = storageData.newProposal || { '书签栏': {}, '其他书签': [] };
        
        // Ensure the category exists
        if (!proposal['书签栏'][data.category]) {
          proposal['书签栏'][data.category] = [];
        }
        
        // Add the new bookmark
        proposal['书签栏'][data.category].push(data.bookmark);
        
        chrome.storage.local.set({ newProposal: proposal }, () => {
          console.log('💾 Quick add bookmark saved to storage.');
          sendResponse({ success: true, message: '书签已成功添加!' });
          // Notify management page if it's open
          chrome.runtime.sendMessage({ action: 'restructureComplete' });
        });
      });
    })
    .catch(error => {
      console.error('Error in quick add:', error);
      sendResponse({ success: false, message: error.message });
    });
    
    return true; // Indicates async response
  }

  if (request.action === 'startRestructure') {
    triggerRestructure();
  }

  if (request.action === 'clearCacheAndRestructure') {
    clearCache().then(() => {
      // Also clear the proposal from storage to ensure a fresh start
      chrome.storage.local.remove('newProposal', () => {
        console.log('🧹 Cache and stored proposal cleared.');
        triggerRestructure();
      });
    });
  }
});

async function clearCache() {
  try {
    const response = await fetch('http://localhost:3000/api/clear-cache', {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('Cache clearing result:', result.message);
  } catch (error) {
    console.error('Error calling clear-cache API:', error);
  }
}

function triggerRestructure() {
  console.log('Starting bookmark restructure process...');
  getAllBookmarks([], (bookmarks) => {
    console.log(`Collected ${bookmarks.length} bookmarks.`);
    
    fetch('http://localhost:3000/api/process-bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookmarks }),
      })
      .then(response => response.json())
      .then(data => {
        console.log('Response from backend:', data);
        console.log('Backend method:', data.method);
        console.log('Processed bookmarks count:', data.processedBookmarks?.length);
        console.log('First few results:', data.processedBookmarks?.slice(0, 5));
        
        // Create a lookup map for processed bookmarks
        const processedMap = new Map();
        if (data.processedBookmarks && Array.isArray(data.processedBookmarks)) {
          data.processedBookmarks.forEach(processed => {
            processedMap.set(processed.url, processed.category);
          });
        }
        
        const classifiedBookmarks = bookmarks.map(b => {
          // Check if this bookmark was processed by AI
          if (processedMap.has(b.url)) {
            return { ...b, category: processedMap.get(b.url) };
          }
          
          // Fallback rules for unprocessed bookmarks
          if (b.url.includes('github') || b.url.includes('stackoverflow')) return { ...b, category: '技术文档' };
          if (b.url.includes('news') || b.url.includes('medium')) return { ...b, category: '新闻文章' };
          if (b.url.includes('figma')) return { ...b, category: '设计工具' };
          if (b.url.includes('chrome') && b.url.includes('dev')) return { ...b, category: '开发工具' };
          return { ...b, category: '其他' };
        });
        
        console.log('Classified bookmarks:', classifiedBookmarks.slice(0, 10)); // Log first 10 for debugging

        const newProposal = {
          '书签栏': {},
          '其他书签': []
        };

        classifiedBookmarks.forEach(b => {
          if (b.category === '其他') {
            newProposal['其他书签'].push(b);
          } else {
            if (!newProposal['书签栏'][b.category]) {
              newProposal['书签栏'][b.category] = [];
            }
            newProposal['书签栏'][b.category].push(b);
          }
        });

        chrome.bookmarks.getTree(originalTree => {
          chrome.storage.local.set({ 
            originalTree: originalTree, 
            newProposal: newProposal,
            processingMode: 'ai_classification',
            fallbackMode: false,
            processedAt: new Date().toISOString()
          }, () => {
            console.log('🤖 AI智能分类完成，打开管理页面...');
            // 发送完成消息给popup
            chrome.runtime.sendMessage({ action: 'restructureComplete' });
          });
        });
      })
      .catch(error => {
        console.error('Error contacting backend:', error);
        
        // 发送AI服务不可用的通知给popup
        chrome.runtime.sendMessage({ 
          action: 'aiServiceUnavailable',
          error: error.message 
        });
        
        // 使用增强的本地规则分类作为fallback
        console.log('🔄 AI服务不可用，启用本地智能分类模式...');
        const basicClassifiedBookmarks = bookmarks.map(b => {
          let category = '其他';
          
          // 技术开发类
          if (b.url.includes('github') || b.url.includes('stackoverflow') || 
              b.url.includes('developer.mozilla') || b.url.includes('w3schools') ||
              b.title.toLowerCase().includes('api') || b.title.toLowerCase().includes('文档')) {
            category = '技术文档';
          }
          // 设计工具类
          else if (b.url.includes('figma') || b.url.includes('dribbble') || 
                   b.url.includes('behance') || b.url.includes('canva')) {
            category = '设计工具';
          }
          // 开发工具类
          else if (b.url.includes('chrome') && b.url.includes('dev') ||
                   b.url.includes('vscode') || b.url.includes('devtools')) {
            category = '开发工具';
          }
          // 新闻资讯类
          else if (b.url.includes('news') || b.url.includes('medium') ||
                   b.url.includes('zhihu') || b.url.includes('juejin')) {
            category = '新闻资讯';
          }
          // 视频平台类
          else if (b.url.includes('youtube') || b.url.includes('bilibili') ||
                   b.url.includes('video')) {
            category = '视频平台';
          }
          // 社交平台类
          else if (b.url.includes('twitter') || b.url.includes('weibo') ||
                   b.url.includes('linkedin')) {
            category = '社交媒体';
          }
          
          return { ...b, category };
        });

        const basicProposal = {
          '书签栏': {},
          '其他书签': []
        };

        basicClassifiedBookmarks.forEach(b => {
          if (b.category === '其他') {
            basicProposal['其他书签'].push(b);
          } else {
            if (!basicProposal['书签栏'][b.category]) {
              basicProposal['书签栏'][b.category] = [];
            }
            basicProposal['书签栏'][b.category].push(b);
          }
        });

        chrome.bookmarks.getTree(originalTree => {
          chrome.storage.local.set({ 
            originalTree: originalTree, 
            newProposal: basicProposal,
            fallbackMode: true,
            aiServiceError: error.message,
            processingMode: 'local_rules',
            processedAt: new Date().toISOString()
          }, () => {
            console.log('📂 使用本地规则分类完成，打开管理页面...');
            // 发送完成消息给popup
            chrome.runtime.sendMessage({ action: 'restructureComplete' });
          });
        });
      });
  });
}
