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
          // 在这里，我们将使用后端返回的真实提案
          // 目前，我们仍然使用模拟数据
          const mockProposal = [
            {
              id: '1',
              title: '书签栏',
              children: bookmarks.filter(b => b.parentId === '1' || b.url.includes('github')),
              parentId: '0'
            },
            {
              id: '2',
              title: '其他书签',
              children: bookmarks.filter(b => b.parentId !== '1' && !b.url.includes('github')),
              parentId: '0'
            }
          ];

          chrome.bookmarks.getTree(originalTree => {
            chrome.storage.local.set({ 
              originalTree: originalTree, 
              newProposal: mockProposal 
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
