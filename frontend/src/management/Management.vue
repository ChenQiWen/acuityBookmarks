<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue';
import BookmarkTree from './BookmarkTree.vue';

// --- State ---
const searchQuery = ref('');
const searchMode = ref('exact'); // 'exact' or 'ai'
const originalTree = ref<chrome.bookmarks.BookmarkTreeNode[]>([]);
const newProposalTree = ref<ProposalNode>({ id: 'root-empty', title: '等待数据源', children: [] });
const structuresAreDifferent = ref(false);

// 深度比较两个树状结构
function deepCompareTrees(tree1: any[], tree2: any[]): boolean {
  if (!tree1 && !tree2) return true;
  if (!tree1 || !tree2) return false;
  if (tree1.length !== tree2.length) return false;

  for (let i = 0; i < tree1.length; i++) {
    const node1 = tree1[i];
    const node2 = tree2[i];

    // 比较基本属性
    if (node1.title !== node2.title ||
        node1.url !== node2.url ||
        node1.id !== node2.id) {
      return false;
    }

    // 递归比较子节点
    if (node1.children && node2.children) {
      if (!deepCompareTrees(node1.children, node2.children)) {
        return false;
      }
    } else if (node1.children || node2.children) {
      return false; // 一个有子节点，另一个没有
    }
  }

  return true;
}

// 响应式比较系统 - 使用 computed 自动监听树的变化
const isApplyButtonEnabled = computed(() => {
  // 监听 newProposalTree.children 的变化
  const newTree = newProposalTree.value.children;
  const oldTree = originalTree.value;

  if (!newTree || !oldTree) {
    return false;
  }

  // 注意：即使是通过快捷键进入的，如果数据被修改了，也应该激活按钮
  // 这里不应该有特殊的判断，让深度比较函数来决定是否有差异

  const isDifferent = !deepCompareTrees(oldTree, newTree);

  return isDifferent;
});

// 计算确认对话框中的统计数据
const confirmationStats = computed(() => {
  const newTree = newProposalTree.value.children || [];
  return countTreeItems(newTree);
});

// 监听树变化的 Watcher - 确保深层变化被检测到
watch(
  () => newProposalTree.value.children,
  (newChildren, oldChildren) => {
    // computed 会自动重新计算，这里不需要手动调用
  },
  { deep: true }
);

// 计算树状结构中的项目数量
const countTreeItems = (nodes: any[]): { folders: number; bookmarks: number } => {
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
};

// 清空右侧面板数据
const clearProposalData = () => {

  // 清空右侧面板
  newProposalTree.value = {
    id: 'root-empty',
    title: '等待数据源',
    children: []
  };

  // 清空chrome.storage中的数据
  chrome.storage.local.remove(['newProposal'], () => {
  });

  // 显示成功提示
  snackbarText.value = '右侧面板已清空，可以重新选择数据源';
  snackbar.value = true;
};

// 克隆左侧书签到右侧面板
const cloneOriginalToProposal = () => {
  if (!originalTree.value || originalTree.value.length === 0) {
    return;
  }


  // 深克隆原始树结构
  const clonedTree = JSON.parse(JSON.stringify(originalTree.value));

  // 更新右侧面板
  newProposalTree.value = {
    id: 'root-cloned',
    title: '克隆的书签结构',
    children: clonedTree
  };

  // 重新构建映射关系
  if (originalTree.value && newProposalTree.value.children) {
    buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
  }

  // 保存到chrome.storage以便持久化
  chrome.storage.local.set({
    newProposal: convertTreeToLegacyProposal(newProposalTree.value)
  });


  // 显示成功提示
  snackbarText.value = `已成功克隆 ${countTreeItems(clonedTree).folders} 个文件夹和 ${countTreeItems(clonedTree).bookmarks} 个书签`;
  snackbar.value = true;
};

// 获取右侧面板标题
const getProposalPanelTitle = () => {
  if (newProposalTree.value.id === 'root-empty') {
    return '等待数据源';
  } else if (newProposalTree.value.id === 'root-cloned') {
    return '克隆的书签结构';
  } else if (newProposalTree.value.id === 'root-quick') {
    return '快速预览结构';
  } else if (newProposalTree.value.id === 'root-0') {
    return 'AI 建议结构';
  }
  return 'AI 建议结构';
};

// 获取右侧面板副标题
const getProposalPanelSubtitle = () => {
  if (newProposalTree.value.id === 'root-empty') {
    return '请选择数据源：克隆现有书签或生成AI建议';
  } else if (newProposalTree.value.id === 'root-cloned') {
    return '可编辑的书签副本';
  } else if (newProposalTree.value.id === 'root-quick') {
    return '快速加载的结构';
  } else if (newProposalTree.value.id === 'root-0') {
    return '智能重新组织';
  }
  return '智能重新组织';
};

// 获取右侧面板图标
const getProposalPanelIcon = () => {
  if (newProposalTree.value.id === 'root-empty') {
    return 'mdi-plus-circle-outline';
  } else if (newProposalTree.value.id === 'root-cloned') {
    return 'mdi-content-copy';
  } else if (newProposalTree.value.id === 'root-quick') {
    return 'mdi-flash';
  } else if (newProposalTree.value.id === 'root-0') {
    return 'mdi-magic-staff';
  }
  return 'mdi-magic-staff';
};

// 获取右侧面板颜色
const getProposalPanelColor = () => {
  if (newProposalTree.value.id === 'root-empty') {
    return 'grey';
  } else if (newProposalTree.value.id === 'root-cloned') {
    return 'secondary';
  } else if (newProposalTree.value.id === 'root-quick') {
    return 'info';
  } else if (newProposalTree.value.id === 'root-0') {
    return 'primary';
  }
  return 'primary';
};

// 解析URL参数
const parseUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');

  if (mode === 'ai') {
    // 不预设右侧面板状态，等待AI生成完成后自动填充
  } else if (mode === 'manual') {
    // 在数据加载完成后会自动克隆（如果右侧为空）
  }
  return mode;
};

// 显示数据准备完成通知
const showDataReadyNotification = (bookmarkCount: number) => {
  snackbarText.value = `书签数据已准备就绪，共 ${bookmarkCount} 个书签`;
  snackbar.value = true;
  snackbarColor.value = 'success';

  // 3秒后自动隐藏
  setTimeout(() => {
    snackbar.value = false;
  }, 3000);
};

// 从Chrome Storage加载数据（降级方案）
const loadFromChromeStorage = () => {

  chrome.storage.local.get(['originalTree', 'newProposal', 'isGenerating'], (data) => {
    if (data.originalTree) {
      originalTree.value = data.originalTree[0]?.children || [];

      if (!data.newProposal || typeof data.newProposal !== 'object') {
        newProposalTree.value = {
          title: 'root',
          children: [...originalTree.value],
          id: 'root-fallback'
        };
      } else {
        const proposal = convertLegacyProposalToTree(data.newProposal);
        newProposalTree.value = { ...proposal };
      }

      updateComparisonState();

      if (originalTree.value && newProposalTree.value.children) {
        buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
      }

      isGenerating.value = data.isGenerating || false;
    }

    // 设置加载完成状态
    setTimeout(() => {
      isPageLoading.value = false;
      loadingMessage.value = '';
    }, 100);

  });
};

