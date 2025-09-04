<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue';
import BookmarkTree from './BookmarkTree.vue';

// --- 简化的状态管理 ---
const isPageLoading = ref(true);
const loadingMessage = ref('正在加载书签数据...');
const originalTree = ref<chrome.bookmarks.BookmarkTreeNode[]>([]);
const newProposalTree = ref<ProposalNode>({ id: 'root-empty', title: '等待数据源', children: [] });

// 简化的数据加载状态
const dataLoadingState = ref({
  chromeApiReady: false,
  storageDataLoaded: false,
  backgroundConnected: false
});

// 搜索和UI状态
const searchQuery = ref('');
const searchMode = ref('exact');
const isGenerating = ref(false);
const progressValue = ref(0);
const progressTotal = ref(0);

// 对话框和通知状态
const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');
const isApplyConfirmDialogOpen = ref(false);

// 书签编辑状态
const isEditBookmarkDialogOpen = ref(false);
const isDeleteBookmarkDialogOpen = ref(false);
const isDeleteFolderDialogOpen = ref(false);
const editingBookmark = ref<any>(null);
const deletingBookmark = ref<any>(null);
const deletingFolder = ref<any>(null);
const editTitle = ref('');
const editUrl = ref('');

// 添加新项目状态
const isAddNewItemDialogOpen = ref(false);
const addItemType = ref<'folder' | 'bookmark'>('bookmark');
const parentFolder = ref<any>(null);
const newItemTitle = ref('');
const newItemUrl = ref('');
// 暂时移除未使用的对话框状态

// 加载状态
const isApplyingChanges = ref(false);

// 书签映射和悬停状态
const hoveredBookmarkId = ref<string | null>(null);
const bookmarkMapping = ref<Map<string, any>>(new Map());
const expandedFolders = ref<Set<string>>(new Set());

// --- 类型定义 ---
interface ProposalNode {
  id: string;
  title: string;
  url?: string;
  children?: ProposalNode[];
  dateAdded?: number;
  index?: number;
}

// --- 简化的数据加载函数 ---

// 1. 首先尝试从Chrome API直接获取书签
async function loadBookmarksFromChromeAPI(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    if (!chrome.bookmarks) {
      reject(new Error('Chrome Bookmarks API 不可用'));
      return;
    }

    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (tree && tree.length > 0) {
        // 提取顶级文件夹（书签栏、其他书签等）
        const topLevelFolders: chrome.bookmarks.BookmarkTreeNode[] = [];
        const rootNode = tree[0];
        
        if (rootNode.children) {
          rootNode.children.forEach((folder) => {
            topLevelFolders.push(folder);
          });
        }
        
        resolve(topLevelFolders);
      } else {
        resolve([]);
      }
    });
  });
}

// 2. 从Chrome Storage加载提案数据
async function loadProposalFromStorage(): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['newProposal'], (data) => {
      resolve(data.newProposal || null);
    });
  });
}

// 3. 简化的数据加载主函数
async function loadAllData() {
  loadingMessage.value = '正在获取书签数据...';
  
  try {
    // 并行加载书签和提案数据
    const [bookmarks, proposal] = await Promise.all([
      loadBookmarksFromChromeAPI(),
      loadProposalFromStorage()
    ]);

    // 更新左侧面板数据
    originalTree.value = bookmarks;
    dataLoadingState.value.chromeApiReady = true;

    // 更新右侧面板数据
    if (proposal) {
      const convertedProposal = convertLegacyProposalToTree(proposal);
      newProposalTree.value = convertedProposal;
    } else {
      // 如果没有提案数据，设置为空状态
      newProposalTree.value = {
        id: 'root-empty',
        title: '等待数据源',
        children: []
      };
    }
    
    dataLoadingState.value.storageDataLoaded = true;

    // 构建书签映射
    if (originalTree.value.length > 0 && newProposalTree.value.children && newProposalTree.value.children.length > 0) {
      buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
    }

    // 显示成功消息
    const bookmarkCount = countTotalBookmarks(originalTree.value);
    showNotification(`数据加载完成，共 ${bookmarkCount} 个书签`, 'success');

  } catch (error: any) {
    console.error('数据加载失败:', error);
    showNotification(`数据加载失败: ${error.message}`, 'error');
    
    // 降级处理：至少尝试显示空状态
    originalTree.value = [];
    newProposalTree.value = {
      id: 'root-empty',
      title: '数据加载失败',
      children: []
    };
  } finally {
    isPageLoading.value = false;
    loadingMessage.value = '';
  }
}

