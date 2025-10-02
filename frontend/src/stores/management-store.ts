/**
 * Management管理页面状态管理Store
 * 管理书签管理页面的所有状态和操作
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PERFORMANCE_CONFIG, BOOKMARK_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';
import { CleanupScanner } from '../utils/cleanup-scanner';
import { managementAPI } from '../utils/unified-bookmark-api';
import { smartBookmarkDiffEngine, type BookmarkNode as DiffBookmarkNode, OperationType } from '../utils/smart-bookmark-diff-engine';
import { createBookmark, moveBookmark, removeBookmark, removeBookmarkTree } from '../utils/chrome-api';
import { DataValidator } from '../utils/error-handling';
import type {
  BookmarkNode,
  ChromeBookmarkTreeNode,
  CacheStatus as ICacheStatus,
  StorageData,
} from '../types';
import { DEFAULT_CLEANUP_SETTINGS, type CleanupState, type CleanupSettings } from '../types/cleanup';

// === 类型定义 ===

export interface ProposalNode {
  id: string
  title: string
  url?: string
  children?: ProposalNode[]
  parentId?: string
  index?: number
  dateAdded?: number
}

// 使用全局类型定义
type CacheStatus = ICacheStatus

export interface EditBookmarkData {
  id: string
  title: string
  url: string
  parentId?: string
}

export interface AddItemData {
  type: 'folder' | 'bookmark'
  title: string
  url?: string
  parentId?: string
}

/**
 * Management状态管理Store
 */
