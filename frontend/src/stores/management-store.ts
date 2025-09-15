/**
 * Management管理页面状态管理Store
 * 管理书签管理页面的所有状态和操作
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PERFORMANCE_CONFIG, BOOKMARK_CONFIG } from '../config/constants';
import { performanceMonitor, debounce } from '../utils/performance';
// ErrorType, AppError imports removed - no longer used
import { logger } from '../utils/logger';
import { CleanupScanner } from '../utils/cleanup-scanner';
import { managementIndexedDBAdapter } from '../utils/management-indexeddb-adapter';
// Operations and analysis imports removed - IndexedDB architecture doesn't need them
import type {
  BookmarkNode,
  ChromeBookmarkTreeNode,
  // BookmarkHoverPayload, ReorderEvent removed - no longer used in IndexedDB architecture
  CacheStatus as ICacheStatus,
  StorageData,
  // DuplicateInfo, FormRef removed - no longer used in IndexedDB architecture
} from '../types';
import { DEFAULT_CLEANUP_SETTINGS, type CleanupState } from '../types/cleanup';

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

  // 搜索状态（已废弃 - IndexedDB架构下不使用）
  // const searchQuery = ref('');

  // 书签树状态
  const originalTree = ref<ChromeBookmarkTreeNode[]>([]);
  const newProposalTree = ref<ProposalNode>({
    id: 'root-empty',
    title: '等待数据源',
    children: []
  });

  // 变更追踪状态
  const structuresAreDifferent = ref(false);
  // hasDragChanges removed - drag functionality disabled in IndexedDB architecture

  // === 数据加载和缓存状态 ===

  // 性能优化：数据加载缓存机制（已废弃 - IndexedDB架构下不使用）
  // const dataLoaded = ref(false);
  // const lastDataLoadTime = ref(0);

  // 缓存统计信息
  const cacheStats = ref({
    hitRate: 0,
    itemCount: 0,
    memorySize: 0,
    lastUpdated: 0
  });

  // 防抖处理大数据集操作
  const debouncedBuildMapping = debounce((...args: unknown[]) => {
    const [originalTree, proposedTree] = args as [ChromeBookmarkTreeNode[], ProposalNode[]];
    buildBookmarkMappingImpl(originalTree, proposedTree);
  }, 300);

  // 页面加载状态
  const isPageLoading = ref(true);
  const loadingMessage = ref('正在加载书签数据...');

  // 缓存状态
  const cacheStatus = ref<CacheStatus>({
    isFromCache: false,
    lastUpdate: null,
    dataAge: null
  });

  // === AI处理状态 ===

  // AI生成状态（已废弃 - IndexedDB架构下不使用）
  // const isGenerating = ref(false);
  // const progressValue = ref(0);
  // const progressTotal = ref(0);

  // === 对话框状态 ===

  // 旧的应用确认对话框已移除，现在使用 OperationConfirmDialog

  // === 操作记录系统（已废弃 - IndexedDB架构下不使用） ===

  // 操作跟踪器（已废弃）
  // const operationTracker = new OperationTracker({
  //   maxHistorySize: 50,
  //   enableAutoSavePoint: true,
  //   batchThreshold: 5
  // });

  // 操作记录相关状态（已废弃）
  // const currentOperationSession = ref<OperationSession | null>(null);
  // const pendingDiffResult = ref<DiffResult | null>(null);
  // const isOperationConfirmDialogOpen = ref(false);
  // const isApplyingOperations = ref(false);

  // 进度跟踪状态（已废弃）
  // const operationProgress = ref({
  //   total: 0,
  //   completed: 0,
  //   currentOperation: '',
  //   percentage: 0
  // });

  // 书签编辑相关对话框
  // Edit dialog states removed - no longer used in IndexedDB architecture

  // 添加新项对话框
  const isAddNewItemDialogOpen = ref(false);
  const addItemType = ref<'folder' | 'bookmark'>('bookmark');
  const parentFolder = ref<BookmarkNode | null>(null);
  const newItemTitle = ref('');
  const newItemUrl = ref('');

  // 其他对话框（已废弃 - IndexedDB架构下不使用）
  // const isDuplicateDialogOpen = ref(false);

  // === 操作进行状态（已废弃 - IndexedDB架构下不使用） ===

  // const isAddingItem = ref(false);
  // const isEditingBookmark = ref(false);
  // const isApplyingChanges = ref(false);

  // === 通知状态 ===

  const snackbar = ref(false);
  const snackbarText = ref('');
  const snackbarColor = ref('info');

  // === 复杂数据结构状态 ===

  // 书签映射和展开状态
  const bookmarkMapping = ref<Map<string, any>>(new Map());
  const originalExpandedFolders = ref<Set<string>>(new Set());
  const proposalExpandedFolders = ref<Set<string>>(new Set());

  // === 文件夹展开模式配置 ===
  // isAccordionMode removed - no longer used in current UI

  // === 书签悬停和交互状态 ===

  // 书签悬停状态 - removed, no longer used in IndexedDB architecture

  // 重复检测状态（已废弃）
  // const duplicateInfo = ref<DuplicateInfo | null>(null);

  // 表单引用状态（已废弃）
  // const addForm = ref<FormRef>(null);

  // === 计算属性（已废弃 - IndexedDB架构下不使用） ===

  // 获取右侧面板标题（已废弃）
  // const getProposalPanelTitle = computed(() => {
  //   return '新的书签目录';
  // });

  // 获取右侧面板图标（已废弃）
  // const getProposalPanelIcon = computed(() => {
  //   if (newProposalTree.value.id === 'root-empty') {
  //     return 'mdi-plus-circle-outline';
  //   } else if (newProposalTree.value.id === 'root-cloned') {
  //     return 'mdi-database';
  //   } else if (newProposalTree.value.id === 'root-quick') {
  //     return 'mdi-flash';
  //   } else if (newProposalTree.value.id === 'root-0') {
  //     return 'mdi-magic-staff';
  //   }
  //   return 'mdi-magic-staff';
  // });

  // 获取右侧面板颜色（已废弃）
  // const getProposalPanelColor = computed(() => {
  //   if (newProposalTree.value.id === 'root-empty') {
  //     return 'grey';
  //   } else if (newProposalTree.value.id === 'root-cloned') {
  //     return 'secondary';
  //   } else if (newProposalTree.value.id === 'root-quick') {
  //     return 'info';
  //   } else if (newProposalTree.value.id === 'root-0') {
  //     return 'primary';
  //   }
  //   return 'primary';
  // });

  // 是否可以应用更改（已废弃）
  // const canApplyChanges = computed(() => {
  //   return true; // 简化逻辑，应用按钮始终可用
  // });

  // === 🚀 高性能缓存功能 ===

  /**
   * 快速搜索书签（使用内存缓存）
   */
  const fastSearchBookmarks = async (query: string, limit = 100) => {
    if (!query.trim()) return [];

    const startTime = performance.now();
    const results = await managementIndexedDBAdapter.searchBookmarks(query, limit);
    const duration = performance.now() - startTime;

    logger.info('Management', '🔍 内存搜索完成', {
      query,
      resultCount: results.length,
      searchTime: `${duration.toFixed(2)}ms`
    });

    return results;
  };

  /**
   * 根据ID快速获取书签
   */
  const fastGetBookmarkById = async (id: string) => {
    const allBookmarks = await managementIndexedDBAdapter.getBookmarkTreeData();
    return allBookmarks.bookmarks.find(b => b.id === id) || null;
  };

  /**
   * 批量获取书签
   */
  const fastGetBookmarksByIds = async (ids: string[]) => {
    const allBookmarks = await managementIndexedDBAdapter.getBookmarkTreeData();
    return ids.map(id => allBookmarks.bookmarks.find(b => b.id === id)).filter(Boolean);
  };

  /**
   * 更新缓存统计信息
   */
  const updateCacheStats = async () => {
    const stats = await managementIndexedDBAdapter.getBookmarkStats();
    cacheStats.value = {
      hitRate: stats.bookmarks > 0 ? 1 : 0,
      itemCount: stats.bookmarks,
      memorySize: stats.folders,
      lastUpdated: Date.now()
    };
  };

  /**
   * 强制刷新缓存
   */
  const refreshCache = async () => {
    try {
      // IndexedDB 不需要初始化，直接更新统计信息
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

  /**
   * 统计书签树中的书签数量
   */
  const countBookmarksInTree = (tree: ChromeBookmarkTreeNode[]): number => {
    let count = 0;

    const traverse = (nodes: ChromeBookmarkTreeNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          count++;
        } else if (node.children) {
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    return count;
  };

  /**
   * 递归处理Chrome API数据，确保书签不被错误设置children属性
   */
  const processChildrenRecursively = (children: any[]): any[] => {
    return children.map((child: any) => {
      const processedChild: any = {
        id: child.id,
        title: child.title,
        url: child.url,
        parentId: child.parentId,
        index: child.index,
        dateAdded: child.dateAdded
      };

      // 只有当子项确实是文件夹时才设置children属性
      if (child.children && Array.isArray(child.children) && child.children.length > 0) {
        processedChild.children = processChildrenRecursively(child.children);
      }

      return processedChild;
    });
  };

  /**
   * 解析URL参数
   */
  const parseUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    return mode;
  };

  /**
   * 显示通知 - 使用配置常量
   */
  const showNotification = (text: string, color: string = 'info', duration: number = PERFORMANCE_CONFIG.NOTIFICATION_HIDE_DELAY) => {
    snackbarText.value = text;
    snackbarColor.value = color;
    snackbar.value = true;

    // 自动隐藏
    setTimeout(() => {
      snackbar.value = false;
    }, duration);
  };

  /**
   * 显示数据准备完成通知
   */
  const showDataReadyNotification = (bookmarkCount: number) => {
    showNotification(`书签数据已准备就绪，共 ${bookmarkCount} 个书签`, 'success');
  };

  /**
   * 转换缓存书签为管理界面格式（支持扁平数据重建树形结构）
   */
  const convertCachedToTreeNodes = (cached: any[]): ChromeBookmarkTreeNode[] => {
    // 如果数据已经是树形结构（有children属性），直接转换
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

        // 只对有子项的文件夹设置children属性
        if (item.children && item.children.length > 0) {
          node.children = item.children.map(convert);
        }

        return node;
      };

      return cached.map(convert);
    }

    // 如果是扁平数据，重建树形结构
    console.log('🔄 重建书签树形结构，扁平数据长度:', cached.length);

    // 1. 创建节点映射
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

    // 2. 先创建所有节点
    cached.forEach(item => {
      nodeMap.set(item.id, convert(item));
    });

    // 3. 建立父子关系
    const roots: ChromeBookmarkTreeNode[] = [];
    nodeMap.forEach(node => {
      if (node.parentId && node.parentId !== '0') {
        // 有父节点的情况
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        } else {
          // 父节点不存在，当作根节点
          if (node.title && node.title.trim()) { // 只添加有标题的根节点
            roots.push(node);
          }
        }
      } else {
        // 根节点（parentId为空或'0'）
        // 过滤掉空标题和Chrome书签根节点
        if (node.title && node.title.trim() && node.id !== '0') {
          roots.push(node);
        }
      }
    });

    // 4. 按index排序子节点
    nodeMap.forEach(node => {
      if (node.children) {
        node.children.sort((a, b) => (a.index || 0) - (b.index || 0));
      }
    });

    // 5. 排序根节点
    roots.sort((a, b) => (a.index || 0) - (b.index || 0));

    console.log('✅ 树形结构重建完成，根节点数量:', roots.length);
    return roots;
  };

  /**
   * 🚀 使用高性能缓存加载数据（替代Chrome Storage）
   */
  const loadFromFastCache = async (): Promise<boolean> => {
    try {
      const startTime = performance.now();

      // 🚀 使用IndexedDB获取书签数据
      const bookmarkData = await managementIndexedDBAdapter.getBookmarkTreeData();
      const cachedBookmarks = bookmarkData.bookmarks;

      if (cachedBookmarks && cachedBookmarks.length > 0) {
        // 转换为管理界面需要的格式
        const fullTree = convertCachedToTreeNodes(cachedBookmarks);

        originalTree.value = fullTree;
        rebuildOriginalIndexes(fullTree);

        // 加载已保存的提案数据（保持兼容）
        // 注意：已迁移到IndexedDB，提案数据通过IndexedDB管理

        // 根据模式设置右侧数据
        setRightPanelFromLocalOrAI(fullTree, {});

        // 默认展开顶层文件夹
        try {
          originalExpandedFolders.value.clear();
          originalExpandedFolders.value.add('1'); // 书签栏
          originalExpandedFolders.value.add('2'); // 其他书签
          fullTree.forEach((f: ChromeBookmarkTreeNode) => {
            if (Array.isArray(f.children) && f.children.length > 0) {
              originalExpandedFolders.value.add(f.id);
            }
          });
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

        // isGenerating removed - loading state managed through IndexedDB

        // ⚡ 设置缓存状态
        const stats = await managementIndexedDBAdapter.getBookmarkStats();
        cacheStatus.value.isFromCache = stats.bookmarks > 0;
        cacheStatus.value.lastUpdate = Date.now();

        // 设置加载完成状态
        setTimeout(() => {
          isPageLoading.value = false;
          loadingMessage.value = '';
        }, 100);

        const duration = performance.now() - startTime;
        const bookmarkCount = countBookmarksInTree(fullTree);

        logger.info('Management', '⚡ 高性能缓存加载完成', {
          bookmarkCount,
          loadTime: `${duration.toFixed(2)}ms`,
          memorySize: `${(JSON.stringify(cachedBookmarks).length / 1024 / 1024).toFixed(2)}MB`,
          hitRate: `${stats.bookmarks > 0 ? '100.0' : '0.0'}%`
        });

        showDataReadyNotification(bookmarkCount);

        return true; // 表示成功加载
      }

      return false; // 表示需要从API加载

    } catch (error) {
      logger.error('Management', '高性能缓存加载失败:', error);
      isPageLoading.value = false;
      loadingMessage.value = '缓存加载失败';
      return false;
    }
  };

  /**
   * 根据进入模式设置右侧数据
   */
  const setRightPanelFromLocalOrAI = (fullTree: ChromeBookmarkTreeNode[], storageData: StorageData): void => {
    const mode = parseUrlParams();
    if (mode === 'ai' && storageData && storageData.newProposal) {
      const proposal = convertLegacyProposalToTree(storageData.newProposal);
      newProposalTree.value = { ...proposal } as any;

      // 初始化右侧面板展开状态
      try {
        proposalExpandedFolders.value.clear();
        proposalExpandedFolders.value.add('1'); // 书签栏
        proposalExpandedFolders.value.add('2'); // 其他书签
        proposalExpandedFolders.value.add('root-cloned'); // 克隆根节点
        if (proposal.children) {
          proposal.children.forEach((f: any) => {
            if (Array.isArray(f.children) && f.children.length > 0) {
              proposalExpandedFolders.value.add(f.id);
            }
          });
        }
        proposalExpandedFolders.value = new Set(proposalExpandedFolders.value);
      } catch (e) {
        console.warn('右侧面板展开状态初始化失败(AI模式):', e);
      }
    } else {
      newProposalTree.value = {
        id: 'root-cloned',
        title: '克隆的书签结构',
        children: JSON.parse(JSON.stringify(fullTree))
      } as any;

      // 初始化右侧面板展开状态（克隆模式）
      try {
        proposalExpandedFolders.value.clear();
        proposalExpandedFolders.value.add('1'); // 书签栏
        proposalExpandedFolders.value.add('2'); // 其他书签
        proposalExpandedFolders.value.add('root-cloned'); // 克隆根节点
        fullTree.forEach((f: ChromeBookmarkTreeNode) => {
          if (Array.isArray(f.children) && f.children.length > 0) {
            proposalExpandedFolders.value.add(f.id);
          }
        });
        proposalExpandedFolders.value = new Set(proposalExpandedFolders.value);
      } catch (e) {
        console.warn('右侧面板展开状态初始化失败(克隆模式):', e);
      }
    }
  };

  /**
   * 转换旧版提案格式到树格式
   */
  const convertLegacyProposalToTree = (proposal: ProposalNode | Record<string, unknown> | undefined): ProposalNode => {
    // 如果已经是ProposalNode类型，直接返回
    if (proposal && typeof proposal === 'object' && 'id' in proposal && 'title' in proposal) {
      return proposal as ProposalNode;
    }
    // 简化的转换逻辑，实际实现需要根据具体的提案格式
    const children = (proposal && typeof proposal === 'object' && 'children' in proposal)
      ? (proposal.children as ProposalNode[] || [])
      : [];
    return {
      id: 'root-0',
      title: 'AI 建议结构',
      children
    };
  };

  /**
   * 重建原始索引
   */
  const rebuildOriginalIndexes = (tree: ChromeBookmarkTreeNode[]) => {
    // 这里应该实现索引重建逻辑
    logger.info('Management', '重建原始索引', { treeLength: tree.length });
  };

  /**
   * 更新比较状态
   */
  const updateComparisonState = () => {
    // 简化的比较逻辑
    structuresAreDifferent.value = true;
  };

  /**
   * 构建书签映射实现 - 优化性能
   */
  function buildBookmarkMappingImpl(originalTree: ChromeBookmarkTreeNode[], proposedTree: ProposalNode[]) {
    performanceMonitor.startMeasure('buildBookmarkMapping', {
      originalCount: originalTree.length,
      proposedCount: proposedTree.length
    });

    try {
      bookmarkMapping.value.clear();

      // 如果数据集很大，使用优化算法
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
      performanceMonitor.endMeasure('buildBookmarkMapping');
    }
  }

  /**
   * 构建书签映射 - 防抖版本
   */
  const buildBookmarkMapping = (originalTree: ChromeBookmarkTreeNode[], proposedTree: ProposalNode[]) => {
    debouncedBuildMapping(originalTree, proposedTree);
  };

  /**
   * 当从Chrome直接拉取并回填缓存时恢复原始树（已废弃 - IndexedDB架构下不使用）
   */
  // const recoverOriginalTreeFromChrome = async (): Promise<ChromeBookmarkTreeNode[]> => {
  //   // 功能已移除
  // };

  // === 对话框操作函数 ===

  /**
   * 打开编辑书签对话框
   */
  // openEditBookmarkDialog removed - no longer used in IndexedDB architecture

  /**
   * 关闭编辑书签对话框（已废弃）
   */
  // const closeEditBookmarkDialog = () => {
  //   // 功能已移除
  // };

  // 删除对话框相关函数已移除 - 现在直接在预览状态下删除

  /**
   * 打开添加新项对话框
   */
  const openAddNewItemDialog = (type: 'folder' | 'bookmark', parent: BookmarkNode | null = null) => {
    addItemType.value = type;
    parentFolder.value = parent;
    newItemTitle.value = '';
    newItemUrl.value = '';
    isAddNewItemDialogOpen.value = true;
  };

  /**
   * 关闭添加新项对话框（已废弃）
   */
  // const closeAddNewItemDialog = () => {
  //   // 功能已移除
  // };

  // === 展开/折叠操作 ===

  /**
   * 智能切换所有文件夹展开状态（已废弃）
   * 如果大部分文件夹已展开，则全部收起；否则全部展开
   */
  // const toggleAllFolders = (isOriginal: boolean) => {
  //   // 功能已废弃
  // };

  /**
   * 获取同级文件夹ID列表
   */
  // getSiblingFolderIds removed - no longer needed in IndexedDB architecture

  /**
   * 切换左侧面板文件夹展开状态（已废弃）
   */
  // const toggleOriginalFolder = (nodeId: string) => {
  //   // 功能已废弃
  // };

  /**
   * 切换右侧面板文件夹展开状态（已废弃）
   */
  // const toggleProposalFolder = (nodeId: string) => {
  //   // 功能已废弃
  // };

  /**
   * 切换手风琴模式（已废弃）
   */
  // const toggleAccordionMode = () => {
  //   // 功能已废弃
  // };

  // === 书签悬停操作 ===

  // setBookmarkHover removed - no longer used in IndexedDB architecture

  // === 书签操作 ===

  // deleteBookmark removed - no longer used in IndexedDB architecture

  // deleteFolder removed - no longer used in IndexedDB architecture

  // editBookmark removed - no longer used in IndexedDB architecture

  // 从书签树中移除项目的辅助函数
  const removeBookmarkFromTree = (tree: BookmarkNode[], bookmarkId: string): boolean => {
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

  // handleReorder removed - no longer used in IndexedDB architecture

  // triggerComplexityAnalysisAfterDrag 函数已移除 - IndexedDB架构下不再适用

  /**
   * 复制成功处理
   */
  const handleCopySuccess = () => {
    showNotification('链接已复制到剪贴板', 'success', 2000);
  };

  /**
   * 复制失败处理
   */
  const handleCopyFailed = () => {
    showNotification('复制链接失败', 'error', 2000);
  };

  // === 添加新项目功能 ===

  /**
   * 添加新项目
   */
  const addNewItem = (parentNode: BookmarkNode) => {
    openAddNewItemDialog('bookmark', parentNode);
  };

  // === 清理功能状态和Actions (完全独立) ===

  // 清理状态
  const cleanupState = ref<CleanupState | null>(null);

  // 清理扫描器实例
  let cleanupScanner: CleanupScanner | null = null;

  // 初始化清理状态
  const initializeCleanupState = async () => {
    if (!cleanupState.value) {
      // 尝试加载保存的设置
      let savedSettings = { ...DEFAULT_CLEANUP_SETTINGS };
      try {
        // 注意：已迁移到IndexedDB，清理设置通过IndexedDB管理
        // 使用默认设置
        savedSettings = { ...DEFAULT_CLEANUP_SETTINGS };
        logger.info('Cleanup', '使用默认清理设置（已迁移到IndexedDB）');
      } catch (error) {
        logger.warn('Cleanup', '加载设置失败，使用默认设置', error);
      }

      cleanupState.value = {
        isFiltering: false,
        activeFilters: ['404', 'duplicate', 'empty', 'invalid'], // 默认全部选中
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

  // 开始清理扫描
  const startCleanupScan = async () => {
    await initializeCleanupState();
    if (!cleanupState.value) return;

    // 检查是否有可扫描的数据
    if (!newProposalTree.value.children || newProposalTree.value.children.length === 0) {
      showNotification('右侧面板没有数据，请先加载书签数据', 'warning');
      return;
    }

    cleanupState.value.isScanning = true;
    cleanupState.value.tasks = [];
    cleanupState.value.filterResults.clear();

    // 创建扫描器实例（如果尚未存在）
    if (!cleanupScanner) {
      cleanupScanner = new CleanupScanner();
    }

    // 准备扫描任务
    const scanTasks = cleanupState.value.activeFilters.map(filterType => ({
      type: filterType,
      status: 'pending' as const,
      processed: 0,
      total: 0,
      foundIssues: 0
    }));

    cleanupState.value.tasks = scanTasks;

    // 开始扫描过程
    try {
      // 进度处理回调
      // Progress and result callbacks removed - cleanup scanner integration disabled

      // 启动扫描 - TODO: Implement proper CleanupScanner integration
      // await cleanupScanner.scan(
      //   newProposalTree.value.children || [],
      //   cleanupState.value.activeFilters,
      //   cleanupState.value.settings,
      //   onProgress,
      //   onResult
      // );

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

  // 完成清理扫描
  const completeCleanupScan = () => {
    if (!cleanupState.value) return;

    // 标记完成状态
    cleanupState.value.justCompleted = true;
    cleanupState.value.isScanning = false;

    // 清理扫描完成后的处理
    logger.info('Cleanup', '清理扫描已完成', {
      activeFilters: cleanupState.value.activeFilters,
      resultCount: Array.from(cleanupState.value.filterResults.values()).flat().length
    });
  };

  // 计算清理树中书签数量的辅助函数
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

  // === Temporary stub variables for components - TODO: Remove after full migration ===
  const searchQuery = ref('');
  const isGenerating = ref(false);
  const isDuplicateDialogOpen = ref(false);
  const duplicateInfo = ref<any>(null);
  // addForm removed - no longer using Vuetify form validation
  const isAddingItem = ref(false);
  const isEditingBookmark = ref(false);
  const currentOperationSession = ref(null);
  const pendingDiffResult = ref(null);
  const isOperationConfirmDialogOpen = ref(false);
  const isApplyingOperations = ref(false);
  const operationProgress = ref<{ total: number; completed: number; currentOperation: string; percentage: number; } | undefined>(undefined);
  const hoveredBookmarkId = ref<string | null>(null);
  const isAccordionMode = ref(false);

  // Add missing variables 
  const hasDragChanges = ref(false);
  const isEditBookmarkDialogOpen = ref(false);
  const editingBookmark = ref<BookmarkNode | null>(null);
  const editTitle = ref('');
  const editUrl = ref('');

  // Stub methods with proper signatures
  const initialize = () => console.log('initialize - TODO: implement');
  const editBookmark = (..._args: any[]) => console.log('editBookmark - TODO: implement', _args);
  const deleteBookmark = (..._args: any[]) => console.log('deleteBookmark - TODO: implement', _args);
  const deleteFolder = (..._args: any[]) => console.log('deleteFolder - TODO: implement', _args);
  const setBookmarkHover = (..._args: any[]) => console.log('setBookmarkHover - TODO: implement', _args);
  const handleReorder = (..._args: any[]) => console.log('handleReorder - TODO: implement', _args);
  const toggleAllFolders = (..._args: any[]) => console.log('toggleAllFolders - TODO: implement', _args);
  const toggleAccordionMode = () => console.log('toggleAccordionMode - TODO: implement');
  const toggleOriginalFolder = (..._args: any[]) => console.log('toggleOriginalFolder - TODO: implement', _args);
  const toggleProposalFolder = (..._args: any[]) => console.log('toggleProposalFolder - TODO: implement', _args);
  const cancelCleanupScan = () => console.log('cancelCleanupScan - TODO: implement');
  const executeCleanup = () => console.log('executeCleanup - TODO: implement');
  const toggleCleanupFilter = (..._args: any[]) => console.log('toggleCleanupFilter - TODO: implement', _args);
  const resetCleanupFilters = () => console.log('resetCleanupFilters - TODO: implement');
  const toggleCleanupLegendVisibility = (..._args: any[]) => console.log('toggleCleanupLegendVisibility - TODO: implement', _args);
  const showCleanupSettings = () => console.log('showCleanupSettings - TODO: implement');
  const hideCleanupSettings = () => console.log('hideCleanupSettings - TODO: implement');
  const saveCleanupSettings = () => console.log('saveCleanupSettings - TODO: implement');
  const resetCleanupSettings = (..._args: any[]) => console.log('resetCleanupSettings - TODO: implement', _args);
  const updateCleanupSetting = (..._args: any[]) => console.log('updateCleanupSetting - TODO: implement', _args);
  const setCleanupSettingsTab = (..._args: any[]) => console.log('setCleanupSettingsTab - TODO: implement', _args);
  const startOperationSession = () => console.log('startOperationSession - TODO: implement');
  const endOperationSession = () => console.log('endOperationSession - TODO: implement');
  const analyzeOperationDiff = () => console.log('analyzeOperationDiff - TODO: implement');
  const showOperationConfirmDialog = () => console.log('showOperationConfirmDialog - TODO: implement');
  const hideOperationConfirmDialog = () => console.log('hideOperationConfirmDialog - TODO: implement');
  const confirmAndApplyOperations = () => console.log('confirmAndApplyOperations - TODO: implement');
  const recordAIRegenerate = () => console.log('recordAIRegenerate - TODO: implement');
  const getProposalPanelTitle = () => 'IndexedDB Data';
  const getProposalPanelIcon = () => 'mdi-database';
  const getProposalPanelColor = () => 'primary';

  return {
    // 导出所有状态
    originalTree,
    newProposalTree,
    cleanupState,
    searchQuery,
    structuresAreDifferent,
    hasDragChanges,
    isPageLoading,
    loadingMessage,
    cacheStatus,
    isGenerating,
    isEditBookmarkDialogOpen,
    isAddNewItemDialogOpen,
    isDuplicateDialogOpen,
    editingBookmark,
    editTitle,
    editUrl,
    addItemType,
    parentFolder,
    newItemTitle,
    newItemUrl,
    duplicateInfo,
    isAddingItem,
    isEditingBookmark,
    currentOperationSession,
    pendingDiffResult,
    isOperationConfirmDialogOpen,
    isApplyingOperations,
    operationProgress,
    snackbar,
    snackbarText,
    snackbarColor,
    bookmarkMapping,
    originalExpandedFolders,
    proposalExpandedFolders,
    hoveredBookmarkId,
    isAccordionMode,
    getProposalPanelTitle,
    getProposalPanelIcon,
    getProposalPanelColor,
    // 导出所有操作
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
    // Stub methods for backward compatibility
    initialize,
    parseUrlParams,
    showDataReadyNotification,
    rebuildOriginalIndexes,
    editBookmark,
    deleteBookmark,
    deleteFolder,
    setBookmarkHover,
    handleReorder,
    toggleAllFolders,
    toggleAccordionMode,
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
    startOperationSession,
    endOperationSession,
    analyzeOperationDiff,
    showOperationConfirmDialog,
    hideOperationConfirmDialog,
    confirmAndApplyOperations,
    recordAIRegenerate
  };
});
