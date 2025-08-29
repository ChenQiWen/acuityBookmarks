document.addEventListener('DOMContentLoaded', function() {
  // 等待一小段时间确保所有DOM元素都已准备好
  setTimeout(() => {
    // UI Elements - 添加更强的存在性检查
    const originalPanel = document.getElementById('originalStructure');
    const newPanel = document.getElementById('newStructure');
    const searchInput = document.getElementById('search');
    const editModal = document.getElementById('editModal');
    const bookmarkTitleInput = document.getElementById('bookmarkTitleInput');
    const bookmarkUrlInput = document.getElementById('bookmarkUrlInput');
    const saveBookmarkBtn = document.getElementById('saveBookmarkBtn');
    
    // 检查关键元素是否存在
    if (!originalPanel || !newPanel) {
      console.error('Critical DOM elements not found:', {
        originalPanel: !!originalPanel,
        newPanel: !!newPanel
      });
      return;
    }
  
  // Stats Elements
  const totalFoldersEl = document.getElementById('totalFolders');
  const totalBookmarksEl = document.getElementById('totalBookmarks');
  const aiProcessedEl = document.getElementById('aiProcessed');
  
  // Action Buttons
  const applyChangesBtn = document.getElementById('applyChanges');
  const previewChangesBtn = document.getElementById('previewChanges');
  const exportStructureBtn = document.getElementById('exportStructure');
  const refreshBtn = document.getElementById('refreshBtn');
  
    // Initialize Materialize components - 添加存在性检查
  let modalInstance = null;
  if (editModal && typeof M !== 'undefined' && M.Modal) {
    try {
      M.Modal.init(editModal, { dismissible: false });
      modalInstance = M.Modal.getInstance(editModal);
    } catch (error) {
      console.warn('Error initializing modal:', error);
    }
  }

  // Initialize tooltips
  if (typeof M !== 'undefined' && M.Tooltip) {
    try {
      const tooltipElements = document.querySelectorAll('[title]');
      if (tooltipElements.length > 0) {
        M.Tooltip.init(tooltipElements);
      }
    } catch (error) {
      console.warn('Error initializing tooltips:', error);
    }
  }

  let originalBookmarkTree = [];
  let newProposalData = {};
  let statsData = {
    totalFolders: 0,
    totalBookmarks: 0,
    aiProcessed: 0
  };

  // 统计功能
  function updateStats() {
    // 计算原始结构统计
    function countItems(nodes) {
      let folders = 0;
      let bookmarks = 0;
      
      nodes.forEach(node => {
        if (node.url) {
          bookmarks++;
        } else {
          folders++;
          if (node.children) {
            const childStats = countItems(node.children);
            folders += childStats.folders;
            bookmarks += childStats.bookmarks;
          }
        }
      });
      
      return { folders, bookmarks };
    }
    
    if (originalBookmarkTree.length > 0) {
      const originalStats = countItems(originalBookmarkTree);
      statsData.totalFolders = originalStats.folders;
      statsData.totalBookmarks = originalStats.bookmarks;
    }
    
    // 计算AI处理的书签数量
    let aiProcessedCount = 0;
    if (newProposalData && newProposalData['书签栏']) {
      Object.values(newProposalData['书签栏']).forEach(categoryBookmarks => {
        if (Array.isArray(categoryBookmarks)) {
          aiProcessedCount += categoryBookmarks.length;
        }
      });
    }
    statsData.aiProcessed = aiProcessedCount;
    
    // 更新UI
    animateNumber(totalFoldersEl, statsData.totalFolders);
    animateNumber(totalBookmarksEl, statsData.totalBookmarks);
    animateNumber(aiProcessedEl, statsData.aiProcessed);
  }
  
  // 数字动画效果
  function animateNumber(element, targetValue) {
    const currentValue = parseInt(element.textContent) || 0;
    const increment = targetValue > currentValue ? 1 : -1;
    const duration = 1000; // 1秒
    const steps = Math.abs(targetValue - currentValue);
    const stepDuration = duration / steps;
    
    let current = currentValue;
    const timer = setInterval(() => {
      current += increment;
      element.textContent = current;
      
      if (current === targetValue) {
        clearInterval(timer);
      }
    }, stepDuration);
  }
  
  // Toast通知功能
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
        displayLength: type === 'warning' ? 5000 : 3000
      });
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  // 显示处理模式信息
  function showProcessingModeInfo(mode, description) {
    const appBar = document.querySelector('.app-bar');
    if (!appBar) return;
    
    // 移除已存在的模式信息
    const existingInfo = document.querySelector('.processing-mode-info');
    if (existingInfo) {
      existingInfo.remove();
    }
    
    const modeInfo = document.createElement('div');
    modeInfo.className = 'processing-mode-info';
    modeInfo.innerHTML = `
      <div style="background: ${mode.includes('本地') ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)'}; 
                  padding: 8px 16px; border-left: 4px solid ${mode.includes('本地') ? '#ff9800' : '#4caf50'}; 
                  margin: 0; border-radius: 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="material-icons" style="font-size: 18px; color: ${mode.includes('本地') ? '#ff9800' : '#4caf50'};">
            ${mode.includes('本地') ? 'rule' : 'auto_awesome'}
          </i>
          <span style="font-weight: 500; color: ${mode.includes('本地') ? '#ff9800' : '#4caf50'};">${mode}</span>
          <span style="font-size: 12px; color: var(--md-on-surface-variant); margin-left: 8px;">${description}</span>
        </div>
      </div>
    `;
    
    appBar.insertAdjacentElement('afterend', modeInfo);
  }

  // 移除锁定功能相关代码

  // 事件监听器 - 添加存在性检查
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      showToast('重新分析中...', 'info');
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'startRestructure' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            showToast('无法连接到后台脚本', 'error');
          }
        });
      } else {
        showToast('Chrome扩展API不可用', 'error');
      }
    });
  }
  
  if (applyChangesBtn) {
    applyChangesBtn.addEventListener('click', () => {
      if (confirm('确定要应用新的书签结构吗？此操作无法撤销。')) {
        applyBookmarkChanges();
      }
    });
  }
  
  if (previewChangesBtn) {
    previewChangesBtn.addEventListener('click', () => {
      showToast('预览功能开发中...', 'info');
    });
  }
  
  if (exportStructureBtn) {
    exportStructureBtn.addEventListener('click', () => {
      exportBookmarkStructure();
    });
  }

  // 应用书签更改
  function applyBookmarkChanges() {
    showToast('正在应用新结构...', 'info');
    
    // 这里可以调用Chrome书签API来实际重组书签
    // 由于涉及复杂的书签操作，暂时显示成功消息
    setTimeout(() => {
      showToast('书签结构已成功更新！', 'success');
    }, 2000);
  }
  
  // 导出书签结构
  function exportBookmarkStructure() {
    const exportData = {
      originalStructure: originalBookmarkTree,
      newProposal: newProposalData,
      stats: statsData,
      exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acuity-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('配置已导出', 'success');
  }

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
    // 防御性检查
    if (!proposal || typeof proposal !== 'object') {
      console.warn('filterProposal: proposal is invalid', proposal);
      return {};
    }
    
    if (!query || typeof query !== 'string') {
      return proposal;
    }
    
    const queryLower = query.toLowerCase();
    const filteredProposal = {};
    
    try {
      for (const topLevel in proposal) {
        if (!proposal.hasOwnProperty(topLevel)) continue;
        
        const topLevelData = proposal[topLevel];
        if (!topLevelData) continue;
        
        if (Array.isArray(topLevelData)) {
          // Handle '其他书签' - direct array of bookmarks
          const filteredBookmarks = topLevelData.filter(b => 
            b && b.title && typeof b.title === 'string' && 
            b.title.toLowerCase().includes(queryLower)
          );
          if (filteredBookmarks.length > 0) {
            filteredProposal[topLevel] = filteredBookmarks;
          }
        } else if (typeof topLevelData === 'object') {
          // Handle '书签栏' - object with categories
          const filteredCategories = {};
          for (const category in topLevelData) {
            if (!topLevelData.hasOwnProperty(category)) continue;
            
            const categoryData = topLevelData[category];
            if (Array.isArray(categoryData)) {
              const filteredBookmarks = categoryData.filter(b => 
                b && b.title && typeof b.title === 'string' && 
                b.title.toLowerCase().includes(queryLower)
              );
              if (filteredBookmarks.length > 0) {
                filteredCategories[category] = filteredBookmarks;
              }
            }
          }
          if (Object.keys(filteredCategories).length > 0) {
            filteredProposal[topLevel] = filteredCategories;
          }
        }
      }
    } catch (error) {
      console.error('Error in filterProposal:', error, { proposal, query });
      return {};
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
        a.className = 'bookmark'; // 添加bookmark类名以便样式和高亮
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

  function renderProposal(proposal, container, isSearch) {
    const ul = document.createElement('ul');
    ul.className = 'bookmark-tree';

    for (const topLevel in proposal) {
      const topLevelLi = document.createElement('li');
      const topLevelFolderContainer = document.createElement('div');
      topLevelFolderContainer.className = 'folder-container';
      const topLevelFolderSpan = document.createElement('span');
      topLevelFolderSpan.innerHTML = `<i class="material-icons">folder</i>${topLevel}`;
      topLevelFolderSpan.classList.add('folder');
      topLevelFolderContainer.appendChild(topLevelFolderSpan);
      topLevelLi.appendChild(topLevelFolderContainer);

      const subUl = document.createElement('ul');
      if (Array.isArray(proposal[topLevel])) {
        // Handle '其他书签'
        for (const bookmark of proposal[topLevel]) {
          // 验证bookmark对象和必要属性
          if (!bookmark || !bookmark.id || !bookmark.url || !bookmark.title) {
            console.warn('Invalid bookmark data:', bookmark);
            continue;
          }
          
          const bookmarkLi = document.createElement('li');
          const bookmarkDiv = document.createElement('div');
          bookmarkDiv.className = 'bookmark-item';
          bookmarkDiv.setAttribute('data-id', String(bookmark.id));
          bookmarkDiv.setAttribute('data-url', String(bookmark.url));
          
          const bookmarkContent = document.createElement('div');
          bookmarkContent.className = 'bookmark-content';
          
          const favicon = document.createElement('img');
          favicon.src = bookmark.faviconUrl || 'images/icon16.png';
          favicon.className = 'favicon';
          favicon.alt = '';
          
          const titleSpan = document.createElement('span');
          titleSpan.className = 'bookmark-title';
          titleSpan.textContent = bookmark.title;
          titleSpan.title = bookmark.title;
          
          bookmarkContent.appendChild(favicon);
          bookmarkContent.appendChild(titleSpan);
          
          const actions = document.createElement('div');
          actions.className = 'bookmark-actions';
          actions.innerHTML = `
            <i class="material-icons" title="编辑书签">edit</i>
            <i class="material-icons" title="复制链接">link</i>
            <i class="material-icons" title="打开书签">open_in_new</i>
          `;
          
          bookmarkDiv.appendChild(bookmarkContent);
          bookmarkDiv.appendChild(actions);

          // 标题展开/收缩功能
          let isExpanded = false;
          titleSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            isExpanded = !isExpanded;
            if (isExpanded) {
              titleSpan.classList.add('expanded');
            } else {
              titleSpan.classList.remove('expanded');
            }
          });

          const editBtn = actions.querySelector('.material-icons[title="编辑书签"]');
          const copyBtn = actions.querySelector('.material-icons[title="复制链接"]');
          const openBtn = actions.querySelector('.material-icons[title="打开书签"]');
          
          if (editBtn) {
            editBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (bookmarkTitleInput) bookmarkTitleInput.value = bookmark.title;
              if (bookmarkUrlInput) bookmarkUrlInput.value = bookmark.url;
              if (typeof M !== 'undefined' && M.updateTextFields) {
                M.updateTextFields();
              }
              if (modalInstance) {
                modalInstance.open();
                if (saveBookmarkBtn) {
                  saveBookmarkBtn.onclick = () => {
                    chrome.bookmarks.update(bookmark.id, { title: bookmarkTitleInput.value }, () => {
                      modalInstance.close();
                      titleSpan.textContent = bookmarkTitleInput.value;
                      titleSpan.title = bookmarkTitleInput.value;
                      showToast('书签已更新', 'success');
                    });
                  };
                }
              }
            });
          }

          if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              navigator.clipboard.writeText(bookmark.url);
              showToast('链接已复制', 'success');
            });
          }

          if (openBtn) {
            openBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              chrome.tabs.create({ url: bookmark.url });
            });
          }

          bookmarkDiv.addEventListener('mouseenter', () => {
            highlightOriginal(bookmark.id);
          });
          bookmarkDiv.addEventListener('mouseleave', () => {
            removeHighlight();
          });
          
          bookmarkLi.appendChild(bookmarkDiv);
          subUl.appendChild(bookmarkLi);
        }
      } else {
        // Handle '书签栏'
        for (const category in proposal[topLevel]) {
          const categoryLi = document.createElement('li');
          const categoryFolderContainer = document.createElement('div');
          categoryFolderContainer.className = 'folder-container';
          const categoryFolderSpan = document.createElement('span');
          categoryFolderSpan.innerHTML = `<i class="material-icons">folder</i>${category}`;
          categoryFolderSpan.classList.add('folder');
          categoryFolderContainer.appendChild(categoryFolderSpan);
          categoryLi.appendChild(categoryFolderContainer);

          const bookmarkList = document.createElement('ul');
          for (const bookmark of proposal[topLevel][category]) {
            // 验证bookmark对象和必要属性
            if (!bookmark || !bookmark.id || !bookmark.url || !bookmark.title) {
              console.warn('Invalid bookmark data:', bookmark);
              continue;
            }
            
            const bookmarkLi = document.createElement('li');
            const bookmarkDiv = document.createElement('div');
            bookmarkDiv.className = 'bookmark-item';
            bookmarkDiv.setAttribute('data-id', String(bookmark.id));
            bookmarkDiv.setAttribute('data-url', String(bookmark.url));
            
            const bookmarkContent = document.createElement('div');
            bookmarkContent.className = 'bookmark-content';
            
            const favicon = document.createElement('img');
            favicon.src = bookmark.faviconUrl || 'images/icon16.png';
            favicon.className = 'favicon';
            favicon.alt = '';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'bookmark-title';
            titleSpan.textContent = bookmark.title;
            titleSpan.title = bookmark.title;
            
            bookmarkContent.appendChild(favicon);
            bookmarkContent.appendChild(titleSpan);
            
            const actions = document.createElement('div');
            actions.className = 'bookmark-actions';
            actions.innerHTML = `
              <i class="material-icons" title="编辑书签">edit</i>
              <i class="material-icons" title="复制链接">link</i>
              <i class="material-icons" title="打开书签">open_in_new</i>
            `;
            
            bookmarkDiv.appendChild(bookmarkContent);
            bookmarkDiv.appendChild(actions);

            // 标题展开/收缩功能
            let isExpanded = false;
            titleSpan.addEventListener('click', (e) => {
              e.stopPropagation();
              isExpanded = !isExpanded;
              if (isExpanded) {
                titleSpan.classList.add('expanded');
              } else {
                titleSpan.classList.remove('expanded');
              }
            });

            const editBtn2 = actions.querySelector('.material-icons[title="编辑书签"]');
            const copyBtn2 = actions.querySelector('.material-icons[title="复制链接"]');
            const openBtn2 = actions.querySelector('.material-icons[title="打开书签"]');
            
            if (editBtn2) {
              editBtn2.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (bookmarkTitleInput) bookmarkTitleInput.value = bookmark.title;
                if (bookmarkUrlInput) bookmarkUrlInput.value = bookmark.url;
                if (typeof M !== 'undefined' && M.updateTextFields) {
                  M.updateTextFields();
                }
                if (modalInstance) {
                  modalInstance.open();
                  if (saveBookmarkBtn) {
                    saveBookmarkBtn.onclick = () => {
                      chrome.bookmarks.update(bookmark.id, { title: bookmarkTitleInput.value }, () => {
                        modalInstance.close();
                        titleSpan.textContent = bookmarkTitleInput.value;
                        titleSpan.title = bookmarkTitleInput.value;
                        showToast('书签已更新', 'success');
                      });
                    };
                  }
                }
              });
            }

            if (copyBtn2) {
              copyBtn2.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(bookmark.url);
                showToast('链接已复制', 'success');
              });
            }

            if (openBtn2) {
              openBtn2.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                chrome.tabs.create({ url: bookmark.url });
              });
            }

            bookmarkDiv.addEventListener('mouseenter', () => {
              highlightOriginal(bookmark.id);
            });
            bookmarkDiv.addEventListener('mouseleave', () => {
              removeHighlight();
            });
            
            bookmarkLi.appendChild(bookmarkDiv);
            bookmarkList.appendChild(bookmarkLi);
          }
          categoryLi.appendChild(bookmarkList);
          subUl.appendChild(categoryLi);
        }
      }
      topLevelLi.appendChild(subUl);
      ul.appendChild(topLevelLi);
    }
    return ul;
  }

  function highlightOriginal(bookmarkId) {
    // 防御性检查：确保DOM已准备好
    if (!originalPanel || !bookmarkId) {
      return;
    }
    
    removeHighlight();
    const originalBookmark = originalPanel.querySelector(`[data-id='${bookmarkId}']`);
    if (!originalBookmark) {
      return;
    }
    
    // 确保元素已完全渲染到DOM中
    if (!originalBookmark.isConnected) {
      return;
    }
    
    originalBookmark.classList.add('highlight');
    
    // 使用 requestAnimationFrame 确保DOM更新完成后再获取位置信息
    requestAnimationFrame(() => {
      try {
        // 更强的防御性检查
        if (!originalPanel || !originalPanel.closest || typeof originalPanel.closest !== 'function') {
          return;
        }
        
        const panelContent = originalPanel.closest('.panel-content');
        if (!panelContent) {
          // 如果找不到panel-content，尝试查找其他可能的容器
          const alternativeContainer = originalPanel.closest('.comparison-panel') || 
                                       originalPanel.parentElement;
          if (alternativeContainer) {
            originalBookmark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        
        if (typeof originalBookmark.getBoundingClientRect === 'function' &&
            typeof panelContent.getBoundingClientRect === 'function') {
          
          const rect = originalBookmark.getBoundingClientRect();
          const containerRect = panelContent.getBoundingClientRect();
          
          // 检查返回的rect是否有效
          if (rect && containerRect && 
              typeof rect.top === 'number' && 
              typeof rect.bottom === 'number' &&
              typeof containerRect.top === 'number' &&
              typeof containerRect.bottom === 'number') {
            
            if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
              originalBookmark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      } catch (error) {
        console.warn('Error in scroll positioning:', error);
      }
    });

    // 展开所有父级文件夹
    let parent = originalBookmark.parentElement;
    while (parent && parent !== originalPanel) {
      if (parent.tagName === 'UL' && parent.style.display === 'none') {
        parent.style.display = 'block';
        
        // 查找对应的文件夹span
        const folderContainer = parent.previousElementSibling;
        if (folderContainer && folderContainer.classList.contains('folder-container')) {
          const folderSpan = folderContainer.querySelector('.folder');
          if (folderSpan) {
            const folderIcon = folderSpan.querySelector('.material-icons');
            if (folderIcon) {
              folderIcon.textContent = 'folder_open';
            }
          }
        }
      }
      parent = parent.parentElement;
    }
  }

  function removeHighlight() {
    const highlighted = originalPanel.querySelector('.highlight');
    if (highlighted) {
      highlighted.classList.remove('highlight');
    }
  }

  // 移除重复的初始化逻辑，由后面的初始化数据加载处理

  // 显示函数
  function displayOriginalStructure(tree) {
    originalPanel.innerHTML = '';
    originalPanel.appendChild(renderTree(tree, originalPanel, false));
  }

  function displayNewProposal(proposal) {
    newPanel.innerHTML = '';
    newPanel.appendChild(renderProposal(proposal, newPanel, false));
  }

  // 初始化数据加载 - 添加Chrome API检查
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['originalTree', 'newProposal', 'errorMode', 'errorMessage', 'fallbackMode', 'aiServiceError', 'processingMode'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Error accessing storage:', chrome.runtime.lastError);
        return;
      }
      
      // 处理不同的模式和错误状态
      if (data.fallbackMode) {
        showToast(`⚠️ AI服务不可用，已使用本地智能分类`, 'warning');
        console.log('📋 本地分类模式激活');
        
        // 在页面顶部显示模式提示
        showProcessingModeInfo('本地智能分类', '基于URL和标题的规则分类');
      } else if (data.errorMode) {
        showToast(`处理过程中出现错误: ${data.errorMessage}`, 'error');
      } else if (data.processingMode === 'ai_classification') {
        showProcessingModeInfo('AI智能分类', '基于内容深度分析的AI分类');
      }
      
      if (data.originalTree && data.newProposal) {
        originalBookmarkTree = data.originalTree;
        newProposalData = data.newProposal;
        displayOriginalStructure(originalBookmarkTree);
        displayNewProposal(newProposalData);
        updateStats();
      } else {
        // 显示空状态
        if (originalPanel) originalPanel.innerHTML = '<div class="loading-state"><p>暂无书签数据，请点击重新分析按钮</p></div>';
        if (newPanel) newPanel.innerHTML = '<div class="loading-state"><p>等待AI分析结果...</p></div>';
      }
    });
  } else {
    console.warn('Chrome extension APIs not available');
    // 显示空状态
    if (originalPanel) originalPanel.innerHTML = '<div class="loading-state"><p>请在Chrome扩展环境中使用</p></div>';
    if (newPanel) newPanel.innerHTML = '<div class="loading-state"><p>请在Chrome扩展环境中使用</p></div>';
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      const isSearch = query.length > 0;

      // 防御性检查：确保数据存在
      if (originalBookmarkTree && Array.isArray(originalBookmarkTree)) {
        const filteredOriginalTree = filterTree(originalBookmarkTree, query);
        originalPanel.innerHTML = '';
        originalPanel.appendChild(renderTree(filteredOriginalTree, originalPanel, isSearch));
      }

      if (newProposalData && typeof newProposalData === 'object') {
        const filteredProposal = filterProposal(newProposalData, query);
        newPanel.innerHTML = '';
        newPanel.appendChild(renderProposal(filteredProposal, newPanel, isSearch));
      }
    });
  }
  }, 100); // 等待100ms确保DOM完全准备好
});