// 本地搜索书签 - 预留功能，未来用于实现本地搜索功能
// @ts-ignore - 预留功能，暂时未使用
const searchBookmarksLocally = async (query: string) => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {

    const response = await chrome.runtime.sendMessage({
      action: 'searchBookmarks',
      query: query.trim(),
      limit: 20
    });

    if (response && response.success) {
      return response.results;
    } else {
      return [];
    }
  } catch (error) {
    return [];
  }
};

// 强制刷新数据，忽略缓存
const forceRefreshData = () => {

  // 显示加载状态
  loadingMessage.value = '正在重新获取书签数据...';
  isPageLoading.value = true;

  // 清除本地数据状态
  chrome.storage.local.set({
    localDataStatus: 'pending'
  });

      // 重新初始化IndexedDB数据
    chrome.runtime.sendMessage({
      action: 'showManagementPage'
    }, (_response) => {
    });
};

// 测试数据同步功能
const testDataSync = () => {

  // 手动修改右侧面板数据进行测试
  if (newProposalTree.value.children && newProposalTree.value.children.length > 0) {
    // 找到第一个没有被测试修改过的项目
    const testIndex = newProposalTree.value.children.findIndex(item =>
      !item.title.includes('(测试修改)')
    );

    if (testIndex >= 0) {
      const originalItem = newProposalTree.value.children[testIndex];

      // 创建一个新的测试项目
      const testItem = {
        ...originalItem,
        title: originalItem.title + ' (测试修改)',
        id: `test-${Date.now()}`
      };

      // 替换项目
      newProposalTree.value.children[testIndex] = testItem;

      // 强制更新以触发响应式
      newProposalTree.value = { ...newProposalTree.value };

    } else {
    }
  } else {
  }
};

const isGenerating = ref(false);
const progressValue = ref(0);
const progressTotal = ref(0);

// 页面加载状态
const isPageLoading = ref(true);
const loadingMessage = ref('正在加载书签数据...');

// 缓存状态
const cacheStatus = ref({
  isFromCache: false,
  lastUpdate: null as number | null,
  dataAge: null as number | null
});
const isApplyConfirmDialogOpen = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');

// --- Bookmark Edit/Delete Dialogs ---
const isEditBookmarkDialogOpen = ref(false);
const isDeleteBookmarkDialogOpen = ref(false);
const isDeleteFolderDialogOpen = ref(false);
const editingBookmark = ref<any>(null);
const deletingBookmark = ref<any>(null);
const deletingFolder = ref<any>(null);
const editTitle = ref('');
const editUrl = ref('');

// --- Add New Item Dialog ---
const isAddNewItemDialogOpen = ref(false);
const addItemType = ref<'folder' | 'bookmark'>('bookmark');
const parentFolder = ref<any>(null);
const newItemTitle = ref('');
const newItemUrl = ref('');
const isDuplicateDialogOpen = ref(false);
const duplicateInfo = ref<any>(null);
const addForm = ref<any>(null);
const isCancelConfirmDialogOpen = ref(false);

// --- Loading States ---
const isAddingItem = ref(false);
const isEditingBookmark = ref(false);
const isDeletingBookmark = ref(false);
const isDeletingFolder = ref(false);
const isApplyingChanges = ref(false);

// --- Bookmark Hover Mapping ---
const hoveredBookmarkId = ref<string | null>(null);
const bookmarkMapping = ref<Map<string, any>>(new Map());
const expandedFolders = ref<Set<string>>(new Set());

// Generate unique ID for each bookmark instance
const generateBookmarkId = (node: any): string => {
  if (!node || !node.url) return '';

  // Create truly unique ID by including node ID and other properties
  const identifier = `${node.id || 'no-id'}|${node.url}|${node.title || ''}|${node.dateAdded || ''}`;
  try {
    // Encode the string to handle Unicode characters
    const encoded = encodeURIComponent(identifier);
    return btoa(encoded).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  } catch (error) {
    // Fallback: use a simple hash if encoding fails
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }
};

// Build mapping between original and proposed bookmarks
const buildBookmarkMapping = (originalTree: any[], proposedTree: any[]) => {
  bookmarkMapping.value.clear();

  // Helper function to assign unique IDs and build mapping
  const processBookmarks = (nodes: any[], isOriginal: boolean = true) => {
    for (const node of nodes) {
      if (node.url) {
        // This is a bookmark - assign unique ID
        const bookmarkId = generateBookmarkId(node);
        node.uniqueId = bookmarkId; // Add unique ID to node


        // Build mapping - use bookmarkId as key for mapping
        if (!bookmarkMapping.value.has(bookmarkId)) {
          bookmarkMapping.value.set(bookmarkId, {
            original: isOriginal ? node : null,
            proposed: !isOriginal ? node : null
          });
        } else {
          const existing = bookmarkMapping.value.get(bookmarkId);
          if (isOriginal) {
            existing.original = node;
          } else {
            existing.proposed = node;
          }
        }
      } else if (node.children) {
        // This is a folder, traverse children
        processBookmarks(node.children, isOriginal);
      }
    }
  };

  if (originalTree) processBookmarks(originalTree, true);
  if (proposedTree) processBookmarks(proposedTree, false);

};

// Handle folder toggle (user manual operation)
const handleFolderToggle = (data: { nodeId: string; expanded: boolean }) => {
  // For user manual operations, we don't interfere with other folders
  // Just let the folder maintain its own state
};

// 防抖hover处理，避免频繁触发
let hoverTimeout: number | null = null;

// Handle bookmark hover
const handleBookmarkHover = (bookmarkId: string | null) => {
  // 清除之前的定时器
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }

  // 防抖处理：延迟150ms执行，避免hover过于频繁
  hoverTimeout = window.setTimeout(() => {
    // 只有当bookmarkId真正改变时才更新
    if (hoveredBookmarkId.value !== bookmarkId) {
      hoveredBookmarkId.value = bookmarkId;

      if (bookmarkId && bookmarkMapping.value.has(bookmarkId)) {
        const mapping = bookmarkMapping.value.get(bookmarkId);

        // 如果hover的是建议书签，展开对应原始书签的文件夹路径
        if (mapping.proposed && mapping.original) {

          // Clear all expanded folders first (exclusive behavior)
          expandedFolders.value.clear();

          // Find the folder path for the original bookmark and expand it
          expandFolderPath(originalTree.value, mapping.original);

          // Wait for Vue to render the expanded folders, then scroll
          nextTick(() => {
            // Additional delay to ensure folder contents are fully rendered
            setTimeout(() => {
              const element = document.querySelector(`[data-bookmark-id="${mapping.original.uniqueId}"]`);
              if (element) {
                scrollToBookmark(element);
              } else {
                // Try again after another delay
                setTimeout(() => {
                  const retryElement = document.querySelector(`[data-bookmark-id="${mapping.original.uniqueId}"]`);
                  if (retryElement) {
                    scrollToBookmark(retryElement);
                  } else {
                  }
                }, 100);
              }
            }, 50); // Small delay to ensure rendering
          });
        }
      } else {
        // Clear auto-expanded folders when not hovering
        expandedFolders.value.clear();
      }
    } else {
    }
  }, 150); // 150ms防抖延迟
};