// --- 辅助函数 ---

function countTotalBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): number {
  let count = 0;
  
  function traverse(node: chrome.bookmarks.BookmarkTreeNode) {
    if (node.url) {
      count++;
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  nodes.forEach(traverse);
  return count;
}

function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  snackbarText.value = message;
  snackbarColor.value = type;
  snackbar.value = true;
}

// 转换legacy proposal格式为树状结构
function convertLegacyProposalToTree(proposal: Record<string, any>): ProposalNode {
  const root: ProposalNode = { 
    title: 'AI 建议结构', 
    children: [], 
    id: 'root-proposal' 
  };

  if (!proposal || typeof proposal !== 'object') {
    return root;
  }

  const findOrCreateNode = (path: string[]): ProposalNode => {
    let current = root;
    path.forEach(part => {
      let node = current.children?.find(child => child.title === part && child.children);
      if (!node) {
        node = { 
          title: part, 
          children: [], 
          id: `folder-${Date.now()}-${Math.random()}` 
        };
        current.children = current.children || [];
        current.children.push(node);
      }
      current = node;
    });
    return current;
  };

  // 处理书签栏
  if (proposal['书签栏'] && typeof proposal['书签栏'] === 'object') {
    for (const [categoryPath, bookmarks] of Object.entries(proposal['书签栏'])) {
      const pathParts = categoryPath.split(' / ');
      const leafNode = findOrCreateNode(['书签栏', ...pathParts]);
      if (Array.isArray(bookmarks)) {
        leafNode.children = leafNode.children || [];
        leafNode.children.push(...bookmarks);
      }
    }
  }

  // 处理其他书签
  if (proposal['其他书签'] && Array.isArray(proposal['其他书签'])) {
    const otherBookmarksNode = findOrCreateNode(['其他书签']);
    otherBookmarksNode.children = proposal['其他书签'];
  }

  return root;
}

// 构建书签映射
function buildBookmarkMapping(originalTree: any[], proposedTree: any[]) {
  bookmarkMapping.value.clear();

  const generateBookmarkId = (node: any): string => {
    if (!node || !node.url) return '';
    const identifier = `${node.id || 'no-id'}|${node.url}|${node.title || ''}`;
    try {
      return btoa(encodeURIComponent(identifier)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    } catch (error) {
      let hash = 0;
      for (let i = 0; i < identifier.length; i++) {
        const char = identifier.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36).substring(0, 16);
    }
  };

  const processBookmarks = (nodes: any[], isOriginal: boolean = true) => {
    for (const node of nodes) {
      if (node.url) {
        const bookmarkId = generateBookmarkId(node);
        node.uniqueId = bookmarkId;
        
        if (!bookmarkMapping.value.has(bookmarkId)) {
          bookmarkMapping.value.set(bookmarkId, {
            original: isOriginal ? node : null,
            proposed: !isOriginal ? node : null
          });
        } else {
          const existing = bookmarkMapping.value.get(bookmarkId);
          if (existing) {
            if (isOriginal) {
              existing.original = node;
            } else {
              existing.proposed = node;
            }
          }
        }
      } else if (node.children) {
        processBookmarks(node.children, isOriginal);
      }
    }
  };

  if (originalTree) processBookmarks(originalTree, true);
  if (proposedTree) processBookmarks(proposedTree, false);
}

// --- 计算属性 ---

const isApplyButtonEnabled = computed(() => {
  // 简化比较逻辑
  if (!originalTree.value.length || !newProposalTree.value.children?.length) {
    return false;
  }
  
  if (newProposalTree.value.id === 'root-empty') {
    return false;
  }
  
  // 简单比较：只要右侧有数据就认为可以应用
  return true;
});

const confirmationStats = computed(() => {
  const newTree = newProposalTree.value.children || [];
  return countTreeItems(newTree);
});

function countTreeItems(nodes: any[]): { folders: number; bookmarks: number } {
  let folders = 0;
  let bookmarks = 0;

  const traverse = (items: any[]) => {
    for (const item of items) {
      if (item.children) {
        folders++;
        if (item.children.length > 0) {
          traverse(item.children);
        }
      } else {
        bookmarks++;
      }
    }
  };

  traverse(nodes);
  return { folders, bookmarks };
}

// --- 面板操作函数 ---

const clearProposalData = () => {
  newProposalTree.value = {
    id: 'root-empty',
    title: '等待数据源',
    children: []
  };
  
  chrome.storage.local.remove(['newProposal'], () => {
    showNotification('右侧面板已清空', 'success');
  });
};

const cloneOriginalToProposal = () => {
  if (!originalTree.value || originalTree.value.length === 0) {
    showNotification('左侧面板无数据可克隆', 'warning');
    return;
  }

  // 深克隆原始树结构
  const clonedTree = JSON.parse(JSON.stringify(originalTree.value));

  newProposalTree.value = {
    id: 'root-cloned',
    title: '克隆的书签结构',
    children: clonedTree
  };

  // 构建映射关系
  if (clonedTree && newProposalTree.value.children) {
    buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
  }

  const stats = countTreeItems(clonedTree);
  showNotification(`已成功克隆 ${stats.folders} 个文件夹和 ${stats.bookmarks} 个书签`, 'success');
};

// --- 获取面板显示信息 ---

const getProposalPanelTitle = () => '新的书签目录';

const getProposalPanelIcon = () => {
  if (newProposalTree.value.id === 'root-empty') {
    return 'mdi-plus-circle-outline';
  } else if (newProposalTree.value.id === 'root-cloned') {
    return 'mdi-content-copy';
  }
  return 'mdi-magic-staff';
};

const getProposalPanelColor = () => {
  if (newProposalTree.value.id === 'root-empty') {
    return 'grey';
  } else if (newProposalTree.value.id === 'root-cloned') {
    return 'secondary';
  }
  return 'primary';
};

// --- 事件处理函数 ---

const refresh = () => {
  isPageLoading.value = true;
  loadingMessage.value = '重新生成AI建议...';
  chrome.runtime.sendMessage({ action: 'startRestructure' });
};

const applyChanges = () => {
  isApplyConfirmDialogOpen.value = true;
};

const confirmApplyChanges = async (): Promise<void> => {
  isApplyingChanges.value = true;

  try {
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'applyChanges',
        proposal: newProposalTree.value
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || '应用更改失败'));
        }
      });
    });

    // 重新加载数据
    await loadAllData();

    isApplyConfirmDialogOpen.value = false;
    showNotification('书签结构已成功应用！', 'success');

  } catch (error: any) {
    console.error('应用更改失败:', error);
    showNotification(`应用更改失败: ${error.message}`, 'error');
  } finally {
    isApplyingChanges.value = false;
  }
};

