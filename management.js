document.addEventListener('DOMContentLoaded', function() {
  const originalPanel = document.getElementById('originalStructure');
  const newPanel = document.getElementById('newStructure');

  function renderTree(nodes, container) {
    const ul = document.createElement('ul');
    for (const node of nodes) {
      const li = document.createElement('li');
      if (node.url) {
        li.textContent = `[链接] ${node.title}`;
      } else {
        li.textContent = `[文件夹] ${node.title || '未命名'}`;
        if (node.children) {
          li.appendChild(renderTree(node.children, container));
        }
      }
      ul.appendChild(li);
    }
    return ul;
  }

  function renderProposal(proposal, container) {
    const ul = document.createElement('ul');
    for (const category in proposal) {
      const li = document.createElement('li');
      li.textContent = `[文件夹] ${category}`;
      const categoryUl = document.createElement('ul');
      for (const bookmark of proposal[category]) {
        const bookmarkLi = document.createElement('li');
        bookmarkLi.textContent = `[链接] ${bookmark.title}`;
        categoryUl.appendChild(bookmarkLi);
      }
      li.appendChild(categoryUl);
      ul.appendChild(li);
    }
    return ul;
  }

  chrome.storage.local.get(['originalTree', 'newProposal'], (data) => {
    if (data.originalTree) {
      originalPanel.appendChild(renderTree(data.originalTree, originalPanel));
    }
    if (data.newProposal) {
      newPanel.appendChild(renderProposal(data.newProposal, newPanel));
    }
  });
});