// Find and expand the folder path containing the target bookmark
const expandFolderPath = (nodes: any[], targetNode: any) => {

  // Clear all expanded folders first (exclusive behavior for auto-expansion)
  expandedFolders.value.clear();
  // Force reactivity update after clearing
  expandedFolders.value = new Set(expandedFolders.value);

  let found = false;
  for (const node of nodes) {
    if (node.children && !found) {
      // Check if target node is in this folder's children
      if (findNodeInChildren(node.children, targetNode)) {
        // Expand this folder
        expandedFolders.value.add(node.id);

        // Force reactivity update
        expandedFolders.value = new Set(expandedFolders.value);

        // Continue searching deeper
        expandFolderPathRecursive(node.children, targetNode);
        found = true;
        break;
      }
    }
  }

};

// Recursive helper to expand the complete path
const expandFolderPathRecursive = (nodes: any[], targetNode: any) => {
  for (const node of nodes) {
    if (node.children) {
      if (findNodeInChildren(node.children, targetNode)) {
        expandedFolders.value.add(node.id);

        // Force reactivity update for recursive additions too
        expandedFolders.value = new Set(expandedFolders.value);

        expandFolderPathRecursive(node.children, targetNode);
        break;
      }
    }
  }
};

// Helper function to find if target node exists in children
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

// Scroll element into view with centering
const scrollToBookmark = (element: Element) => {
  if (!element) return;

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center', // Center the element in viewport
    inline: 'nearest'
  });
};

// --- Type Definitions ---
interface ProposalNode {
  id: string;
  title: string;
  url?: string;
  children?: ProposalNode[];
  dateAdded?: number;
  index?: number;
}



// --- Comparison Logic ---
function getComparable(nodes: ProposalNode[]): any[] {
  if (!nodes || nodes.length === 0) return [];
  return nodes.map(node => {
    const newNode: any = {
      title: node.title,
      id: node.id,
      url: node.url || null
    };

    // 递归处理子节点
    if (node.children && node.children.length > 0) {
      newNode.children = getComparable(node.children);
    }

    return newNode;
  }).sort((a, b) => {
    // 按ID排序，确保比较的一致性
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

function updateComparisonState(): void {
  const originalComparable = getComparable(originalTree.value);
  const proposalComparable = getComparable(newProposalTree.value.children ?? []);
  const originalJson = JSON.stringify(originalComparable);
  const proposalJson = JSON.stringify(proposalComparable);
  structuresAreDifferent.value = originalJson !== proposalJson;

  // 添加详细调试信息

  // 如果是通过快捷键进入的（ID为root-shortcut），则默认认为结构相同
  if (newProposalTree.value.id === 'root-shortcut') {
    structuresAreDifferent.value = false;
  }

  if (structuresAreDifferent.value) {
  } else {
  }
}

// --- Lifecycle & Event Listeners ---
onMounted(() => {

  // 解析URL参数，确定进入模式
  const urlMode = parseUrlParams();

  // 根据模式设置初始化行为
  if (urlMode === 'manual') {
  } else if (urlMode === 'ai') {
  }

  // 显示初始加载状态
  loadingMessage.value = '正在检查本地数据...';

  // 页面已加载，直接请求数据准备，不触发页面重新打开
  chrome.runtime.sendMessage({
    action: 'prepareManagementData'
  }, (_response) => {
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'aiOrganizeStarted') {
      snackbarText.value = 'AI正在分析您的书签结构，请稍候...';
      snackbar.value = true;
      snackbarColor.value = 'info';
    } else if (request.action === 'aiOrganizeComplete') {
      snackbarText.value = 'AI建议结构已生成，请在右侧面板查看和调整';
      snackbar.value = true;
      snackbarColor.value = 'success';
    } else if (request.action === 'applyComplete') {
      snackbarText.value = '新书签结构已成功应用！';
      snackbar.value = true;
      chrome.bookmarks.getTree(tree => {
        originalTree.value = JSON.parse(JSON.stringify(tree[0]?.children || []));
        updateComparisonState();
      });
    } else if (request.action === 'dataReady') {

      // 更新缓存状态
      cacheStatus.value.isFromCache = request.fromCache || false;

      // 处理本地数据状态
      if (request.localData) {

        if (request.localData.status === 'cached' || request.localData.status === 'recovered') {
          // 使用IndexedDB缓存数据，快速加载

          const quickLoadStart = performance.now();

          // 直接从IndexedDB获取数据
          chrome.runtime.sendMessage({
            action: 'getIndexedDBBookmarks'
          }, (response) => {
            if (response && response.success) {

              // 直接使用IndexedDB数据
              originalTree.value = response.data[0]?.children || [];

              // 从chrome.storage获取newProposal和isGenerating
              chrome.storage.local.get(['newProposal', 'isGenerating'], (storageData) => {
                if (!storageData.newProposal) {
                  // 没有存储的数据，右侧面板为空，等待用户选择数据源
                  newProposalTree.value = {
                    title: 'root',
                    children: [],
                    id: 'root-empty'
                  };
                } else {
                  // 有存储的数据，可能是AI生成或克隆的数据
                  if (storageData.newProposal && typeof storageData.newProposal === 'object') {
                    const proposal = convertLegacyProposalToTree(storageData.newProposal);
                    newProposalTree.value = { ...proposal };
                  } else {
                    newProposalTree.value = {
                      title: 'root',
                      children: [],
                      id: 'root-empty'
                    };
                  }
                }

                updateComparisonState();

                if (originalTree.value && newProposalTree.value.children && newProposalTree.value.children.length > 0) {
                  buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
                }

                isGenerating.value = storageData.isGenerating || false;

                const quickLoadTime = performance.now() - quickLoadStart;

                // 立即设置加载完成状态
                isPageLoading.value = false;
                loadingMessage.value = '';

                cacheStatus.value.lastUpdate = request.localData.lastUpdate;
                cacheStatus.value.dataAge = Date.now() - request.localData.lastUpdate;

                // 根据URL模式执行自动操作
                const urlMode = parseUrlParams();
                if (urlMode === 'manual' && newProposalTree.value.id === 'root-empty') {
                  // 延迟一点时间，让UI先渲染完成
                  setTimeout(() => {
                    cloneOriginalToProposal();
                  }, 500);
                }

                // 显示数据准备完成通知
                showDataReadyNotification(request.localData.bookmarkCount);
              });

            } else {
              // 降级到传统方式
              loadFromChromeStorage();
            }
          });

                      return; // 不继续执行下面的逻辑

          } else if (request.localData.status === 'processed') {
            // 数据刚处理完成
            cacheStatus.value.lastUpdate = request.localData.lastUpdate;

            // 显示数据准备完成通知
            showDataReadyNotification(request.localData.bookmarkCount);

          } else if (request.localData.status === 'fallback') {
            // 降级到基础模式
            cacheStatus.value.isFromCache = false;
          }
      }

      // 重新加载数据（兼容现有逻辑）
      chrome.storage.local.get(['originalTree', 'newProposal', 'isGenerating'], (data) => {
        if (data.originalTree) {
          originalTree.value = data.originalTree[0]?.children || [];
          if (data.newProposal && typeof data.newProposal === 'object') {
            const proposal = convertLegacyProposalToTree(data.newProposal);
            newProposalTree.value = { ...proposal };
          } else {
            newProposalTree.value = {
              title: 'root',
              children: [],
              id: 'root-empty'
            };
          }
          updateComparisonState();

          if (originalTree.value && newProposalTree.value.children) {
            buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
          }
        }
        isGenerating.value = data.isGenerating || false;

        // 更新加载状态
        setTimeout(() => {
          isPageLoading.value = false;
          loadingMessage.value = '';
        }, 100);

      });
    } else if (request.action === 'dataRefreshed') {

      // 更新缓存状态
      cacheStatus.value.isFromCache = false;

      // 重新加载数据
      chrome.storage.local.get(['originalTree', 'newProposal', 'isGenerating', 'cacheInfo'], (data) => {
        if (data.originalTree) {
          originalTree.value = data.originalTree[0]?.children || [];
          if (data.newProposal && typeof data.newProposal === 'object') {
            const proposal = convertLegacyProposalToTree(data.newProposal);
            newProposalTree.value = { ...proposal };
          } else {
            newProposalTree.value = {
              title: 'root',
              children: [],
              id: 'root-empty'
            };
          }
          updateComparisonState();

          if (originalTree.value && newProposalTree.value.children) {
            buildBookmarkMapping(originalTree.value, newProposalTree.value.children);
          }

          // 更新缓存信息
          if (data.cacheInfo) {
            cacheStatus.value.lastUpdate = data.cacheInfo.lastUpdate;
            cacheStatus.value.dataAge = null; // 强制刷新后数据是新的
          }
        }
        isGenerating.value = data.isGenerating || false;

        // 显示强制刷新成功的提示
        snackbarText.value = '数据已强制刷新并更新';
        snackbar.value = true;
        snackbarColor.value = 'success';

      });
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.isGenerating) isGenerating.value = changes.isGenerating.newValue;
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
      updateComparisonState();
    }
  });
});

// --- Methods ---
const refresh = () => chrome.runtime.sendMessage({ action: 'startRestructure' });
const applyChanges = () => isApplyConfirmDialogOpen.value = true;
const confirmApplyChanges = async (): Promise<void> => {
  isApplyingChanges.value = true;

  try {
    // 模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'applyChanges', proposal: newProposalTree.value }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });

    // 同步更新左侧目录结构
    await new Promise((resolve) => {
      chrome.bookmarks.getTree(tree => {
        originalTree.value = JSON.parse(JSON.stringify(tree[0]?.children || []));

        // 更新右侧面板为新的原始数据副本
        newProposalTree.value = {
          title: 'root',
          children: JSON.parse(JSON.stringify(originalTree.value)),
          id: 'root-updated'
        };

        // 重新构建书签映射关系，避免hover死循环
        buildBookmarkMapping(originalTree.value, newProposalTree.value.children || []);

        // 重置hover状态，避免残留的高亮
        hoveredBookmarkId.value = null;
        expandedFolders.value.clear();

        resolve(undefined);
      });
    });

  isApplyConfirmDialogOpen.value = false;
  } catch (error) {
    snackbarText.value = '应用更改失败，请重试';
    snackbar.value = true;
  } finally {
    isApplyingChanges.value = false;
  }
};
const handleReorder = (): void => {

  // 强制触发响应式更新，让Vue检测到数组内部的变化
  const currentChildren = newProposalTree.value.children ? [...newProposalTree.value.children] : [];

  // 创建一个新的对象来确保Vue检测到变化
  newProposalTree.value = {
    ...newProposalTree.value,
    children: currentChildren
    // 注意：不能添加未知属性，否则会报TypeScript错误
  };


  // 强制重新计算比较结果
  nextTick(() => {
    // 强制触发计算属性的重新计算
    const forceUpdate = isApplyButtonEnabled.value;

    // 再次检查比较结果，确保检测到变化
    setTimeout(() => {
      const doubleCheck = isApplyButtonEnabled.value;
    }, 100);
  });
};

// --- Bookmark Operations ---
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

// 从书签树中移除项目的辅助函数
const removeBookmarkFromTree = (tree: any[], bookmarkId: string): boolean => {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    if (node.id === bookmarkId) {
      tree.splice(i, 1);
      return true;
    }
    if (node.children && removeBookmarkFromTree(node.children, bookmarkId)) {
      return true;
    }
  }
  return false;
};