const handleReorder = (): void => {
  // 强制触发响应式更新
  const currentChildren = newProposalTree.value.children ? [...newProposalTree.value.children] : [];
  newProposalTree.value = {
    ...newProposalTree.value,
    children: currentChildren
  };
};

// --- 书签操作函数 ---

const handleEditBookmark = (node: any) => {
  editingBookmark.value = node;
  editTitle.value = node.title;
  editUrl.value = node.url || '';
  isEditBookmarkDialogOpen.value = true;
};

const handleDeleteBookmark = (node: any) => {
  deletingBookmark.value = node;
  isDeleteBookmarkDialogOpen.value = true;
};

const handleDeleteFolder = (node: any) => {
  deletingFolder.value = node;
  isDeleteFolderDialogOpen.value = true;
};

const handleAddNewItem = (parentNode: any) => {
  parentFolder.value = parentNode;
  addItemType.value = 'bookmark';
  newItemTitle.value = '';
  newItemUrl.value = '';
  isAddNewItemDialogOpen.value = true;
};

const handleCopySuccess = () => {
  showNotification('链接已复制到剪贴板', 'success');
};

const handleCopyFailed = () => {
  showNotification('复制链接失败，请重试', 'error');
};

// --- 书签悬停处理 ---

let hoverTimeout: number | null = null;

