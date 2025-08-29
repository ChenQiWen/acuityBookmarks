function getAllBookmarks(callback) {
  chrome.bookmarks.getTree((bookmarkTree) => {
    const bookmarks = [];
    function traverse(nodes) {
      for (const node of nodes) {
        if (node.url) {
          bookmarks.push({ title: node.title, url: node.url });
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
    getAllBookmarks((bookmarks) => {
      console.log(`Collected ${bookmarks.length} bookmarks.`);
      
      // 模拟AI处理和生成提案
      const mockProposal = {
        '技术文档': bookmarks.filter(b => b.url.includes('github') || b.url.includes('stackoverflow')),
        '新闻文章': bookmarks.filter(b => b.url.includes('news') || b.url.includes('medium')),
        '其他': bookmarks.filter(b => !b.url.includes('github') && !b.url.includes('stackoverflow') && !b.url.includes('news') && !b.url.includes('medium')),
      };

      // 将原始书签树和模拟提案存入本地存储
      chrome.bookmarks.getTree(originalTree => {
        chrome.storage.local.set({ 
          originalTree: originalTree, 
          newProposal: mockProposal 
        }, () => {
          // 打开管理页面
          chrome.tabs.create({ url: 'management.html' });
        });
      });
    });
  }
});