const confirmDeleteBookmark = async () => {
  if (!deletingBookmark.value) return;

  isDeletingBookmark.value = true;

  try {
    // 模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 600));

    await new Promise((resolve, reject) => {
      chrome.bookmarks.remove(deletingBookmark.value.id, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(undefined);
        }
      });
    });

    // 从本地数据中移除项目，而不是刷新整个树
    removeBookmarkFromTree(originalTree.value, deletingBookmark.value.id);

    snackbarText.value = `已删除书签: ${deletingBookmark.value.title}`;
    snackbar.value = true;

    // 响应式系统会自动检测变化并更新按钮状态
    isDeleteBookmarkDialogOpen.value = false;
    deletingBookmark.value = null;
  } catch (error) {
    snackbarText.value = '删除书签失败，请重试';
    snackbar.value = true;
  } finally {
    isDeletingBookmark.value = false;
  }
};

const confirmDeleteFolder = async () => {
  if (!deletingFolder.value) return;

  isDeletingFolder.value = true;

  try {
    // 模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 600));

    await new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(deletingFolder.value.id, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(undefined);
        }
      });
    });

    // 从本地数据中移除文件夹
    removeBookmarkFromTree(originalTree.value, deletingFolder.value.id);

    snackbarText.value = `已删除文件夹: ${deletingFolder.value.title}`;
    snackbar.value = true;

    // 响应式系统会自动检测变化并更新按钮状态
    isDeleteFolderDialogOpen.value = false;
    deletingFolder.value = null;
  } catch (error) {
    snackbarText.value = '删除文件夹失败，请重试';
    snackbar.value = true;
  } finally {
    isDeletingFolder.value = false;
  }
};

// 在书签树中更新项目的辅助函数
const updateBookmarkInTree = (tree: any[], bookmarkId: string, updates: any): boolean => {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    if (node.id === bookmarkId) {
      Object.assign(node, updates);
      return true;
    }
    if (node.children && updateBookmarkInTree(node.children, bookmarkId, updates)) {
      return true;
    }
  }
  return false;
};

const saveEditedBookmark = async () => {
  if (!editingBookmark.value || !editTitle.value.trim()) return;

  isEditingBookmark.value = true;

  try {
    // 模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 600));

    const updates = {
      title: editTitle.value.trim(),
      url: editUrl.value.trim() || undefined
    };

    await new Promise((resolve, reject) => {
      chrome.bookmarks.update(editingBookmark.value.id, updates, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(undefined);
        }
      });
    });

    // 直接更新本地数据
    updateBookmarkInTree(originalTree.value, editingBookmark.value.id, updates);

    snackbarText.value = '书签已更新';
    snackbar.value = true;

    // 响应式系统会自动检测变化并更新按钮状态
    isEditBookmarkDialogOpen.value = false;
    editingBookmark.value = null;
    editTitle.value = '';
    editUrl.value = '';
  } catch (error) {
    snackbarText.value = '更新书签失败，请重试';
    snackbar.value = true;
  } finally {
    isEditingBookmark.value = false;
  }
};