const handleBookmarkHover = (bookmarkId: string | null) => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }

  hoverTimeout = window.setTimeout(() => {
    if (hoveredBookmarkId.value !== bookmarkId) {
      hoveredBookmarkId.value = bookmarkId;

      if (bookmarkId && bookmarkMapping.value.has(bookmarkId)) {
        const mapping = bookmarkMapping.value.get(bookmarkId);
        if (mapping.proposed && mapping.original) {
          expandedFolders.value.clear();
          expandFolderPath(originalTree.value, mapping.original);
          
          nextTick(() => {
            setTimeout(() => {
              const element = document.querySelector(`[data-bookmark-id="${mapping.original.uniqueId}"]`);
              if (element) {
                element.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                  inline: 'nearest'
                });
              }
            }, 50);
          });
        }
      } else {
        expandedFolders.value.clear();
      }
    }
  }, 150);
};

const expandFolderPath = (nodes: any[], targetNode: any) => {
  expandedFolders.value.clear();
  
  function findPath(currentNodes: any[], target: any, path: string[] = []): boolean {
    for (const node of currentNodes) {
      if (node.children) {
        const newPath = [...path, node.id];
        if (findNodeInChildren(node.children, target)) {
          newPath.forEach(id => expandedFolders.value.add(id));
          findPath(node.children, target, newPath);
          return true;
        }
      }
    }
    return false;
  }
  
  findPath(nodes, targetNode);
  expandedFolders.value = new Set(expandedFolders.value);
};

const findNodeInChildren = (children: any[], targetNode: any): boolean => {
  for (const child of children) {
    if (child.url === targetNode.url && child.title === targetNode.title) {
      return true;
    }
    if (child.children && findNodeInChildren(child.children, targetNode)) {
      return true;
    }
  }
  return false;
};

const handleFolderToggle = (_data: { nodeId: string; expanded: boolean }) => {
  // 用户手动操作文件夹时的处理
};

// --- 生命周期 ---

onMounted(() => {
  // 简化的初始化流程
  setTimeout(() => {
    loadAllData();
  }, 500);

  // 监听来自background script的消息
  if (chrome.runtime) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'aiOrganizeStarted') {
        showNotification('AI正在分析您的书签结构，请稍候...', 'info');
      } else if (request.action === 'aiOrganizeComplete') {
        showNotification('AI建议结构已生成', 'success');
        // 重新加载提案数据
        loadProposalFromStorage().then((proposal) => {
          if (proposal) {
            const convertedProposal = convertLegacyProposalToTree(proposal);
            newProposalTree.value = convertedProposal;
          }
        });
      } else if (request.action === 'applyComplete') {
        showNotification('新书签结构已成功应用！', 'success');
        loadAllData();
      }
    });

    // 监听存储变化
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      
      if (changes.isGenerating) {
        isGenerating.value = changes.isGenerating.newValue;
      }
      
      if (changes.progressCurrent || changes.progressTotal) {
        chrome.storage.local.get(['progressCurrent', 'progressTotal'], (data) => {
          progressTotal.value = data.progressTotal || 0;
          const current = data.progressCurrent || 0;
          progressValue.value = progressTotal.value > 0 ? (current / progressTotal.value) * 100 : 0;
        });
      }
      
      if (changes.newProposal && changes.newProposal.newValue) {
        const proposal = convertLegacyProposalToTree(changes.newProposal.newValue);
        newProposalTree.value = JSON.parse(JSON.stringify(proposal));
      }
    });
  }
});

