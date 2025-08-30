document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    // #region DOM Element & State Initialization
    const originalPanel = document.getElementById('originalStructure');
    const newPanel = document.getElementById('newStructure');
    const searchInput = document.getElementById('search');
    const editModalEl = document.getElementById('editModal');
    const addModalEl = document.getElementById('addModal');
    const bookmarkTitleInput = document.getElementById('bookmarkTitleInput');
    const bookmarkUrlInput = document.getElementById('bookmarkUrlInput');
    const saveBookmarkBtn = document.getElementById('saveBookmarkBtn');
    const totalFoldersEl = document.getElementById('totalFolders');
    const totalBookmarksEl = document.getElementById('totalBookmarks');
    const aiProcessedEl = document.getElementById('aiProcessed');
    const applyChangesBtn = document.getElementById('applyChanges');
    const previewChangesBtn = document.getElementById('previewChanges');
    const exportStructureBtn = document.getElementById('exportStructure');
    const refreshBtn = document.getElementById('refreshBtn');

    let editModalInstance, addModalInstance, addModalTabsInstance;
    if (typeof M !== 'undefined') {
      if (editModalEl) editModalInstance = M.Modal.init(editModalEl, { dismissible: false });
      if (addModalEl) {
        addModalInstance = M.Modal.init(addModalEl);
        const addModalTabs = addModalEl.querySelector('.tabs');
        if (addModalTabs) addModalTabsInstance = M.Tabs.init(addModalTabs);
      }
      const tooltipElements = document.querySelectorAll('[title]');
      if (tooltipElements.length > 0) M.Tooltip.init(tooltipElements);
    }

    let originalBookmarkTree = [];
    let newProposalTree = {};
    let selectedBookmarkIds = new Set();
    let dropTargetTimer = null;
    let currentDropTarget = null;
    // #endregion

    // #region Data Structure Conversion
    function convertLegacyProposalToTree(proposal) {
      const root = { title: 'root', children: [], isRoot: true, id: 'root-0' };
      const findOrCreateNode = (path) => {
        let current = root;
        path.forEach(part => {
          let node = current.children.find(child => child.title === part && child.children);
          if (!node) {
            node = { title: part, children: [], id: `folder-${Date.now()}-${Math.random()}` };
            current.children.push(node);
          }
          current = node;
        });
        return current;
      };

      if (proposal['书签栏'] && typeof proposal['书签栏'] === 'object') {
        for (const categoryPath in proposal['书签栏']) {
          const pathParts = categoryPath.split(' / ');
          const leafNode = findOrCreateNode(['书签栏', ...pathParts]);
          const bookmarks = proposal['书签栏'][categoryPath];
          if (Array.isArray(bookmarks)) {
            leafNode.children.push(...bookmarks);
          }
        }
      }

      if (proposal['其他书签'] && Array.isArray(proposal['其他书签'])) {
        const otherBookmarksNode = findOrCreateNode(['其他书签']);
        otherBookmarksNode.children.push(...proposal['其他书签']);
      }
      
      return root;
    }
    // #endregion

    // #region Rendering Logic
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
                a.className = 'bookmark';
                a.innerHTML = `<img src="${node.faviconUrl || 'images/icon16.png'}" class="favicon" />${node.title}`;
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
                    const subTree = renderTree(node.children, container, isSearch);
                    if (!isSearch) subTree.style.display = 'none';
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

    function renderProposal(node, isSearch = false) {
      const ul = document.createElement('ul');
      ul.className = 'bookmark-tree';
      if (node.id) ul.dataset.folderId = node.id;

      const sortedChildren = [...(node.children || [])].sort((a, b) => {
        if (node.isRoot) {
            if (a.title === '书签栏') return -1;
            if (b.title === '书签栏') return 1;
        }
        const aIsFolder = !!a.children;
        const bIsFolder = !!b.children;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.title.localeCompare(b.title);
      });

      for (const child of sortedChildren) {
        const li = document.createElement('li');
        if (child.url) {
          li.appendChild(createBookmarkElement(child));
        } else {
          const isTopLevel = node.isRoot;
          const { folderContainer, subUl } = createFolderElement(child, isSearch, isTopLevel);
          li.appendChild(folderContainer);
          li.appendChild(subUl);
        }
        ul.appendChild(li);
      }
      
      if (!isSearch && !node.isRoot) {
        new Sortable(ul, {
            group: 'bookmarks',
            animation: 150,
            handle: '.bookmark-item, .folder-container',
            multiDrag: true,
            selectedClass: 'selected',
            onMove: handleDragMove,
            onEnd: handleDragEnd,
            onAdd: handleDragAdd
        });
      }
      return ul;
    }

    function createFolderElement(node, isSearch, isTopLevel = false) {
        const folderContainer = document.createElement('div');
        folderContainer.className = 'folder-container';
        folderContainer.dataset.folderId = node.id;
        const folderSpan = document.createElement('span');
        folderSpan.className = 'folder';
        folderSpan.innerHTML = `<i class="material-icons">folder</i><span class="folder-title">${node.title}</span>`;
        const folderActions = document.createElement('div');
        folderActions.className = 'folder-actions';

        if (isTopLevel) {
            folderActions.innerHTML = `<i class="material-icons" title="添加项目">add_circle_outline</i>`;
        } else {
            folderActions.innerHTML = `
                <i class="material-icons" title="添加项目">add_circle_outline</i>
                <i class="material-icons" title="编辑文件夹">edit</i>
                <i class="material-icons" title="删除文件夹">delete</i>
            `;
        }

        folderContainer.appendChild(folderSpan);
        folderContainer.appendChild(folderActions);
        const subUl = renderProposal(node, isSearch);
        if (!isSearch) subUl.style.display = 'none';
        
        folderContainer.addEventListener('click', (e) => {
            if (e.target.closest('.folder-actions')) return;
            const isCollapsed = subUl.style.display === 'none';
            subUl.style.display = isCollapsed ? 'block' : 'none';
            folderSpan.querySelector('.material-icons').textContent = isCollapsed ? 'folder_open' : 'folder';
        });

        addFolderEventListeners(folderActions, folderSpan, node, isTopLevel);
        return { folderContainer, subUl };
    }

    function createBookmarkElement(bookmark) {
        const li = document.createElement('li');
        const bookmarkDiv = document.createElement('div');
        bookmarkDiv.className = 'bookmark-item';
        if (selectedBookmarkIds.has(String(bookmark.id))) {
            bookmarkDiv.classList.add('selected');
        }
        bookmarkDiv.dataset.id = String(bookmark.id);
        bookmarkDiv.dataset.url = String(bookmark.url);
        const content = document.createElement('div');
        content.className = 'bookmark-content';
        content.innerHTML = `
            <img src="${bookmark.faviconUrl || 'images/icon16.png'}" class="favicon" alt="">
            <span class="bookmark-title" title="${bookmark.title}">${bookmark.title}</span>
        `;
        const actions = document.createElement('div');
        actions.className = 'bookmark-actions';
        actions.innerHTML = `
            <i class="material-icons" title="编辑书签">edit</i>
            <i class="material-icons" title="复制链接">link</i>
            <i class="material-icons" title="打开书签">open_in_new</i>
        `;
        bookmarkDiv.appendChild(content);
        bookmarkDiv.appendChild(actions);
        li.appendChild(bookmarkDiv);
        return li;
    }
    // #endregion

    // #region Event Listeners & Handlers
    function addFolderEventListeners(actionsContainer, folderSpan, node, isTopLevel = false) {
        const addBtn = actionsContainer.querySelector('[title="添加项目"]');
        const editBtn = actionsContainer.querySelector('[title="编辑文件夹"]');
        const deleteBtn = actionsContainer.querySelector('[title="删除文件夹"]');
        const folderTitleSpan = folderSpan.querySelector('.folder-title');

        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addModalEl.dataset.parentId = node.id;
            const folderTab = addModalEl.querySelector('a[href="#add-folder-form"]').parentElement;
            const bookmarkTab = addModalEl.querySelector('a[href="#add-bookmark-form"]').parentElement;
            folderTab.classList.remove('disabled');
            bookmarkTab.classList.remove('disabled');
            addModalTabsInstance.select('add-bookmark-form');
            addModalTabsInstance.updateTabIndicator();
            addModalInstance.open();
        });

        if (!isTopLevel) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const folderContainer = actionsContainer.parentElement;
                // Prevent parent folder click listener while editing
                folderContainer.style.pointerEvents = 'none';

                const currentTitle = folderTitleSpan.textContent;
                
                const wrapper = document.createElement('div');
                wrapper.className = 'folder-title-input-wrapper';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentTitle;
                input.className = 'folder-title-input';

                const clearIcon = document.createElement('i');
                clearIcon.className = 'material-icons folder-title-input-clear';
                clearIcon.textContent = 'close';
                clearIcon.onclick = () => {
                    input.value = '';
                    input.focus();
                };

                wrapper.appendChild(input);
                wrapper.appendChild(clearIcon);
                
                folderTitleSpan.style.display = 'none';
                folderSpan.appendChild(wrapper);
                
                // Focus and move cursor to the end
                input.focus();
                input.setSelectionRange(currentTitle.length, currentTitle.length);

                const saveChanges = () => {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== currentTitle) {
                        node.title = newTitle;
                        folderTitleSpan.textContent = newTitle;
                        showToast('文件夹已重命名', 'success');
                    }
                    if (folderSpan.contains(wrapper)) {
                        folderSpan.removeChild(wrapper);
                    }
                    folderTitleSpan.style.display = 'inline-block';
                    folderContainer.style.pointerEvents = 'auto'; // Re-enable parent click
                    input.removeEventListener('blur', saveChanges);
                };

                input.addEventListener('blur', saveChanges);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    } else if (e.key === 'Escape') {
                        input.value = currentTitle;
                        input.blur();
                    }
                });
            });

            deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkCount = node.children.filter(c => c.url).length;
            const subfolderCount = node.children.filter(c => c.children).length;
            const deleteAction = () => {
                const parent = findNodeById(newProposalTree, node.id, true).parent;
                if (parent) {
                    const index = parent.children.findIndex(c => c.id === node.id);
                    if (index > -1) {
                        parent.children.splice(index, 1);
                        displayNewProposal(newProposalTree);
                        showToast(`文件夹 "${node.title}" 已删除`, 'success');
                    }
                }
            };
            if (bookmarkCount > 0 || subfolderCount > 0) {
                if (confirm(`确定要删除 "${node.title}" 文件夹吗？\n这将移除其中包含的所有内容。`)) {
                    deleteAction();
                }
            } else {
                deleteAction();
            }
        });
        }
    }

    function setupGlobalEventListeners() {
        newPanel.addEventListener('click', (e) => {
            const bookmarkItem = e.target.closest('.bookmark-item');
            if (bookmarkItem && e.shiftKey) {
                e.preventDefault();
                const bookmarkId = bookmarkItem.dataset.id;
                toggleSelection(bookmarkId, bookmarkItem);
            }
        });
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => {
                if (confirm(`确定要删除选中的 ${selectedBookmarkIds.size} 个书签吗？`)) {
                    selectedBookmarkIds.forEach(id => findAndRemoveNodeById(newProposalTree, id));
                    selectedBookmarkIds.clear();
                    displayNewProposal(newProposalTree);
                    updateBulkActionUI();
                    showToast('选中的书签已删除', 'success');
                }
            });
        }
        const saveAddBtn = document.getElementById('saveAddBtn');
        saveAddBtn.addEventListener('click', handleAddItem);
    }

    function handleAddItem() {
        const parentId = addModalEl.dataset.parentId;
        const parentNode = findNodeById(newProposalTree, parentId).node;
        if (!parentNode) {
            showToast('无法找到父文件夹', 'error');
            return;
        }
        const activeTabId = addModalTabsInstance.el.querySelector('.tab a.active').hash;
        const isFolder = activeTabId === '#add-folder-form';
        let newNodeData;
        let newElement;
        if (isFolder) {
            const folderName = document.getElementById('addFolderName').value.trim();
            if (!folderName) { showToast('文件夹名称不能为空', 'error'); return; }
            if (parentNode.children.some(c => c.title === folderName && c.children)) {
                showToast('该文件夹已存在', 'error'); return;
            }
            newNodeData = {
                title: folderName,
                children: [],
                id: `folder-${Date.now()}-${Math.random()}`
            };
            parentNode.children.unshift(newNodeData);
            const { folderContainer, subUl } = createFolderElement(newNodeData, false);
            newElement = document.createElement('li');
            newElement.appendChild(folderContainer);
            newElement.appendChild(subUl);
        } else {
            const title = document.getElementById('addBookmarkTitle').value.trim();
            let url = document.getElementById('addBookmarkUrl').value.trim();
            if (!title || !url) { showToast('书签名称和URL不能为空', 'error'); return; }
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            try { new URL(url); } catch (_) { showToast('请输入有效的URL', 'error'); return; }
            newNodeData = { id: `temp-${Date.now()}`, title, url, isNew: true };
            parentNode.children.unshift(newNodeData);
            newElement = createBookmarkElement(newNodeData);
        }
        const parentFolderContainer = newPanel.querySelector(`[data-folder-id="${parentId}"]`);
        if (parentFolderContainer) {
            const parentUl = parentFolderContainer.nextElementSibling;
            if (parentUl && parentUl.tagName === 'UL') {
                parentUl.prepend(newElement);
                parentUl.style.display = 'block';
                parentFolderContainer.querySelector('.material-icons').textContent = 'folder_open';
            }
        } else {
            newPanel.querySelector('.bookmark-tree').prepend(newElement);
        }
        addModalInstance.close();
        showToast('项目已添加', 'success');
        document.getElementById('addFolderName').value = '';
        document.getElementById('addBookmarkTitle').value = '';
        document.getElementById('addBookmarkUrl').value = '';
    }
    // #endregion

    // #region Drag & Drop Logic
    function handleDragMove(evt) {
        const target = evt.related;
        if (currentDropTarget) {
            currentDropTarget.classList.remove('drop-target');
            clearTimeout(dropTargetTimer);
            currentDropTarget = null;
        }
        if (target.classList.contains('folder-container')) {
            currentDropTarget = target;
            dropTargetTimer = setTimeout(() => target.classList.add('drop-target'), 500);
        }
    }

    function handleDragEnd() {
        if (currentDropTarget) {
            currentDropTarget.classList.remove('drop-target');
            clearTimeout(dropTargetTimer);
            currentDropTarget = null;
        }
    }

    function handleDragAdd(evt) {
        const itemEl = evt.item;
        const bookmarkId = itemEl.dataset.id;
        const toListEl = evt.to;
        const targetFolderId = toListEl.dataset.folderId;
        const { node: movedNode, parent: oldParent } = findNodeById(newProposalTree, bookmarkId, true);
        const { node: targetParent } = findNodeById(newProposalTree, targetFolderId, false);
        if (movedNode && oldParent && targetParent) {
            const oldIndex = oldParent.children.findIndex(c => c.id === bookmarkId);
            if (oldIndex > -1) oldParent.children.splice(oldIndex, 1);
            targetParent.children.push(movedNode);
            showToast(`项目已移至 "${targetParent.title}"`, 'success');
        } else {
            showToast('移动失败，无法找到节点', 'error');
            displayNewProposal(newProposalTree);
        }
    }
    // #endregion

    // #region Utility Functions
    function showToast(message, type = 'info') {
        const toastClass = type === 'success' ? 'green' : 
                          type === 'error' ? 'red' : 
                          type === 'warning' ? 'orange' : 'blue';
        const icon = type === 'success' ? 'check_circle' : 
                    type === 'error' ? 'error' : 
                    type === 'warning' ? 'warning' : 'info';
        if (typeof M !== 'undefined' && M.toast) {
          M.toast({
            html: `<i class="material-icons left">${icon}</i>${message}`,
            classes: toastClass,
            displayLength: 3000
          });
        } else {
          console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    function findNodeById(root, id, findParent = false) {
        let result = { node: null, parent: null };
        function recurse(current, parent) {
            if (result.node) return;
            if (String(current.id) === String(id)) {
                result = { node: current, parent: parent };
                return;
            }
            if (current.children) {
                for (const child of current.children) {
                    recurse(child, current);
                }
            }
        }
        recurse(root, null);
        return findParent ? result : { node: result.node };
    }
    
    function findAndRemoveNodeById(root, id) {
        const { node, parent } = findNodeById(root, id, true);
        if (node && parent) {
            const index = parent.children.findIndex(c => c.id === id);
            if (index > -1) {
                parent.children.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    function toggleSelection(bookmarkId, bookmarkItem) {
        if (selectedBookmarkIds.has(bookmarkId)) {
            selectedBookmarkIds.delete(bookmarkId);
            bookmarkItem.classList.remove('selected');
        } else {
            selectedBookmarkIds.add(bookmarkId);
            bookmarkItem.classList.add('selected');
        }
        updateBulkActionUI();
    }

    function updateBulkActionUI() {
        const panelActions = document.querySelector('#newStructure .panel-header .panel-actions');
        if (!panelActions) return;
        panelActions.style.display = selectedBookmarkIds.size > 0 ? 'flex' : 'none';
    }
    // #endregion

    // #region Main Execution & Stats
    function animateNumber(element, targetValue) {
        if (!element) return;
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) return;
        const duration = 1000;
        const steps = Math.abs(targetValue - currentValue);
        if (steps === 0) return;
        const increment = targetValue > currentValue ? 1 : -1;
        const stepDuration = Math.max(1, duration / steps);
        let current = currentValue;
        const timer = setInterval(() => {
            current += increment;
            element.textContent = current;
            if (current === targetValue) {
                clearInterval(timer);
            }
        }, stepDuration);
    }

    function displayOriginalStructure(tree) {
        originalPanel.innerHTML = '';
        const nodesToRender = (tree.length > 0 && tree[0].children) ? tree[0].children : tree;
        originalPanel.appendChild(renderTree(nodesToRender, false));
    }

    function displayNewProposal(tree) {
        newPanel.innerHTML = '';
        newPanel.appendChild(renderProposal(tree));
    }

    function updateStats() {
        function countRecursively(nodes) {
            let folders = 0;
            let bookmarks = 0;
            nodes.forEach(node => {
                if (node.url) {
                    bookmarks++;
                } else if (node.children) {
                    folders++;
                    const childStats = countRecursively(node.children);
                    folders += childStats.folders;
                    bookmarks += childStats.bookmarks;
                }
            });
            return { folders, bookmarks };
        }
        if (originalBookmarkTree.length > 0) {
            const originalStats = countRecursively(originalBookmarkTree);
            animateNumber(totalFoldersEl, originalStats.folders);
            animateNumber(totalBookmarksEl, originalStats.bookmarks);
        }
        if (newProposalTree.children) {
            const newStats = countRecursively(newProposalTree.children);
            animateNumber(aiProcessedEl, newStats.bookmarks);
        }
    }

    function initialize() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['originalTree', 'newProposal'], (data) => {
                if (data.originalTree && data.newProposal) {
                    originalBookmarkTree = data.originalTree;
                    newProposalTree = convertLegacyProposalToTree(data.newProposal);
                    displayOriginalStructure(originalBookmarkTree);
                    displayNewProposal(newProposalTree);
                    updateStats();
                } else {
                    originalPanel.innerHTML = '<div class="loading-state"><p>暂无书签数据，请点击重新分析按钮</p></div>';
                    newPanel.innerHTML = '<div class="loading-state"><p>等待AI分析结果...</p></div>';
                }
            });
        }
        setupGlobalEventListeners();
    }

    initialize();
    // #endregion
  }, 100);
});