const handleCopySuccess = () => {
  snackbarText.value = '链接已复制到剪贴板';
  snackbar.value = true;
};

const handleCopyFailed = () => {
  snackbarText.value = '复制链接失败，请重试';
  snackbar.value = true;
};

// --- Add New Item Functions ---
const handleAddNewItem = (parentNode: any) => {
  parentFolder.value = parentNode;
  addItemType.value = 'bookmark';
  newItemTitle.value = '';
  newItemUrl.value = '';
  isAddNewItemDialogOpen.value = true;
};

// 监听tab切换，重置表单验证状态
watch(addItemType, () => {
  // 重置表单验证状态
  newItemTitle.value = '';
  newItemUrl.value = '';
  // 重置表单验证
  addForm.value?.resetValidation();
});

// 监听输入变化，实时验证
let validationTimeout: number | null = null;

watch([newItemTitle, newItemUrl], () => {
  // 清除之前的定时器
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }

  // 设置新的定时器，在输入停止500ms后触发验证
  validationTimeout = window.setTimeout(() => {
    if (addForm.value) {
      addForm.value.validate();
    }
  }, 500);
});

// 组件卸载时清理定时器
onUnmounted(() => {
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }
  // 清理hover定时器
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
});

const checkForDuplicates = (title: string, url: string, type: 'folder' | 'bookmark'): any => {
  const parentChildren = parentFolder.value?.children || [];

  // 检查同级目录是否有相同名称
  const nameDuplicates = parentChildren.filter((child: any) =>
    child.title === title && ((type === 'folder' && child.children) || (type === 'bookmark' && !child.children))
  );

  if (nameDuplicates.length > 0) {
    return {
      type: 'name',
      duplicates: nameDuplicates,
      message: `同级目录中已存在名称 "${title}" 的${type === 'folder' ? '文件夹' : '书签'}`
    };
  }

  // 如果是书签，检查整个书签树是否有相同URL
  if (type === 'bookmark' && url) {
    const urlDuplicates = findUrlDuplicates(originalTree.value, url, parentFolder.value.id);
    if (urlDuplicates.length > 0) {
      return {
        type: 'url',
        duplicates: urlDuplicates,
        message: `整个书签目录中已存在URL "${url}" 的书签`
      };
    }
  }

  return null;
};

const findUrlDuplicates = (tree: any[], url: string, excludeParentId: string): any[] => {
  const duplicates: any[] = [];

  const traverseTree = (nodes: any[], path: string[] = []) => {
    for (const node of nodes) {
      if (node.children) {
        // 是文件夹
        traverseTree(node.children, [...path, node.title]);
      } else if (node.url === url && node.id !== excludeParentId) {
        // 是书签且URL匹配
        duplicates.push({
          ...node,
          path: path.join(' / ')
        });
      }
    }
  };

  traverseTree(tree);
  return duplicates;
};

const confirmAddItem = async () => {
  // 使用Vuetify表单验证
  const { valid } = await addForm.value?.validate() || { valid: false };

  if (!valid) {
    return; // 表单验证失败，停止执行
  }

  const title = newItemTitle.value.trim();
  const url = newItemUrl.value.trim();

  // 设置loading状态
  isAddingItem.value = true;

  try {
    // 检查重复
    const duplicateCheck = checkForDuplicates(title, url, addItemType.value);
    if (duplicateCheck) {
      duplicateInfo.value = duplicateCheck;
      isDuplicateDialogOpen.value = true;
      return;
    }

    // 没有重复，直接添加
    await addItemToTree();
  } finally {
    isAddingItem.value = false;
  }
};

const handleCancelAdd = () => {
  // 检查是否有输入内容
  const hasContent = newItemTitle.value.trim() || newItemUrl.value.trim();

  if (hasContent) {
    // 有内容时显示确认对话框
    isCancelConfirmDialogOpen.value = true;
  } else {
    // 没有内容直接关闭
    closeAddDialog();
  }
};

const confirmCancelAdd = () => {
  isCancelConfirmDialogOpen.value = false;
  closeAddDialog();
};

const handleAddDialogClose = (value: boolean) => {
  // 如果对话框被关闭（通过ESC或点击外部）
  if (!value) {
    // 检查是否有输入内容
    const hasContent = newItemTitle.value.trim() || newItemUrl.value.trim();

    if (hasContent && !isAddingItem.value) {
      // 有内容且不在loading状态时，阻止关闭并显示确认对话框
      isAddNewItemDialogOpen.value = true;
      isCancelConfirmDialogOpen.value = true;
    } else if (!hasContent) {
      // 没有内容直接关闭
      closeAddDialog();
    }
  }
};

const closeAddDialog = () => {
  isAddNewItemDialogOpen.value = false;
  // 重置表单
  newItemTitle.value = '';
  newItemUrl.value = '';
  addItemType.value = 'bookmark';
  parentFolder.value = null;
  // 重置表单验证
  addForm.value?.resetValidation();
};