export const useManagementStore = defineStore('management', () => {

  // === 核心数据状态 ===

  const originalTree = ref<ChromeBookmarkTreeNode[]>([]);
  const newProposalTree = ref<ProposalNode>({
    id: 'root-empty',
    title: '等待数据源',
    children: []
  });
  const structuresAreDifferent = ref(false);

  // === 暂存区与未保存更改 ===
  interface StagedEdit {
    id: string
    type: 'create' | 'update' | 'delete' | 'move' | 'reorder'
    nodeId?: string
    payload?: any
    reason?: string
    timestamp: number
  }

  const stagedEdits = ref<StagedEdit[]>([]);
  const hasUnsavedChanges = ref(false);
  const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges.value) {
      const msg = '您有未保存的更改，确定要离开吗？';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    }
    return undefined;
  };

  // === 数据加载和缓存状态 ===

  const cacheStats = ref({
    hitRate: 0,
    itemCount: 0,
    memorySize: 0,
    lastUpdated: 0
  });

  let debounceTimer: number | null = null
  const debouncedBuildMapping = (...args: unknown[]) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      const [originalTree, proposedTree] = args as [ChromeBookmarkTreeNode[], ProposalNode[]];
      buildBookmarkMappingImpl(originalTree, proposedTree);
    }, 300);
  };

  const isPageLoading = ref(true);
  const loadingMessage = ref('正在加载书签数据...');

  const cacheStatus = ref<CacheStatus>({
    isFromCache: false,
    lastUpdate: null,
    dataAge: null
  });

  // === 对话框状态 ===

  const isAddNewItemDialogOpen = ref(false);
  const addItemType = ref<'folder' | 'bookmark'>('bookmark');
  const parentFolder = ref<BookmarkNode | null>(null);
  const newItemTitle = ref('');
  const newItemUrl = ref('');

  const isEditBookmarkDialogOpen = ref(false);
  const editingBookmark = ref<BookmarkNode | null>(null);
  const editTitle = ref('');
  const editUrl = ref('');
  // 文件夹编辑状态
  const isEditFolderDialogOpen = ref(false);
  const editingFolder = ref<BookmarkNode | null>(null);
  const editFolderTitle = ref('');


  // === 通知状态 ===

  const snackbar = ref(false);
  const snackbarText = ref('');
  const snackbarColor = ref<'info' | 'success' | 'error' | 'warning'>('info');

  // === 复杂数据结构状态 ===

  const bookmarkMapping = ref<Map<string, any>>(new Map());

  const originalExpandedFolders = ref<Set<string>>(new Set());
  const proposalExpandedFolders = ref<Set<string>>(new Set());

  // === 🚀 高性能缓存功能 ===

  const fastSearchBookmarks = async (query: string, _limit = 100) => {
    if (!query.trim()) return [];

    const startTime = performance.now();
    const results = await managementAPI.searchBookmarks();
    const duration = performance.now() - startTime;

    logger.info('Management', '🔍 内存搜索完成', {
      query,
      resultCount: results.length,
      searchTime: `${duration.toFixed(2)}ms`
    });

    return results;
  };

  const fastGetBookmarkById = async (id: string) => {
    const allBookmarks = await managementAPI.getBookmarkTreeData();
    return allBookmarks.bookmarks.find((b: any) => b.id === id) || null;
  };

  const fastGetBookmarksByIds = async (ids: string[]) => {
    const allBookmarks = await managementAPI.getBookmarkTreeData();
    return ids.map(id => allBookmarks.bookmarks.find((b: any) => b.id === id)).filter(Boolean);
  };

  const updateCacheStats = async () => {
    const stats = await managementAPI.getBookmarkStats();
    cacheStats.value = {
      hitRate: stats.bookmarks > 0 ? 1 : 0,
      itemCount: stats.bookmarks,
      memorySize: stats.folders,
      lastUpdated: Date.now()
    };
  };

  const refreshCache = async () => {
    try {
      await updateCacheStats();
      showNotification('数据刷新成功', 'success');
      return true;
    } catch (error) {
      logger.error('Management', '缓存刷新失败:', error);
      showNotification('缓存刷新失败', 'error');
      return false;
    }
  };

  // === 工具函数 ===
  const getDefaultCleanupSettings = () => ({ ...DEFAULT_CLEANUP_SETTINGS });

  const showNotification = (
    text: string,
    color: 'info' | 'success' | 'error' | 'warning' = 'info',
    duration: number = PERFORMANCE_CONFIG.NOTIFICATION_HIDE_DELAY
  ) => {
    snackbarText.value = text;
    snackbarColor.value = color;
    snackbar.value = true;
    setTimeout(() => {
      snackbar.value = false;
    }, duration);
  };

  const showDataReadyNotification = (bookmarkCount: number) => {
    showNotification(`书签数据已准备就绪，共 ${bookmarkCount} 个书签`, 'success');
  };

  const convertCachedToTreeNodes = (cached: any[]): ChromeBookmarkTreeNode[] => {
    if (cached.length > 0 && cached[0].children !== undefined) {
      const convert = (item: any): ChromeBookmarkTreeNode => {
        const node: ChromeBookmarkTreeNode = {
          id: item.id,
          parentId: item.parentId,
          title: item.title,
          url: item.url,
          index: item.index,
          dateAdded: item.dateAdded,
          dateModified: item.dateModified
        };
        if (item.children && item.children.length > 0) {
          node.children = item.children.map(convert);
        }
        return node;
      };
      return cached.map(convert);
    }

    logger.info('Management', '🔄 重建书签树形结构，扁平数据长度:', cached.length);
    const nodeMap = new Map<string, ChromeBookmarkTreeNode>();
    const convert = (item: any): ChromeBookmarkTreeNode => ({
      id: item.id,
      parentId: item.parentId,
      title: item.title,
      url: item.url,
      index: item.index || 0,
      dateAdded: item.dateAdded,
      dateModified: item.dateModified
    });

    cached.forEach(item => {
      nodeMap.set(item.id, convert(item));
    });

    const roots: ChromeBookmarkTreeNode[] = [];
    nodeMap.forEach(node => {
      if (node.parentId && node.parentId !== '0') {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        } else {
          if (node.title && node.title.trim()) {
            roots.push(node);
          }
        }
      } else {
        if (node.title && node.title.trim() && node.id !== '0') {
          roots.push(node);
        }
      }
    });

    nodeMap.forEach(node => {
      if (node.children) {
        node.children.sort((a, b) => (a.index || 0) - (b.index || 0));
      }
    });

    roots.sort((a, b) => (a.index || 0) - (b.index || 0));
    logger.info('Management', '✅ 树形结构重建完成，根节点数量:', roots.length);
    return roots;
  };

  const loadFromFastCache = async (): Promise<boolean> => {
    try {
      const startTime = performance.now();
      const bookmarkData = await managementAPI.getBookmarkTreeData();
      const cachedBookmarks = bookmarkData.bookmarks;

      if (cachedBookmarks && cachedBookmarks.length > 0) {
        const fullTree = convertCachedToTreeNodes(cachedBookmarks);
        originalTree.value = fullTree;
        rebuildOriginalIndexes(fullTree);
        setRightPanelFromLocalOrAI(fullTree, {});

        try {
          originalExpandedFolders.value.clear();
          originalExpandedFolders.value.add('1');
          originalExpandedFolders.value.add('2');
          originalExpandedFolders.value = new Set(originalExpandedFolders.value);
        } catch (e) {
          logger.warn('Management', '展开文件夹失败:', e);
        }

        updateComparisonState();

        if (originalTree.value && newProposalTree.value.children) {
          buildBookmarkMapping(
            originalTree.value,
            newProposalTree.value.children
          );
        }

        const statsInfo = await managementAPI.getBookmarkStats();
        cacheStatus.value.isFromCache = statsInfo.bookmarks > 0;
        cacheStatus.value.lastUpdate = Date.now();

        setTimeout(() => {
          isPageLoading.value = false;
          loadingMessage.value = '';
        }, 100);

        const duration = performance.now() - startTime;
        const bookmarkCount = statsInfo.bookmarks || 0;

        logger.info('Management', '⚡ 高性能缓存加载完成', {
          bookmarkCount,
          loadTime: `${duration.toFixed(2)}ms`,
          memorySize: `${(JSON.stringify(cachedBookmarks).length / 1024 / 1024).toFixed(2)}MB`,
          hitRate: `${statsInfo.bookmarks > 0 ? '100.0' : '0.0'}%`,
          optimization: '使用预计算统计，避免O(n)递归'
        });

        showDataReadyNotification(bookmarkCount);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Management', '高性能缓存加载失败:', error);
      isPageLoading.value = false;
      loadingMessage.value = '缓存加载失败';
      return false;
    }
  };

  const setRightPanelFromLocalOrAI = (fullTree: ChromeBookmarkTreeNode[], _storageData: StorageData): void => {
    // 移除URL的mode参数逻辑，统一采用克隆模式
    newProposalTree.value = {
      id: 'root-cloned',
      title: '克隆的书签结构',
      children: JSON.parse(JSON.stringify(fullTree))
    } as any;
    try {
      proposalExpandedFolders.value.clear();
      proposalExpandedFolders.value.add('1');
      proposalExpandedFolders.value.add('2');
      proposalExpandedFolders.value.add('root-cloned');
      proposalExpandedFolders.value = new Set(proposalExpandedFolders.value);
    } catch (e) {
      logger.warn('Management', '右侧面板展开状态初始化失败(克隆模式):', e);
    }
  };

  // 已移除：AI建议结构转换函数 convertLegacyProposalToTree（不再使用）

  const rebuildOriginalIndexes = (tree: ChromeBookmarkTreeNode[]) => {
    logger.info('Management', '重建原始索引', { treeLength: tree.length });
  };

  const updateComparisonState = () => {
    structuresAreDifferent.value = true;
  };

  // === 暂存区工具函数 ===
  const markUnsaved = (reason: string, payload?: any) => {
    hasUnsavedChanges.value = true;
    stagedEdits.value.push({ id: `edit_${Date.now()}_${stagedEdits.value.length}`, type: payload?.type || 'update', nodeId: payload?.nodeId, payload, reason, timestamp: Date.now() });
  };

  const clearUnsaved = () => {
    hasUnsavedChanges.value = false;
    stagedEdits.value = [];
  };

  const attachUnsavedChangesGuard = () => {
    window.addEventListener('beforeunload', beforeUnloadHandler);
  };

  const detachUnsavedChangesGuard = () => {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
  };

  const findNodeById = (nodes: ProposalNode[], id: string): { node: ProposalNode | null; parent: ProposalNode | null } => {
    const stack: Array<{ node: ProposalNode; parent: ProposalNode | null }> = [];
    nodes.forEach(n => stack.push({ node: n, parent: null }));
    while (stack.length) {
      const { node, parent } = stack.pop()!;
      if (node.id === id) return { node, parent };
      if (node.children) node.children.forEach(ch => stack.push({ node: ch, parent: node }));
    }
    return { node: null, parent: null };
  };

  const removeNodeById = (nodes: ProposalNode[], id: string): boolean => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.id === id) {
        nodes.splice(i, 1);
        return true;
      }
      if (n.children && n.children.length) {
        const removed = removeNodeById(n.children, id);
        if (removed) return true;
      }
    }
    return false;
  };

  const insertNodeToParent = (nodes: ProposalNode[], parentId: string | undefined, newNode: ProposalNode, index = 0): boolean => {
    if (!parentId) return false;
    const { node: parent } = findNodeById(nodes, parentId);
    if (!parent) return false;
    if (!parent.children) parent.children = [];
    const clampedIndex = Math.max(0, Math.min(index, parent.children.length));
    parent.children.splice(clampedIndex, 0, newNode);
    // 重建index字段
    parent.children.forEach((c, i) => (c.index = i));
    return true;
  };

  const rebuildIndexesRecursively = (nodes: ProposalNode[]) => {
    nodes.forEach((n, i) => {
      n.index = i;
      if (n.children) rebuildIndexesRecursively(n.children);
    });
  };

  function buildBookmarkMappingImpl(originalTree: ChromeBookmarkTreeNode[], proposedTree: ProposalNode[]) {
    console.time('buildBookmarkMapping')
    logger.info('Management', 'Building bookmark mapping:', {
      originalCount: originalTree.length,
      proposedCount: proposedTree.length
    });
    try {
      bookmarkMapping.value.clear();
      const isLargeDataset = originalTree.length > BOOKMARK_CONFIG.LARGE_DATASET_THRESHOLD ||
        proposedTree.length > BOOKMARK_CONFIG.LARGE_DATASET_THRESHOLD;
      if (isLargeDataset) {
        logger.info('Management', '检测到大数据集，使用优化算法');
        // TODO: 实现优化的映射算法
      } else {
        // 简单映射算法
        // TODO: 实现基本映射算法
      }
      logger.info('Management', '构建书签映射完成', {
        mappingCount: bookmarkMapping.value.size,
        isLargeDataset
      });
    } catch (error) {
      logger.error('Management', '构建书签映射失败', { error });
    } finally {
      console.timeEnd('buildBookmarkMapping')
    }
  }

  const buildBookmarkMapping = (originalTree: ChromeBookmarkTreeNode[], proposedTree: ProposalNode[]) => {
    debouncedBuildMapping(originalTree, proposedTree)
  };

  const openAddNewItemDialog = (type: 'folder' | 'bookmark', parent: BookmarkNode | null = null) => {
    addItemType.value = type;
    parentFolder.value = parent;
    newItemTitle.value = '';
    newItemUrl.value = '';
    isAddNewItemDialogOpen.value = true;
  };

  const handleCopySuccess = () => {
    showNotification('链接已复制到剪贴板', 'success', 2000);
  };

  const handleCopyFailed = () => {
    showNotification('复制链接失败', 'error', 2000);
  };

  const addNewItem = (parentNode: BookmarkNode) => {
    openAddNewItemDialog('bookmark', parentNode);
  };

  // === 清理功能状态和Actions (完全独立) ===

  const cleanupState = ref<CleanupState | null>(null);
  let cleanupScanner: CleanupScanner | null = null;

  const initializeCleanupState = async () => {
    if (!cleanupState.value) {
      let savedSettings = { ...DEFAULT_CLEANUP_SETTINGS };
      try {
        savedSettings = { ...DEFAULT_CLEANUP_SETTINGS };
        logger.info('Cleanup', '使用默认清理设置（已迁移到IndexedDB）');
      } catch (error) {
        logger.warn('Cleanup', '加载设置失败，使用默认设置', error);
      }
      cleanupState.value = {
        isFiltering: false,
        activeFilters: ['404', 'duplicate', 'empty', 'invalid'],
        isScanning: false,
        justCompleted: false,
        tasks: [],
        filterResults: new Map(),
        legendVisibility: {
          all: true,
          '404': true,
          duplicate: true,
          empty: true,
          invalid: true
        },
        showSettings: false,
        settingsTab: '404',
        settings: savedSettings
      };
    }
  };

  const startCleanupScan = async () => {
    await initializeCleanupState();
    if (!cleanupState.value) return;

    if (!newProposalTree.value.children || newProposalTree.value.children.length === 0) {
      showNotification('右侧面板没有数据，请先加载书签数据', 'warning');
      return;
    }

    cleanupState.value.isScanning = true;
    cleanupState.value.tasks = [];
    cleanupState.value.filterResults.clear();

    if (!cleanupScanner) {
      cleanupScanner = new CleanupScanner();
    }

    const scanTasks = cleanupState.value.activeFilters.map(filterType => ({
      type: filterType,
      status: 'pending' as const,
      processed: 0,
      total: 0,
      foundIssues: 0
    }));

    cleanupState.value.tasks = scanTasks;

    try {
      logger.info('Cleanup', '扫描完成', {
        totalResults: Array.from(cleanupState.value.filterResults.values()).flat().length
      });
    } catch (error) {
      logger.error('Cleanup', '扫描过程出错', error);
      showNotification('清理扫描失败: ' + (error as Error).message, 'error');
    } finally {
      if (cleanupState.value) {
        cleanupState.value.isScanning = false;
      }
    }
  };

  const completeCleanupScan = () => {
    if (!cleanupState.value) return;
    cleanupState.value.justCompleted = true;
    cleanupState.value.isScanning = false;
    logger.info('Cleanup', '清理扫描已完成', {
      activeFilters: cleanupState.value.activeFilters,
      resultCount: Array.from(cleanupState.value.filterResults.values()).flat().length
    });
  };

  const countCleanupTreeBookmarks = (tree: BookmarkNode[]): { bookmarks: number; folders: number } => {
    let bookmarks = 0;
    let folders = 0;
    const traverse = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          bookmarks++;
        } else {
          folders++;
          if (node.children) {
            traverse(node.children);
          }
        }
      }
    };
    traverse(tree);
    return { bookmarks, folders };
  };

  // === 工具函数：计算书签统计 ===

  const initialize = async () => {
    logger.info('Management', '🚀 开始初始化Management Store...');
    try {
      isPageLoading.value = true;
      loadingMessage.value = '正在初始化数据管理器...';
      loadingMessage.value = '正在加载书签数据...';
      const success = await loadFromFastCache();

      if (success) {
        await updateCacheStats();
        await initializeCleanupState();
        logger.info('Management', '✅ Management Store初始化完成');
        loadingMessage.value = '数据加载完成';
      } else {
        logger.warn('Management', '⚠️ 数据加载失败，尝试刷新...');
        loadingMessage.value = '数据加载失败，正在重试...';
        await refreshCache();
      }
    } catch (error) {
      logger.error('Management', '❌ Management Store初始化失败:', error);
      loadingMessage.value = '初始化失败，请刷新页面重试';
    } finally {
      isPageLoading.value = false;
    }
  };

  const editBookmark = (bookmark: BookmarkNode) => {
    logger.info('Management', '开始编辑书签:', bookmark.title);
    editingBookmark.value = { ...bookmark };
    editTitle.value = bookmark.title || '';
    editUrl.value = bookmark.url || '';
    isEditBookmarkDialogOpen.value = true;
  };
  const editFolder = (folder: BookmarkNode) => {
    logger.info('Management', '开始编辑文件夹:', folder.title);
    editingFolder.value = { ...folder };
    editFolderTitle.value = folder.title || '';
    isEditFolderDialogOpen.value = true;
  };
  // === 本地暂存：增删改移 ===
  const deleteBookmark = async (bookmarkOrId: BookmarkNode | string) => {
    const bookmarkId = typeof bookmarkOrId === 'string' ? bookmarkOrId : bookmarkOrId.id;
    logger.info('Management', '暂存删除书签:', bookmarkId);
    if (!newProposalTree.value.children) return;
    const removed = removeNodeById(newProposalTree.value.children, bookmarkId);
    if (removed) {
      rebuildIndexesRecursively(newProposalTree.value.children);
      markUnsaved('delete', { type: 'delete', nodeId: bookmarkId });
      updateComparisonState();
      showNotification('已暂存删除书签', 'success');
    } else {
      showNotification('暂存删除失败：未找到该书签', 'error');
    }
  };

  const deleteFolder = async (folderOrId: BookmarkNode | string) => {
    const folderId = typeof folderOrId === 'string' ? folderOrId : folderOrId.id;
    logger.info('Management', '暂存删除文件夹:', folderId);
    if (!newProposalTree.value.children) return;
    const removed = removeNodeById(newProposalTree.value.children, folderId);
    if (removed) {
      rebuildIndexesRecursively(newProposalTree.value.children);
      markUnsaved('delete', { type: 'delete', nodeId: folderId });
      updateComparisonState();
      showNotification('已暂存删除文件夹', 'success');
    } else {
      showNotification('暂存删除失败：未找到该文件夹', 'error');
    }
  };

  const handleReorder = async (params?: { nodeId: string; newParentId: string; newIndex: number }) => {
    if (!params) {
      logger.warn('Management', 'handleReorder called without parameters');
      return;
    }
    logger.info('Management', '暂存移动/排序:', params);
    if (!newProposalTree.value.children) return;
    // 1. 找到并移除节点
    const { node } = findNodeById(newProposalTree.value.children, params.nodeId);
    if (!node) {
      showNotification('暂存移动失败：未找到节点', 'error');
      return;
    }
    removeNodeById(newProposalTree.value.children, params.nodeId);
    // 2. 插入到新父级位置
    node.parentId = params.newParentId;
    insertNodeToParent(newProposalTree.value.children, params.newParentId, node, params.newIndex);
    rebuildIndexesRecursively(newProposalTree.value.children);
    markUnsaved('move', { type: 'move', nodeId: params.nodeId, parentId: params.newParentId, index: params.newIndex });
    updateComparisonState();
    showNotification('已暂存位置调整', 'success');
  };

  const toggleAllFolders = async (panel: 'original' | 'proposal' = 'original') => {
    const startTime = performance.now();
    logger.info('Management', '🔄 开始切换所有文件夹展开状态:', panel);
    try {
      if (panel === 'original') {
        const currentTree = originalTree.value;
        if (!currentTree || currentTree.length === 0) return;
        const allFolderIds = await collectFolderIdsOptimized(currentTree, 'original');
        const expandedCount = Array.from(allFolderIds).filter(id => originalExpandedFolders.value.has(id)).length;
        const allExpanded = expandedCount > allFolderIds.size * 0.5;
        if (allExpanded) {
          originalExpandedFolders.value = new Set();
        } else {
          originalExpandedFolders.value = new Set(['1', '2', ...allFolderIds]);
        }
      } else {
        const currentTree = newProposalTree.value.children;
        if (!currentTree || currentTree.length === 0) return;
        const allFolderIds = await collectFolderIdsOptimized(currentTree, 'proposal');
        const expandedCount = Array.from(allFolderIds).filter(id => proposalExpandedFolders.value.has(id)).length;
        const allExpanded = expandedCount > allFolderIds.size * 0.5;
        if (allExpanded) {
          proposalExpandedFolders.value = new Set();
        } else {
          proposalExpandedFolders.value = new Set(['1', '2', 'root-cloned', ...allFolderIds]);
        }
      }
      const duration = performance.now() - startTime;
      logger.info('Management', `🚀 一键展开操作完成，耗时: ${duration.toFixed(2)}ms`);
    } catch (error) {
      logger.error('Management', '❌ 一键展开操作失败:', error);
      showNotification('展开操作失败', 'error');
    }
  };

  const collectFolderIdsOptimized = async (nodes: any[], _type?: 'original' | 'proposal'): Promise<Set<string>> => {
    return new Promise((resolve) => {
      const allFolderIds = new Set<string>();
      const processChunk = (nodeList: any[], chunkSize = 100) => {
        for (let i = 0; i < Math.min(chunkSize, nodeList.length); i++) {
          const node = nodeList[i];
          if (node.children && Array.isArray(node.children)) {
            allFolderIds.add(node.id);
            if (node.children.length > 0) {
              processChunk(node.children, Math.max(10, chunkSize / 2));
            }
          }
        }
        if (nodeList.length > chunkSize) {
          const remaining = nodeList.slice(chunkSize);
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => processChunk(remaining, chunkSize));
          } else {
            setTimeout(() => processChunk(remaining, chunkSize), 0);
          }
        } else {
          resolve(allFolderIds);
        }
      };
      processChunk(nodes);
    });
  };

  const toggleOriginalFolder = (nodeId: string) => {
    if (originalExpandedFolders.value.has(nodeId)) {
      originalExpandedFolders.value.delete(nodeId);
    } else {
      originalExpandedFolders.value.add(nodeId);
    }
    originalExpandedFolders.value = new Set(originalExpandedFolders.value);
  };

  const toggleProposalFolder = (nodeId: string) => {
    if (proposalExpandedFolders.value.has(nodeId)) {
      proposalExpandedFolders.value.delete(nodeId);
    } else {
      proposalExpandedFolders.value.add(nodeId);
    }
    proposalExpandedFolders.value = new Set(proposalExpandedFolders.value);
  };

  const cancelCleanupScan = () => {
    if (!cleanupState.value) return;
    logger.info('Management', '取消清理扫描');
    cleanupState.value.isScanning = false;
    cleanupState.value.tasks = [];
    showNotification('清理扫描已取消', 'info');
  };

  const executeCleanup = async () => {
    if (!cleanupState.value) return;
    logger.info('Management', '开始执行清理');
    try {
      cleanupState.value.isExecuting = true;
      const allProblems = Array.from(cleanupState.value.filterResults.values()).flat();
      const bookmarksToDelete = allProblems.map(problem => problem.bookmarkId);
      if (bookmarksToDelete.length === 0) {
        showNotification('没有找到需要清理的项目', 'info');
        return;
      }
      for (const bookmarkId of bookmarksToDelete) {
        await chrome.runtime.sendMessage({ type: 'DELETE_BOOKMARK', bookmarkId });
      }
      await initialize();
      showNotification(`清理完成，删除了 ${bookmarksToDelete.length} 个项目`, 'success');
      cleanupState.value.filterResults.clear();
      cleanupState.value.justCompleted = true;
    } catch (error) {
      logger.error('Management', '执行清理失败:', error);
      showNotification(`清理失败: ${(error as Error).message}`, 'error');
    } finally {
      if (cleanupState.value) {
        cleanupState.value.isExecuting = false;
      }
    }
  };

  const toggleCleanupFilter = (filterType: '404' | 'duplicate' | 'empty' | 'invalid') => {
    if (!cleanupState.value) return;
    logger.info('Management', '切换清理过滤器:', filterType);
    const activeFilters = cleanupState.value.activeFilters;
    const index = activeFilters.indexOf(filterType);
    if (index > -1) {
      activeFilters.splice(index, 1);
    } else {
      activeFilters.push(filterType);
    }
    if (cleanupState.value.filterResults.size > 0) {
      // 重新扫描为异步任务，明确忽略其 Promise 以避免触发 no-floating-promises
      void startCleanupScan();
    }
  };

  const resetCleanupFilters = () => {
    if (!cleanupState.value) return;
    logger.info('Management', '重置清理过滤器');
    cleanupState.value.activeFilters = [];
    cleanupState.value.filterResults.clear();
    showNotification('过滤器已重置', 'info');
  };

  const toggleCleanupLegendVisibility = (legendKey: string) => {
    if (!cleanupState.value) return;
    logger.info('Management', '切换清理图例可见性:', legendKey);
    if (legendKey === 'all') {
      cleanupState.value.showLegend = !cleanupState.value.showLegend;
    }
  };

  const showCleanupSettings = () => {
    if (!cleanupState.value) return;
    logger.info('Management', '显示清理设置');
    cleanupState.value.showSettings = true;
  };

  const hideCleanupSettings = () => {
    if (!cleanupState.value) return;
    logger.info('Management', '隐藏清理设置');
    cleanupState.value.showSettings = false;
  };

  const saveCleanupSettings = () => {
    if (!cleanupState.value) return;
    logger.info('Management', '保存清理设置');
    try {
      localStorage.setItem('cleanup-settings', JSON.stringify(cleanupState.value.settings));
      showNotification('设置已保存', 'success');
      hideCleanupSettings();
    } catch (error) {
      logger.error('Management', '保存设置失败:', error);
      showNotification('保存设置失败', 'error');
    }
  };

  const resetCleanupSettings = (settingKey?: keyof CleanupSettings) => {
    if (!cleanupState.value) return;
    logger.info('Management', '重置清理设置:', settingKey);
    if (settingKey) {
      (cleanupState.value.settings as any)[settingKey] = getDefaultCleanupSettings()[settingKey];
    } else {
      cleanupState.value.settings = getDefaultCleanupSettings();
    }
    showNotification('设置已重置', 'info');
  };

  const updateCleanupSetting = (key: keyof CleanupSettings, value: any, subKey?: string) => {
    if (!cleanupState.value) return;
    logger.info('Management', '更新清理设置:', key, subKey, value);
    if (subKey) {
      (cleanupState.value.settings[key] as any)[subKey] = value;
    } else {
      (cleanupState.value.settings as any)[key] = value;
    }
  };

  const setCleanupSettingsTab = (tab: string) => {
    if (!cleanupState.value) return;
    logger.info('Management', '切换清理设置标签:', tab);
    cleanupState.value.activeSettingsTab = tab;
  };

  const getProposalPanelTitle = () => 'IndexedDB Data';
  const getProposalPanelIcon = () => 'mdi-database';
  const getProposalPanelColor = () => 'primary';

  // === 编辑与新增的确认（暂存到右侧树）===
  const saveEditedBookmark = () => {
    if (!editingBookmark.value) return;
    const id = editingBookmark.value.id!;
    if (!newProposalTree.value.children) return;
    const { node } = findNodeById(newProposalTree.value.children, id);
    if (!node) {
      showNotification('保存失败：右侧树未找到该书签', 'error');
      return;
    }
    // URL格式校验：必须为有效URL且包含协议
    const urlToSave = (editUrl.value || '').trim();
    if (!urlToSave || !DataValidator.validateUrl(urlToSave)) {
      // 表单内联校验负责展示错误提示，这里仅阻止保存
      return;
    }
    node.title = editTitle.value;
    node.url = urlToSave;
    markUnsaved('update', { type: 'update', nodeId: id, title: node.title, url: node.url });
    updateComparisonState();
    isEditBookmarkDialogOpen.value = false;
    showNotification('已暂存编辑', 'success');
  };

  const saveEditedFolder = () => {
    if (!editingFolder.value) return;
    const id = editingFolder.value.id!;
    if (!newProposalTree.value.children) return;
    const { node } = findNodeById(newProposalTree.value.children, id);
    if (!node) {
      showNotification('保存失败：右侧树未找到该文件夹', 'error');
      return;
    }
    const titleToSave = (editFolderTitle.value || '').trim();
    if (!titleToSave) {
      // 表单内联校验负责展示错误提示，这里仅阻止保存
      return;
    }
    node.title = titleToSave;
    // 文件夹无 url 修改
    markUnsaved('update', { type: 'update', nodeId: id, title: node.title });
    updateComparisonState();
    isEditFolderDialogOpen.value = false;
    showNotification('已暂存编辑', 'success');
  };

  const confirmAddNewItemStaged = () => {
    const type = addItemType.value;
    const title = newItemTitle.value?.trim();
    const url = newItemUrl.value?.trim();
    const parent = parentFolder.value as any;
    if (!title) {
      showNotification('请输入标题', 'warning');
      return;
    }
    if (!newProposalTree.value.children) return;

    const tempId = `temp_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const newNode: ProposalNode = {
      id: tempId,
      title,
      parentId: parent?.id,
      index: 0
    };
    if (type === 'bookmark') {
      // URL必填且格式校验
      if (!url) {
        // 表单内联校验负责展示错误提示，这里仅阻止保存
        return;
      }
      if (!DataValidator.validateUrl(url)) {
        // 表单内联校验负责展示错误提示，这里仅阻止保存
        return;
      }
      newNode.url = url;
    } else {
      newNode.children = [];
    }

    const inserted = parent?.id
      ? insertNodeToParent(newProposalTree.value.children, parent.id, newNode, parent.children?.length || 0)
      : (() => { newProposalTree.value.children!.push(newNode); return true; })();

    if (inserted) {
      rebuildIndexesRecursively(newProposalTree.value.children!);
      markUnsaved('create', { type: 'create', nodeId: tempId, title, url, parentId: parent?.id });
      updateComparisonState();
      isAddNewItemDialogOpen.value = false;
      // 生成父目录路径文本与 pathIds（用于提示与后续定位）
      const getPathIds = (nodes: ProposalNode[], targetId: string, trail: string[] = []): string[] | null => {
        for (const n of nodes) {
          const current = [...trail, n.id]
          if (n.id === targetId) return current
          if (n.children && n.children.length) {
            const found = getPathIds(n.children, targetId, current)
            if (found) return found
          }
        }
        return null
      }
      const getPathText = (nodes: ProposalNode[], targetId: string, trail: string[] = [], trailTitles: string[] = []): string | null => {
        for (const n of nodes) {
          const nextTrail = [...trail, n.id]
          const nextTitles = [...trailTitles, n.title || '']
          if (n.id === targetId) return nextTitles.join('/') + '/'
          if (n.children && n.children.length) {
            const found = getPathText(n.children, targetId, nextTrail, nextTitles)
            if (found) return found
          }
        }
        return null
      }
      const pathIds = getPathIds(newProposalTree.value.children!, tempId) || undefined
      const pathText = parent?.id ? (getPathText(newProposalTree.value.children!, parent.id) || '') : '/'
      showNotification(`新增成功 新书签已新增在${pathText} 目录中`, 'success');
      return { id: tempId, pathIds }
    } else {
      showNotification('添加失败：未找到父级', 'error');
    }
  };

  // === 应用暂存更改：计算diff并调用Chrome API ===
  const applyStagedChanges = async () => {
    try {
      if (!newProposalTree.value.children) {
        showNotification('右侧面板为空，无需应用', 'info');
        return false;
      }
      const targetTree = newProposalTree.value.children as unknown as DiffBookmarkNode[];
      const original = originalTree.value as unknown as DiffBookmarkNode[];
      const diff = await smartBookmarkDiffEngine.computeDiff(original, targetTree);

      logger.info('Management', '📊 计划执行操作数:', diff.operations.length);
      // 逐个执行操作
      for (const op of diff.operations) {
        if (op.type === OperationType.CREATE) {
          const t = op.target || {};
          await createBookmark({ parentId: t.parentId, index: t.index, title: t.title, url: t.url });
        } else if (op.type === OperationType.DELETE && op.nodeId) {
          // 判断是否是文件夹（尽可能从original中查找）
          const { node } = findNodeById(original as any, op.nodeId);
          if (node && node.children && node.children.length > 0 && !node.url) {
            await removeBookmarkTree(op.nodeId);
          } else {
            await removeBookmark(op.nodeId);
          }
        } else if (op.type === OperationType.UPDATE && op.nodeId) {
          const t = op.target || {} as any;
          // 使用原生API封装：chrome.bookmarks.update（通过sendMessage可能不统一，直接调用chrome.bookmarks.update在前端环境可用）
          await new Promise<void>((resolve, reject) => {
            try {
              chrome.bookmarks.update(op.nodeId!, { title: t.title, url: t.url }, (_res) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            } catch (e) {
              reject(e as Error);
            }
          });
        } else if (op.type === OperationType.MOVE && op.nodeId) {
          const t = op.target || {};
          await moveBookmark(op.nodeId, { parentId: t.parentId, index: t.index });
        } else if (op.type === OperationType.REORDER) {
          // 批量重排序：根据children顺序设置index
          const parentId = op.target?.parentId as string | undefined;
          const children = op.target?.children || [];
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (!child.id) continue;
            await moveBookmark(child.id, { parentId, index: i });
          }
        }
      }

      // 应用完成后，刷新最新数据到视图
      await initialize();
      clearUnsaved();
      showNotification('更改已应用', 'success');
      return true;
    } catch (error) {
      logger.error('Management', '应用更改失败', error);
      showNotification(`应用失败：${(error as Error).message}`, 'error');
      return false;
    }
  };

  return {
    originalTree,
    newProposalTree,
    cleanupState,
    structuresAreDifferent,
    stagedEdits,
    hasUnsavedChanges,
    isPageLoading,
    loadingMessage,
    cacheStatus,
    isAddNewItemDialogOpen,
    addItemType,
    parentFolder,
    newItemTitle,
    newItemUrl,
    snackbar,
    snackbarText,
    snackbarColor,
    bookmarkMapping,
    originalExpandedFolders,
    proposalExpandedFolders,
    getProposalPanelTitle,
    getProposalPanelIcon,
    getProposalPanelColor,
    attachUnsavedChangesGuard,
    detachUnsavedChangesGuard,
    fastSearchBookmarks,
    fastGetBookmarkById,
    fastGetBookmarksByIds,
    updateCacheStats,
    refreshCache,
    loadFromFastCache,
    convertCachedToTreeNodes,
    handleCopySuccess,
    handleCopyFailed,
    addNewItem,
    initializeCleanupState,
    startCleanupScan,
    completeCleanupScan,
    countCleanupTreeBookmarks,
    initialize,
    showDataReadyNotification,
    rebuildOriginalIndexes,
    editBookmark,
    saveEditedBookmark,
    editFolder,
    saveEditedFolder,
    deleteBookmark,
    deleteFolder,
    handleReorder,
    confirmAddNewItemStaged,
    applyStagedChanges,
    toggleAllFolders,
    toggleOriginalFolder,
    toggleProposalFolder,
    cancelCleanupScan,
    executeCleanup,
    toggleCleanupFilter,
    resetCleanupFilters,
    toggleCleanupLegendVisibility,
    showCleanupSettings,
    hideCleanupSettings,
    saveCleanupSettings,
    resetCleanupSettings,
    updateCleanupSetting,
    setCleanupSettingsTab,
    buildBookmarkMapping,
    showNotification,
    // Re-export dialog state
    isEditBookmarkDialogOpen,
    editingBookmark,
    editTitle,
    editUrl,
    // 文件夹编辑对话框状态
    isEditFolderDialogOpen,
    editingFolder,
    editFolderTitle,
    openAddNewItemDialog
  };
});