onUnmounted(() => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
});

// --- 简化的书签操作函数 ---
// 暂时移除未使用的函数，专注于修复数据展示问题
</script>

<template>
  <v-app class="app-container">
    <!-- 加载遮罩 -->
    <v-overlay v-if="isPageLoading" class="loading-overlay">
      <v-card class="loading-card" elevation="8">
        <v-card-text class="text-center">
          <v-progress-circular
            indeterminate
            color="primary"
            size="64"
            class="mb-4"
          ></v-progress-circular>
          <div class="loading-text">{{ loadingMessage }}</div>
          <div class="loading-subtitle">正在准备您的书签数据...</div>
        </v-card-text>
      </v-card>
    </v-overlay>

    <v-app-bar app flat class="app-bar-style">
      <v-app-bar-title class="d-flex align-center">
        <div class="logo-container mr-2">
          <div class="custom-logo-bg"></div>
        </div>
        <div class="app-bar-title">AcuityBookmarks (Fixed)</div>
      </v-app-bar-title>
      
      <div class="search-container">
        <v-text-field
          v-model="searchQuery"
          density="compact" 
          variant="solo" 
          class="search-input"
          bg-color="transparent" 
          flat 
          hide-details
          label="搜索..." 
          prepend-inner-icon="mdi-magnify"
        ></v-text-field>
      </div>
      
      <v-btn-toggle v-model="searchMode" mandatory density="compact" variant="outlined" class="search-mode-toggle">
        <v-btn value="exact" size="small">精准</v-btn>
        <v-btn value="ai" size="small">AI</v-btn>
      </v-btn-toggle>
      
      <v-spacer></v-spacer>
      
      <v-btn @click="refresh" :disabled="isGenerating" prepend-icon="mdi-refresh" variant="tonal" class="refresh-btn">
        重新生成
      </v-btn>

      <v-btn @click="applyChanges" :disabled="!isApplyButtonEnabled" color="white" prepend-icon="mdi-check">
        应用新结构
        <v-chip v-if="isApplyButtonEnabled" size="x-small" color="warning" variant="flat" class="ml-2">有更改</v-chip>
      </v-btn>
    </v-app-bar>

    <v-main class="main-content">
      <!-- 统计卡片 -->
      <v-container fluid class="stats-section page-container">
        <v-row dense class="stats-row">
          <v-col cols="12" sm="4">
            <v-card variant="outlined" class="stat-card-compact" elevation="1">
              <v-card-text class="pa-3">
                <div class="d-flex align-center">
                  <v-avatar color="primary" size="36" class="me-3">
                    <v-icon color="white" size="18">mdi-lightbulb-on-outline</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-caption text-medium-emphasis mb-1">当前书签</div>
                    <div class="text-h6 font-weight-bold text-primary d-flex align-center">
                      {{ originalTree.length }}
                      <span class="text-body-2 ms-1">个文件夹</span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="4">
            <v-card variant="outlined" class="stat-card-compact" elevation="1">
              <v-card-text class="pa-3">
                <div class="d-flex align-center">
                  <v-avatar color="success" size="36" class="me-3">
                    <v-icon color="white" size="18">mdi-timer-sand</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-caption text-medium-emphasis mb-1">数据状态</div>
                    <div class="text-h6 font-weight-bold text-success d-flex align-center">
                      {{ dataLoadingState.chromeApiReady ? '✅' : '⏳' }}
                      <span class="text-body-2 ms-1">已就绪</span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="4">
            <v-card variant="outlined" class="stat-card-compact" elevation="1">
              <v-card-text class="pa-3">
                <div class="d-flex align-center">
                  <v-avatar color="warning" size="36" class="me-3">
                    <v-icon color="white" size="18">mdi-folder-multiple-plus-outline</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-caption text-medium-emphasis mb-1">建议结构</div>
                    <div class="text-h6 font-weight-bold text-warning d-flex align-center">
                      {{ newProposalTree.children?.length || 0 }}
                      <span class="text-body-2 ms-1">个项目</span>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- 主要对比区域 -->
      <v-container fluid class="comparison-section page-container">
        <v-row class="comparison-row">
          <!-- 左侧面板 -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar color="info" size="24" class="me-2">
                    <v-icon color="white" size="16">mdi-folder-open-outline</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">当前书签目录</div>
                  </div>
                </div>
              </v-card-title>
              <v-divider></v-divider>
              <div class="comparison-content">
                <div v-if="originalTree.length === 0" class="empty-state">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey" class="mb-4">mdi-folder-off</v-icon>
                    <div class="text-h6 mb-2">无书签数据</div>
                    <div class="text-body-2 text-medium-emphasis">
                      Chrome书签API未返回数据
                    </div>
                  </div>
                </div>
                <BookmarkTree
                  v-else
                  :nodes="originalTree"
                  :search-query="searchQuery"
                  :is-sortable="false"
                  :hovered-bookmark-id="hoveredBookmarkId"
                  :is-original="true"
                  :expanded-folders="expandedFolders"
                  @bookmark-hover="handleBookmarkHover"
                  @folder-toggle="handleFolderToggle"
                />
              </div>
            </v-card>
          </v-col>

          <!-- 中间控制面板 -->
          <v-col cols="12" md="2" class="control-col">
            <v-card class="control-card" variant="outlined" elevation="1">
              <v-card-text class="text-center pa-4">
                <div class="control-section mb-4">
                  <v-btn
                    :disabled="true"
                    icon="mdi-arrow-right-bold"
                    variant="tonal"
                    color="primary"
                    size="large"
                    class="control-btn"
                  ></v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">对比</div>
                </div>

                <v-divider class="my-4"></v-divider>

                <div class="control-section mb-4">
                  <v-btn
                    :disabled="newProposalTree.id === 'root-empty'"
                    icon="mdi-refresh"
                    variant="outlined"
                    color="warning"
                    size="large"
                    class="control-btn"
                    @click="clearProposalData"
                  >
                    <v-tooltip location="top" activator="parent">
                      <span>清空右侧面板</span>
                    </v-tooltip>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">清空</div>
                </div>

                <v-divider class="my-4"></v-divider>

                <div class="control-section mb-4">
                  <v-btn
                    :disabled="newProposalTree.id !== 'root-empty'"
                    icon="mdi-content-copy"
                    variant="outlined"
                    color="secondary"
                    size="large"
                    class="control-btn"
                    @click="cloneOriginalToProposal"
                  >
                    <v-tooltip location="top" activator="parent">
                      <span>克隆左侧书签到右侧</span>
                    </v-tooltip>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">克隆</div>
                </div>

                <v-divider class="my-4"></v-divider>

                <div class="control-section">
                  <v-btn
                    :disabled="!isApplyButtonEnabled"
                    icon="mdi-check-circle"
                    variant="flat"
                    color="success"
                    size="large"
                    class="control-btn apply-btn"
                    @click="applyChanges"
                  >
                    <v-tooltip location="top" activator="parent">
                      <span>应用新结构</span>
                    </v-tooltip>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">应用</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- 右侧面板 -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar :color="getProposalPanelColor()" size="24" class="me-2">
                    <v-icon color="white" size="16">{{ getProposalPanelIcon() }}</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">{{ getProposalPanelTitle() }}</div>
                  </div>
                </div>
              </v-card-title>
              <v-divider></v-divider>
              <div class="comparison-content">
                <div v-if="isGenerating" class="generation-state">
                  <div class="text-center py-8">
                    <v-progress-circular
                      :model-value="progressValue"
                      color="primary"
                      size="64"
                      width="6"
                      class="mb-4"
                    >
                      <v-icon size="24">mdi-brain</v-icon>
                    </v-progress-circular>
                    <div class="text-h6 mb-2">AI 正在分析中...</div>
                    <div class="text-body-2 text-medium-emphasis mb-4">
                      正在努力分析您的书签结构
                    </div>
                    <v-progress-linear
                      :model-value="progressValue"
                      color="primary"
                      height="8"
                      rounded
                      class="progress-bar"
                    ></v-progress-linear>
                    <div class="text-caption text-medium-emphasis mt-2">
                      {{ Math.round(progressValue) }}% 完成
                    </div>
                  </div>
                </div>

                <div v-else-if="newProposalTree.id === 'root-empty'" class="empty-state">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey" class="mb-4">mdi-plus-circle-outline</v-icon>
                    <div class="text-h6 mb-2">右侧面板为空</div>
                    <div class="text-body-2 text-medium-emphasis mb-4">
                      请选择数据源来开始编辑
                    </div>
                    <v-row class="justify-center">
                      <v-col cols="6">
                        <v-btn
                          variant="outlined"
                          color="secondary"
                          size="large"
                          block
                          @click="cloneOriginalToProposal"
                          prepend-icon="mdi-content-copy"
                        >
                          克隆现有书签
                        </v-btn>
                      </v-col>
                    </v-row>
                  </div>
                </div>

                <div v-else>
                  <BookmarkTree 
                    :nodes="newProposalTree.children || []"
                    :search-query="searchQuery" 
                    is-proposal 
                    :is-sortable="!searchQuery" 
                    :is-top-level="true"
                    :hovered-bookmark-id="hoveredBookmarkId"
                    :is-original="false"
                    @reorder="handleReorder"
                    @bookmark-hover="handleBookmarkHover"
                    @edit-bookmark="handleEditBookmark"
                    @delete-bookmark="handleDeleteBookmark"
                    @copy-success="handleCopySuccess"
                    @copy-failed="handleCopyFailed"
                    @add-new-item="handleAddNewItem"
                    @delete-folder="handleDeleteFolder"
                  />
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
    
    <!-- 确认对话框 -->
    <v-dialog v-model="isApplyConfirmDialogOpen" max-width="600px" persistent>
      <v-card class="confirmation-dialog" elevation="24">
        <v-card-title class="confirmation-header">
          <div class="d-flex align-center">
            <v-avatar color="warning" size="48" class="me-4">
              <v-icon color="white" size="24">mdi-alert-circle</v-icon>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold mb-1">确认应用新结构</div>
              <div class="text-body-2 text-medium-emphasis">此操作将永久更改您的书签组织方式</div>
            </div>
          </div>
        </v-card-title>

        <v-card-text class="confirmation-content">
          <v-alert
            type="warning"
            variant="tonal"
            class="mb-4"
            prepend-icon="mdi-information"
          >
            <div class="text-body-2">
              <strong>重要提醒：</strong>此操作将完全覆盖您现有的书签栏和"其他书签"目录
            </div>
          </v-alert>

          <div class="confirmation-stats">
            <div class="text-body-2 text-medium-emphasis mb-2">将要应用的新结构包含：</div>
            <v-chip-group>
              <v-chip color="primary" variant="outlined" size="small">
                <v-icon start size="16">mdi-folder-multiple</v-icon>
                {{ confirmationStats.folders }} 个文件夹
              </v-chip>
              <v-chip color="secondary" variant="outlined" size="small">
                <v-icon start size="16">mdi-bookmark-multiple</v-icon>
                {{ confirmationStats.bookmarks }} 个书签
              </v-chip>
            </v-chip-group>
          </div>
        </v-card-text>

        <v-card-actions class="confirmation-actions">
          <v-spacer></v-spacer>
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            @click="isApplyConfirmDialogOpen = false"
            :disabled="isApplyingChanges"
            class="cancel-btn"
          >
            <v-icon start size="18">mdi-close</v-icon>
            取消
          </v-btn>
          <v-btn
            variant="flat"
            color="success"
            @click="confirmApplyChanges"
            :loading="isApplyingChanges"
            :disabled="isApplyingChanges"
            class="confirm-btn"
          >
            <v-icon start size="18">mdi-check-circle</v-icon>
            确认应用
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 通知栏 -->
    <v-snackbar v-model="snackbar" timeout="3000" :color="snackbarColor">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style scoped>