const addItemToTree = async () => {
  const title = newItemTitle.value.trim();
  const url = newItemUrl.value.trim();

  if (!parentFolder.value || !title) return;

  // 模拟网络请求延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  const newItem: any = {
    id: `new-${addItemType.value}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: title,
    dateAdded: Date.now(),
    index: 0 // 新项目放在最顶部
  };

  if (addItemType.value === 'bookmark') {
    newItem.url = url;
  } else {
    newItem.children = [];
  }

  // 添加到父文件夹的最顶部
  if (!parentFolder.value.children) {
    parentFolder.value.children = [];
  }
  parentFolder.value.children.unshift(newItem); // 使用unshift添加到数组开头

  // 响应式系统会自动检测变化并更新按钮状态

  // 关闭对话框并显示成功消息
  closeAddDialog();
  snackbarText.value = `已添加${addItemType.value === 'folder' ? '文件夹' : '书签'}: ${title}`;
  snackbar.value = true;
};

const confirmAddDuplicate = () => {
  isDuplicateDialogOpen.value = false;
  addItemToTree();
};

function convertLegacyProposalToTree(proposal: Record<string, any>): ProposalNode {
  const root: ProposalNode = { title: 'root', children: [], id: 'root-0' };

  // 验证参数是否有效
  if (!proposal || typeof proposal !== 'object') {
    return root; // 返回空根节点
  }

  const findOrCreateNode = (path: string[]): ProposalNode => {
    let current = root;
    path.forEach(part => {
      let node = current.children?.find(child => child.title === part && child.children);
      if (!node) {
        node = { title: part, children: [], id: `folder-${Date.now()}-${Math.random()}` };
        current.children = current.children || [];
        current.children.push(node);
      }
      current = node;
    });
    return current;
  };

  // 安全地检查书签栏
  if (proposal['书签栏'] && typeof proposal['书签栏'] === 'object') {
    for (const categoryPath in proposal['书签栏']) {
      const pathParts = categoryPath.split(' / ');
      const leafNode = findOrCreateNode(['书签栏', ...pathParts]);
      const bookmarks = proposal['书签栏'][categoryPath];
      if (Array.isArray(bookmarks)) {
        leafNode.children?.push(...bookmarks);
      }
    }
  }
  // 安全地检查其他书签
  if (proposal['其他书签'] && Array.isArray(proposal['其他书签'])) {
    const otherBookmarksNode = findOrCreateNode(['其他书签']);
    otherBookmarksNode.children = proposal['其他书签'];
  }
  return root;
}

// 将树状结构转换为legacy proposal格式
function convertTreeToLegacyProposal(tree: ProposalNode): Record<string, any> {
  const proposal: Record<string, any> = {};

  // 验证参数是否有效
  if (!tree || typeof tree !== 'object' || !tree.children) {
    return proposal; // 返回空对象
  }

  const traverse = (nodes: any[], path: string[] = []) => {
    nodes.forEach(node => {
      if (node.children) {
        // 这是文件夹，继续遍历
        traverse(node.children, [...path, node.title]);
      } else {
        // 这是书签
        const currentPath = path.join(' / ');
        if (!proposal[currentPath]) {
          proposal[currentPath] = [];
        }
        proposal[currentPath].push({
          id: node.id,
          title: node.title,
          url: node.url
        });
      }
    });
  };

  if (tree.children) {
    traverse(tree.children);
  }

  return proposal;
}
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
        <div class="app-bar-title">AcuityBookmarks</div>
      </v-app-bar-title>
      <div class="search-container">
        <v-text-field
          v-model="searchQuery"
          density="compact" variant="solo" class="search-input"
          bg-color="transparent" flat hide-details
          label="搜索..." prepend-inner-icon="mdi-magnify"
        ></v-text-field>
      </div>
      <v-btn-toggle v-model="searchMode" mandatory density="compact" variant="outlined" class="search-mode-toggle">
        <v-btn value="exact" size="small">精准</v-btn>
        <v-btn value="ai" size="small">AI</v-btn>
      </v-btn-toggle>
      <v-spacer></v-spacer>
      <v-btn @click="refresh" :disabled="isGenerating" prepend-icon="mdi-refresh" variant="tonal" class="refresh-btn">重新生成</v-btn>

      <v-btn @click="forceRefreshData" prepend-icon="mdi-cloud-refresh" variant="text" size="small" class="ml-1">
        刷新数据
        <v-tooltip activator="parent" location="bottom">
          强制重新获取书签数据，忽略缓存
        </v-tooltip>
      </v-btn>

      <!-- 本地数据状态指示器 -->
      <v-chip
        v-if="!isPageLoading"
        size="small"
        :color="cacheStatus.isFromCache ? 'success' : 'primary'"
        variant="outlined"
        class="ml-2"
      >
        <v-icon size="small" class="mr-1">
          {{ cacheStatus.isFromCache ? 'mdi-database' : 'mdi-database-refresh' }}
        </v-icon>
        {{ cacheStatus.isFromCache ? '本地' : '处理中' }}
        <v-tooltip activator="parent" location="bottom">
          <span v-if="cacheStatus.isFromCache && cacheStatus.dataAge">
            本地数据，更新于{{ (cacheStatus.dataAge / 1000).toFixed(1) }}秒前
          </span>
          <span v-else-if="cacheStatus.isFromCache">
            使用本地IndexedDB数据
          </span>
          <span v-else>
            数据正在处理中
          </span>
        </v-tooltip>
      </v-chip>

      <v-btn @click="applyChanges" :disabled="!isApplyButtonEnabled" color="white" prepend-icon="mdi-check">
        应用新结构
        <v-chip v-if="isApplyButtonEnabled" size="x-small" color="warning" variant="flat" class="ml-2">有更改</v-chip>
      </v-btn>

      <!-- 临时测试按钮 -->
      <v-btn @click="updateComparisonState" variant="outlined" size="small" class="ml-2">
        🔄 刷新比较
      </v-btn>
      <v-btn @click="testDataSync" variant="outlined" size="small" class="ml-1">
        🧪 测试数据
      </v-btn>
    </v-app-bar>

    <v-main class="main-content">
      <!-- Statistics Cards -->
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
                    <div class="text-caption text-medium-emphasis mb-1">可优化书签</div>
                    <div class="text-h6 font-weight-bold text-primary d-flex align-center">
                      {{ originalTree.length }}
                      <span class="text-body-2 ms-1">个</span>
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
                    <div class="text-caption text-medium-emphasis mb-1">节省时间</div>
                    <div class="text-h6 font-weight-bold text-success d-flex align-center">
                      ~{{ Math.round(originalTree.length * 0.5) }}
                      <span class="text-body-2 ms-1">分钟</span>
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
                    <div class="text-caption text-medium-emphasis mb-1">建议文件夹</div>
                    <div class="text-h6 font-weight-bold text-warning d-flex align-center">
                      {{ newProposalTree.children?.length || 0 }}
                      <span class="text-body-2 ms-1">个</span>
            </div>
          </div>
                </div>
              </v-card-text>
        </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- Main Comparison Section -->
      <v-container fluid class="comparison-section page-container">
        <v-row class="comparison-row">
          <!-- Current Structure Panel -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar color="info" size="24" class="me-2">
                    <v-icon color="white" size="16">mdi-folder-open-outline</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">当前结构</div>
                    <div class="text-caption text-medium-emphasis">原始书签组织方式</div>
      </div>
                </div>
              </v-card-title>

            <v-divider></v-divider>

              <div class="comparison-content">
                <BookmarkTree
                  :nodes="originalTree"
                  :search-query="searchQuery"
                  :is-sortable="true"
                  :hovered-bookmark-id="hoveredBookmarkId"
                  :is-original="true"
                  :expanded-folders="expandedFolders"
                  @bookmark-hover="handleBookmarkHover"
                  @scroll-to-bookmark="scrollToBookmark"
                  @folder-toggle="handleFolderToggle"
                  @edit-bookmark="handleEditBookmark"
                  @delete-bookmark="handleDeleteBookmark"
                  @copy-success="handleCopySuccess"
                  @copy-failed="handleCopyFailed"
                  @add-new-item="handleAddNewItem"
                  @delete-folder="handleDeleteFolder"
                />
              </div>
          </v-card>
          </v-col>

          <!-- Control Panel -->
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
                      <div class="text-caption mt-1">重新选择数据源</div>
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
                      <div class="text-caption mt-1">用于手动编辑</div>
                      <div v-if="newProposalTree.id !== 'root-empty'" class="text-error mt-1">
                        右侧已有数据，请先清空
                      </div>
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
                      <div v-if="isApplyButtonEnabled" class="mt-1">
                        <v-chip size="x-small" color="warning" variant="flat">检测到更改</v-chip>
                      </div>
                    </v-tooltip>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">应用</div>
        </div>

                <div v-if="isApplyButtonEnabled" class="diff-indicator mt-4">
                  <v-chip color="warning" size="small" variant="outlined">
                    <v-icon start size="16">mdi-alert-circle</v-icon>
                    有更改
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Proposed Structure Panel -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar :color="getProposalPanelColor()" size="24" class="me-2">
                    <v-icon color="white" size="16">{{ getProposalPanelIcon() }}</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">{{ getProposalPanelTitle() }}</div>
                    <div class="text-caption text-medium-emphasis">{{ getProposalPanelSubtitle() }}</div>
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
                    @scroll-to-bookmark="scrollToBookmark"
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
    
    <!-- Modern Confirmation Dialog -->
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

          <div class="warning-list">
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3">mdi-close-circle</v-icon>
              <span class="text-body-2">原有的文件夹结构将被删除</span>
            </div>
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3">mdi-close-circle</v-icon>
              <span class="text-body-2">书签将被重新组织到新结构中</span>
            </div>
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3">mdi-close-circle</v-icon>
              <span class="text-body-2">此操作不可撤销</span>
            </div>
          </div>

          <v-divider class="my-4"></v-divider>

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

    <!-- Edit Bookmark Dialog -->
    <v-dialog v-model="isEditBookmarkDialogOpen" max-width="500px">
      <v-card class="edit-dialog">
        <v-card-title class="edit-header">
          <v-icon start size="24" color="primary">mdi-pencil</v-icon>
          编辑书签
        </v-card-title>
        <v-card-text class="edit-content">
          <v-form @submit.prevent="saveEditedBookmark">
            <v-text-field
              v-model="editTitle"
              label="书签标题"
              variant="outlined"
              density="comfortable"
              class="mb-4"
              autofocus
            ></v-text-field>
            <v-text-field
              v-model="editUrl"
              label="书签链接"
              variant="outlined"
              density="comfortable"
              type="url"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions class="edit-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isEditBookmarkDialogOpen = false" :disabled="isEditingBookmark">取消</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            @click="saveEditedBookmark"
            :loading="isEditingBookmark"
            :disabled="isEditingBookmark"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Bookmark Dialog -->
    <v-dialog v-model="isDeleteBookmarkDialogOpen" max-width="400px" persistent>
      <v-card class="delete-dialog">
        <v-card-title class="delete-header">
          <v-icon start size="24" color="error">mdi-alert-circle</v-icon>
          确认删除
        </v-card-title>
        <v-card-text class="delete-content">
          <div class="text-body-1 mb-2">
            确定要删除书签 "<strong>{{ deletingBookmark?.title }}</strong>" 吗？
        </div>
          <div class="text-body-2 text-medium-emphasis">
            此操作无法撤销。
      </div>
        </v-card-text>
        <v-card-actions class="delete-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isDeleteBookmarkDialogOpen = false" :disabled="isDeletingBookmark">取消</v-btn>
          <v-btn
            color="error"
            variant="flat"
            @click="confirmDeleteBookmark"
            :loading="isDeletingBookmark"
            :disabled="isDeletingBookmark"
          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Folder Dialog -->
    <v-dialog v-model="isDeleteFolderDialogOpen" max-width="400px" persistent>
      <v-card class="delete-dialog">
        <v-card-title class="delete-header">
          <v-icon start size="24" color="error">mdi-folder-remove</v-icon>
          确认删除文件夹
        </v-card-title>
        <v-card-text class="delete-content">
          <div class="text-body-1 mb-2">
            确定要删除文件夹 "<strong>{{ deletingFolder?.title }}</strong>" 吗？
          </div>
          <div class="text-body-2 text-medium-emphasis">
            此操作将删除文件夹及其包含的所有书签，此操作无法撤销。
          </div>
        </v-card-text>
        <v-card-actions class="delete-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isDeleteFolderDialogOpen = false" :disabled="isDeletingFolder">取消</v-btn>
          <v-btn
            color="error"
            variant="flat"
            @click="confirmDeleteFolder"
            :loading="isDeletingFolder"
            :disabled="isDeletingFolder"
          >
            删除文件夹
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add New Item Dialog -->
    <v-dialog
      v-model="isAddNewItemDialogOpen"
      max-width="500px"
      @update:model-value="handleAddDialogClose"
    >
      <v-card class="add-dialog">
        <v-card-text class="add-content" style="padding: 24px;">
          <v-tabs v-model="addItemType" grow class="mb-4">
            <v-tab value="bookmark">
              <v-icon start size="18">mdi-bookmark-outline</v-icon>
              添加书签
            </v-tab>
            <v-tab value="folder">
              <v-icon start size="18">mdi-folder-outline</v-icon>
              添加文件夹
            </v-tab>
          </v-tabs>

          <v-form ref="addForm" @submit.prevent="confirmAddItem">
            <v-text-field
              v-model="newItemTitle"
              label="标题"
              variant="outlined"
              density="comfortable"
              class="mb-4"
              autofocus
              :rules="[(v: string) => !!v?.trim() || '标题不能为空']"
            ></v-text-field>

            <v-text-field
              v-if="addItemType === 'bookmark'"
              v-model="newItemUrl"
              label="链接地址"
              variant="outlined"
              density="comfortable"
              type="url"
              :rules="[(v: string) => !!v?.trim() || '链接地址不能为空']"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions class="add-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="handleCancelAdd" :disabled="isAddingItem">取消</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            @click="confirmAddItem"
            :loading="isAddingItem"
            :disabled="isAddingItem"
          >
            添加
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Duplicate Confirmation Dialog -->
    <v-dialog v-model="isDuplicateDialogOpen" max-width="500px">
      <v-card class="duplicate-dialog">
        <v-card-title class="duplicate-header">
          <v-icon start size="24" color="warning">mdi-alert-circle-outline</v-icon>
          发现重复项目
        </v-card-title>
        <v-card-text class="duplicate-content">
          <div class="text-body-1 mb-3">
            {{ duplicateInfo?.message }}
          </div>

          <div v-if="duplicateInfo?.type === 'name'" class="mb-3">
            <div class="text-body-2 text-medium-emphasis mb-2">同名项目：</div>
            <v-chip-group>
              <v-chip
                v-for="duplicate in duplicateInfo?.duplicates"
                :key="duplicate.id"
                variant="outlined"
                color="warning"
                size="small"
              >
                {{ duplicate.title }}
              </v-chip>
            </v-chip-group>
          </div>

          <div v-if="duplicateInfo?.type === 'url'" class="mb-3">
            <div class="text-body-2 text-medium-emphasis mb-2">重复的URL已在以下位置存在：</div>
            <v-list dense class="duplicate-list">
              <v-list-item
                v-for="duplicate in duplicateInfo?.duplicates"
                :key="duplicate.id"
              >
                <template v-slot:prepend>
                  <v-icon size="16" color="warning">mdi-bookmark-outline</v-icon>
                </template>
                <v-list-item-title>{{ duplicate.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ duplicate.path }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </div>

          <div class="text-body-2 text-medium-emphasis">
            确定要继续添加吗？
          </div>
        </v-card-text>
        <v-card-actions class="duplicate-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isDuplicateDialogOpen = false">取消</v-btn>
          <v-btn color="warning" variant="flat" @click="confirmAddDuplicate">继续添加</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cancel Add Confirmation Dialog -->
    <v-dialog v-model="isCancelConfirmDialogOpen" max-width="400px" persistent>
      <v-card class="cancel-confirm-dialog">
        <v-card-title class="cancel-confirm-header">
          <v-icon start size="24" color="warning">mdi-alert-circle-outline</v-icon>
          确认取消
        </v-card-title>
        <v-card-text class="cancel-confirm-content">
          <div class="text-body-1 mb-2">
            您已输入内容，确定要取消添加吗？
          </div>
          <div class="text-body-2 text-medium-emphasis">
            取消后已输入的内容将不会被保存。
          </div>
        </v-card-text>
        <v-card-actions class="cancel-confirm-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isCancelConfirmDialogOpen = false">继续编辑</v-btn>
          <v-btn color="warning" variant="flat" @click="confirmCancelAdd">确认取消</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" timeout="3000" color="success">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden; /* Prevent scrollbars on the root elements */
}
.ghost-item {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>

<style scoped>
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

/* Logo styles */
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
  /* 使用background-image来显示SVG，完全控制显示方式 */
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
  min-height: calc(100vh - 64px);
  background-color: #fafafa;
}

/* Page Container - Add margins to all sections */
.page-container {
  padding-left: 24px !important;
  padding-right: 24px !important;
  padding-bottom: 24px !important;
}

/* Statistics Section */
.stats-section {
  padding: 16px 0;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 8px; /* Add spacing between sections */
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

/* Stats row spacing */
.stats-row {
  margin-bottom: 0;
}

/* Comparison Section */
.comparison-section {
  flex: 1;
  padding: 24px 0 32px 0; /* Add bottom margin */
  background-color: #fafafa;
}

.comparison-row {
  height: calc(100vh - 180px); /* 优化PC浏览器高度 */
  min-height: 700px; /* PC浏览器更大的最小高度 */
  max-height: calc(100vh - 120px); /* PC浏览器更大的最大高度 */
}

.comparison-col {
  display: flex;
  flex-direction: column;
  height: 100%; /* 确保列也有固定高度 */
}

.comparison-card {
  height: 100%; /* 固定高度 */
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.comparison-card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  transform: translateY(-1px); /* PC浏览器轻微上移效果 */
}

.comparison-header-compact {
  background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 16px !important; /* Reduce padding for compact design */
  min-height: 56px; /* Reduce minimum height */
}

.comparison-content {
  height: 100%; /* 继承父容器高度 */
  overflow-y: auto; /* 只在这里设置滚动 */
  overflow-x: hidden;
  padding: 16px;
  padding-bottom: 32px; /* 添加底部间距 */
}

/* 确保v-list-group的内容可以自然展开，不设置滚动 */
.comparison-content :deep(.v-list-group__items) {
  overflow: visible !important;
  max-height: none !important;
}

.comparison-content :deep(.v-list-item) {
  min-height: 40px;
  padding: 8px 16px !important;
}

/* Control Panel */
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
  position: relative;
  overflow: hidden;
}

.control-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.3s ease, height 0.3s ease;
}

.control-btn:hover::before {
  width: 100%;
  height: 100%;
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

.diff-indicator {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Generation State */
.generation-state {
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

/* PC浏览器优化 - 专注于最佳桌面体验 */

/* PC浏览器优化的滚动条样式 - 只在comparison-content上显示 */
.comparison-content::-webkit-scrollbar {
  width: 8px; /* 稍微宽一点，更容易操作 */
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

.comparison-content::-webkit-scrollbar-thumb:active {
  background: rgba(0, 0, 0, 0.6);
}

/* 隐藏滚动条按钮，保持简洁 */
.comparison-content::-webkit-scrollbar-button {
  display: none;
}

/* Confirmation Dialog Styles */
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

.warning-list {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 16px;
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

/* Material Design 规范 - 统一的字体大小和间距 */
.app-bar-title {
  font-size: 20px !important;
  font-weight: 600 !important;
  color: #1f2937 !important;
}

.search-mode-toggle .v-btn {
  margin: 0 2px !important; /* 按钮间距4px */
}

.refresh-btn,
.confirm-btn {
  margin-left: 8px !important; /* 按钮间距8px */
}

/* 统计卡片中的字体大小 */
.stat-card-compact .v-card-title {
  font-size: 14px !important;
  font-weight: 500 !important;
  margin-bottom: 8px !important;
}

.stat-card-compact .text-h4 {
  font-size: 24px !important;
  font-weight: 600 !important;
  color: #1f2937 !important;
}

.stat-card-compact .text-body-2 {
  font-size: 12px !important;
  color: #6b7280 !important;
}

/* 对比区域标题 */
.comparison-header-compact .v-card-title {
  font-size: 16px !important;
  font-weight: 500 !important;
}

/* 按钮组间距统一 */
.v-btn-toggle .v-btn:not(:last-child) {
  margin-right: 4px !important;
}

/* 书签和文件夹的字体规范 */
.comparison-content :deep(.v-list-item-title) {
  font-size: 14px !important;
  font-weight: 400 !important;
  line-height: 1.5 !important;
  color: #374151 !important;
}

.comparison-content :deep(.v-list-item-subtitle) {
  font-size: 12px !important;
  font-weight: 400 !important;
  color: #6b7280 !important;
}

/* 统一按钮样式 */
.comparison-content :deep(.v-btn) {
  margin: 0 2px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
}

/* 对话框样式规范 */
.edit-dialog :deep(.v-card-title) {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #1f2937 !important;
}

.delete-dialog :deep(.v-card-title) {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #dc2626 !important;
}

.edit-dialog :deep(.v-text-field),
.delete-dialog :deep(.v-text-field) {
  margin-bottom: 8px !important;
}

.edit-dialog :deep(.v-card-text),
.delete-dialog :deep(.v-card-text) {
  padding: 16px 24px !important;
}

.edit-dialog :deep(.v-card-actions),
.delete-dialog :deep(.v-card-actions) {
  padding: 8px 24px 16px 24px !important;
}

/* 确保统一的间距 */
.comparison-content {
  padding: 16px !important;
}

/* 统一卡片内部间距 */
.comparison-header-compact {
  padding: 16px 24px !important;
}

/* 统计卡片规范化 */
.stats-section {
  padding: 20px 24px !important;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.stat-card-compact {
  padding: 16px !important;
  border-radius: 12px !important;
  transition: all 0.2s ease !important;
}

.stat-card-compact:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
}

/* 按钮规范化 */
:deep(.v-btn) {
  border-radius: 8px !important;
  font-weight: 500 !important;
  text-transform: none !important;
  letter-spacing: 0.025em !important;
}

/* 小按钮特殊处理 */
:deep(.v-btn[size="x-small"]) {
  min-width: 32px !important;
  height: 32px !important;
}

/* 图标按钮规范化 */
:deep(.v-btn[icon]) {
  min-width: 36px !important;
  width: 36px !important;
  height: 36px !important;
}

/* 新增对话框样式 */
.add-dialog :deep(.v-card-title) {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #1f2937 !important;
}

.add-dialog :deep(.v-card-text) {
  padding: 16px 24px !important;
}

.add-dialog :deep(.v-card-actions) {
  padding: 8px 24px 16px 24px !important;
}

/* 重复确认对话框样式 */
.duplicate-dialog :deep(.v-card-title) {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #d97706 !important;
}

.duplicate-dialog :deep(.v-card-text) {
  padding: 16px 24px !important;
}

.duplicate-dialog :deep(.v-card-actions) {
  padding: 8px 24px 16px 24px !important;
}

.duplicate-list {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
}

/* 取消确认对话框样式 */
.cancel-confirm-dialog :deep(.v-card-title) {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #d97706 !important;
}

.cancel-confirm-dialog :deep(.v-card-text) {
  padding: 16px 24px !important;
}

.cancel-confirm-dialog :deep(.v-card-actions) {
  padding: 8px 24px 16px 24px !important;
}

/* 加载状态样式 */
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
</style>
