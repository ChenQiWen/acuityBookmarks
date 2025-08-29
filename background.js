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
  if (request.action === 'startRestructure') {
    console.log('Starting bookmark restructure process...');
    chrome.storage.local.get('lockedFolderIds', (data) => {
      const lockedFolderIds = data.lockedFolderIds || [];
      getAllBookmarks(lockedFolderIds, (bookmarks) => {
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
              newProposal: newProposal 
            }, () => {
              chrome.tabs.create({ url: 'management.html' });
            });
          });
        })
        .catch(error => {
          console.error('Error contacting backend:', error);
        });
    });
    });
  }
});