/* 复用原有的样式 */
.app-container {
  user-select: none;
  background-color: #fafafa;
}

.app-bar-style {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 3px 16px rgba(102, 126, 234, 0.2) !important;
}

.app-bar-title {
  flex-grow: 0 !important;
  min-width: 180px;
}

.search-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

.search-input :deep(.v-field__input),
.search-input :deep(.v-field__prepend-inner .v-icon) {
  color: white !important;
}

.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border-radius: 6px;
  padding: 2px;
}

.custom-logo-bg {
  width: 36px;
  height: 36px;
  background: transparent !important;
  border: none !important;
  border-radius: 4px;
  background-image: url('/logo.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: brightness(1.1);
}

.search-input :deep(label) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.search-input :deep(.v-field) {
  background-color: rgba(255, 255, 255, 0.15) !important;
}

.search-mode-toggle {
  border: 1px solid rgba(255, 255, 255, 0.3);
  margin-left: 16px;
}

.search-mode-toggle .v-btn {
  color: white !important;
  background-color: transparent !important;
}

.search-mode-toggle .v-btn.v-btn--active {
  background-color: rgba(255, 255, 255, 0.2) !important;
}

.refresh-btn.v-btn--disabled {
  color: rgba(255, 255, 255, 0.5) !important;
  background-color: rgba(255, 255, 255, 0.05) !important;
}

.main-content {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 64px);
  background-color: #fafafa;
}

