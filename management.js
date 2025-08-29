document.addEventListener('DOMContentLoaded', function() {
  const originalPanel = document.getElementById('originalStructure');
  const newPanel = document.getElementById('newStructure');
  const searchInput = document.getElementById('search');
  const editModal = document.getElementById('editModal');
  const bookmarkTitleInput = document.getElementById('bookmarkTitleInput');
  const saveBookmarkBtn = document.getElementById('saveBookmarkBtn');
  
  M.Modal.init(editModal, { dismissible: false });
  const modalInstance = M.Modal.getInstance(editModal);

  let originalBookmarkTree = [];
  let newProposalData = {};
  let lockedFolderIds = [];

  chrome.storage.local.get('lockedFolderIds', (data) => {
    if (data.lockedFolderIds) {
      lockedFolderIds = data.lockedFolderIds;
    }
  });

  function filterTree(nodes, query) {
    const queryLower = query.toLowerCase();
    return nodes.reduce((acc, node) => {
      if (node.url) {
        if (node.title.toLowerCase().includes(queryLower)) {
          acc.push(node);
        }
      } else {
        const filteredChildren = filterTree(node.children || [], query);
        if (filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
      }
      return acc;
    }, []);
  }

  function filterProposal(proposal, query) {
    const queryLower = query.toLowerCase();
    const filteredProposal = {};
    for (const category in proposal) {
      const filteredBookmarks = proposal[category].filter(b => b.title.toLowerCase().includes(queryLower));
      if (filteredBookmarks.length > 0) {
        filteredProposal[category] = filteredBookmarks;
      }
    }
    return filteredProposal;
  }

  function renderTree(nodes, container, isSearch) {
    const ul = document.createElement('ul');
    ul.className = 'bookmark-tree';

    for (const node of nodes) {
      const li = document.createElement('li');
      if (node.url) {
        const a = document.createElement('a');
        a.href = node.url;
        a.target = '_blank';
        a.dataset.id = node.id;
        a.innerHTML = `<img src="${node.faviconUrl || 'images/icon16.png'}" class="favicon" />${node.title}`;
        li.appendChild(a);
      } else {
        const folderContainer = document.createElement('div');
        folderContainer.className = 'folder-container';

        const folderSpan = document.createElement('span');
        folderSpan.innerHTML = `<i class="material-icons">folder</i>${node.title || '未命名'}`;
        folderSpan.classList.add('folder');
        
        folderContainer.appendChild(folderSpan);

        // Only show lock icon for non-root folders
        if (node.parentId !== '0') {
          const lockIcon = document.createElement('i');
          lockIcon.className = 'material-icons lock-icon';
          lockIcon.textContent = lockedFolderIds.includes(node.id) ? 'lock' : 'lock_open';
          folderContainer.appendChild(lockIcon);

          lockIcon.addEventListener('click', () => {
            if (lockedFolderIds.includes(node.id)) {
              lockedFolderIds = lockedFolderIds.filter(id => id !== node.id);
              lockIcon.textContent = 'lock_open';
            } else {
              lockedFolderIds.push(node.id);
              lockIcon.textContent = 'lock';
            }
            chrome.storage.local.set({ lockedFolderIds: lockedFolderIds });
          });
        }
        
        li.appendChild(folderContainer);

        if (node.children && node.children.length > 0) {
          const subTree = renderTree(node.children, container, isSearch);
          if (!isSearch) {
            subTree.style.display = 'none'; // Default to collapsed
          }
          li.appendChild(subTree);

          folderSpan.addEventListener('click', () => {
            const isCollapsed = subTree.style.display === 'none';
            subTree.style.display = isCollapsed ? 'block' : 'none';
            folderSpan.querySelector('.material-icons').textContent = isCollapsed ? 'folder_open' : 'folder';
          });
        }
      }
      ul.appendChild(li);
    }
    return ul;
  }

  function renderProposal(nodes, container, isSearch) {
    const ul = document.createElement('ul');
    ul.className = 'bookmark-tree';

    for (const node of nodes) {
      const li = document.createElement('li');
      if (node.url) {
        const a = document.createElement('a');
        a.href = node.url;
        a.className = 'collection-item';
        a.target = '_blank';
        a.dataset.id = node.id;
        
        const titleSpan = document.createElement('span');
        titleSpan.innerHTML = `<img src="${node.faviconUrl || 'images/icon16.png'}" class="favicon" />${node.title}`;
        
        const actions = document.createElement('div');
        actions.className = 'bookmark-actions';
        actions.innerHTML = `
          <i class="material-icons" title="编辑书签名">edit</i>
          <i class="material-icons" title="删除书签">delete</i>
          <i class="material-icons" title="复制书签链接">link</i>
        `;
        
        a.appendChild(titleSpan);
        a.appendChild(actions);

        actions.querySelector('.material-icons[title="编辑书签名"]').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          bookmarkTitleInput.value = node.title;
          M.updateTextFields();
          modalInstance.open();
          saveBookmarkBtn.onclick = () => {
            chrome.bookmarks.update(node.id, { title: bookmarkTitleInput.value }, () => {
              modalInstance.close();
              titleSpan.innerHTML = `<img src="${node.faviconUrl || 'images/icon16.png'}" class="favicon" />${bookmarkTitleInput.value}`;
            });
          };
        });

        actions.querySelector('.material-icons[title="复制书签链接"]').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(node.url);
        });

        a.addEventListener('mouseenter', () => {
          actions.style.display = 'flex';
          highlightOriginal(node.id);
        });
        a.addEventListener('mouseleave', () => {
          actions.style.display = 'none';
          removeHighlight();
        });
        
        li.appendChild(a);
      } else {
        const folderContainer = document.createElement('div');
        folderContainer.className = 'folder-container';

        const folderSpan = document.createElement('span');
        folderSpan.innerHTML = `<i class="material-icons">folder</i>${node.title || '未命名'}`;
        folderSpan.classList.add('folder');
        
        folderContainer.appendChild(folderSpan);
        
        li.appendChild(folderContainer);

        if (node.children && node.children.length > 0) {
          const subTree = renderProposal(node.children, container, isSearch);
          if (!isSearch) {
            subTree.style.display = 'none';
          }
          li.appendChild(subTree);

          folderSpan.addEventListener('click', () => {
            const isCollapsed = subTree.style.display === 'none';
            subTree.style.display = isCollapsed ? 'block' : 'none';
            folderSpan.querySelector('.material-icons').textContent = isCollapsed ? 'folder_open' : 'folder';
          });
        }
      }
      ul.appendChild(li);
    }
    return ul;
  }

  function highlightOriginal(bookmarkId) {
    removeHighlight();
    const originalBookmark = originalPanel.querySelector(`[data-id='${bookmarkId}']`);
    if (originalBookmark) {
      originalBookmark.classList.add('highlight');
      
      const rect = originalBookmark.getBoundingClientRect();
      const containerRect = originalPanel.closest('.card').getBoundingClientRect();
      if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
        originalBookmark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      let parent = originalBookmark.parentElement;
      while (parent && parent !== originalPanel) {
        if (parent.tagName === 'UL' && parent.style.display === 'none') {
          parent.style.display = 'block';
          const folderSpan = parent.previousElementSibling;
          if (folderSpan && folderSpan.classList.contains('folder')) {
            folderSpan.querySelector('.material-icons').textContent = 'folder_open';
          }
        }
        parent = parent.parentElement;
      }
    }
  }

  function removeHighlight() {
    const highlighted = originalPanel.querySelector('.highlight');
    if (highlighted) {
      highlighted.classList.remove('highlight');
    }
  }

  chrome.bookmarks.getTree((bookmarkTree) => {
    originalBookmarkTree = bookmarkTree[0].children; // Start from the children of the root
    originalPanel.innerHTML = '';
    originalPanel.appendChild(renderTree(originalBookmarkTree, originalPanel));

    const originalCard = originalPanel.closest('.card');
    originalCard.addEventListener('wheel', (e) => {
      if ((e.deltaY < 0 && originalCard.scrollTop === 0) || (e.deltaY > 0 && originalCard.scrollHeight - originalCard.clientHeight - originalCard.scrollTop < 1)) {
        e.preventDefault();
      }
    });

    chrome.storage.local.get(['newProposal'], (data) => {
      if (data.newProposal) {
        chrome.bookmarks.getRecent(10000, (bookmarks) => {
            const proposalWithFavicons = {};
            for(const category in data.newProposal) {
                proposalWithFavicons[category] = data.newProposal[category].map(p => bookmarks.find(b => b.url === p.url) || p);
            }
            newProposalData = proposalWithFavicons;
            newPanel.innerHTML = '';
            newPanel.appendChild(renderProposal(newProposalData, newPanel));

            const newCard = newPanel.closest('.card');
            newCard.addEventListener('wheel', (e) => {
              if ((e.deltaY < 0 && newCard.scrollTop === 0) || (e.deltaY > 0 && newCard.scrollHeight - newCard.clientHeight - newCard.scrollTop < 1)) {
                e.preventDefault();
              }
            });
        });
      }
    });
  });

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    const isSearch = query.length > 0;

    const filteredOriginalTree = filterTree(originalBookmarkTree, query);
    originalPanel.innerHTML = '';
    originalPanel.appendChild(renderTree(filteredOriginalTree, originalPanel, isSearch));

    const filteredProposal = filterProposal(newProposalData, query);
    newPanel.innerHTML = '';
    newPanel.appendChild(renderProposal(filteredProposal, newPanel, isSearch));
  });
});