.stats-section {
  padding: 12px 0;
  background-color: #ffffff;
  margin-bottom: 4px;
}

.stat-card-compact {
  height: 100%;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
}

.stat-card-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08) !important;
}

.comparison-section {
  padding: 16px 0 16px 0;
  background-color: #fff;
  padding: 0 !important;
}

.comparison-row {
  max-height: calc(100vh - 200px);
}

.comparison-col {
  display: flex;
  flex-direction: column;
}

.comparison-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.comparison-card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  transform: translateY(-1px);
}

.comparison-header-compact {
  background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 16px !important;
  min-height: 56px;
}

.comparison-content {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  padding-bottom: 32px;
}

.comparison-content::-webkit-scrollbar {
  width: 8px;
}

.comparison-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.comparison-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.comparison-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.4);
}

.control-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

.control-card {
  width: 100%;
  max-width: 200px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
}

.control-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.control-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.control-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.apply-btn {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
  color: white !important;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.apply-btn:hover {
  background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%) !important;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.4);
}

.generation-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.progress-bar {
  width: 200px;
  max-width: 80%;
}

.loading-overlay {
  z-index: 9999;
}

.loading-card {
  min-width: 300px;
  max-width: 400px;
}

.loading-text {
  font-size: 18px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.loading-subtitle {
  font-size: 14px;
  color: #666;
  opacity: 0.8;
}

.confirmation-dialog {
  border-radius: 16px;
  overflow: hidden;
}

.confirmation-header {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border-bottom: 1px solid #ffc107;
  padding: 24px !important;
}

.confirmation-content {
  padding: 24px !important;
}

.confirmation-stats {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.confirmation-actions {
  padding: 16px 24px !important;
  border-top: 1px solid #e9ecef;
  background-color: #f8f9fa;
}

.cancel-btn {
  margin-right: 12px;
}

.confirm-btn {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
  color: white !important;
  font-weight: 600;
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
}
</style>