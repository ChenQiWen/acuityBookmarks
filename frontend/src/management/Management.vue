<script setup lang="ts">
import { onMounted, nextTick, watch, onUnmounted, ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useManagementStore } from '../stores/management-store';
import { PERFORMANCE_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';
import { managementIndexedDBAdapter } from '../utils/management-indexeddb-adapter';
import BookmarkTree from './BookmarkTree.vue';
import {
  CleanupToolbar,
  CleanupLegend,
  CleanupProgress,
  CleanupSettings
} from './cleanup';
import OperationConfirmDialog from '../components/OperationConfirmDialog.vue';

// AcuityUI Components
import {
  App,
  AppBar,
  Main,
  Card,
  Button,
  Icon,
  Grid,
  Overlay,
  Spinner,
  Divider,
  Dialog,
  Spacer,
  Input,
  Tabs,
  Toast
} from '../components/ui';
import type {
  BookmarkNode,
  ChromeBookmarkTreeNode,
  AnalysisData,
  ApplicationStrategy,
} from '../types';

// === 使用 Pinia Stores ===
const managementStore = useManagementStore();

// 🧪 开发环境：导入测试工具
if (import.meta.env.DEV) {
  // import('../utils/cache-integration-test') // 已移除测试文件
  // 移除开发示例文件引用
}

// 🎯 React-like书签管理架构已完成！
// 
// 核心理念："右侧提案树 = 虚拟DOM，Chrome API = 真实DOM"
//
// 已实现组件：
// ✅ 智能差异引擎 (smart-bookmark-diff-engine) - 类似React Diff算法
// ✅ 批量执行器 (smart-bookmark-executor) - 类似React批量更新
// ✅ 智能管理器 (smart-bookmark-manager) - 统一接口
// ✅ 高性能缓存 (fast-bookmark-cache) - 极速数据访问
// ✅ 概念验证 (react-like-bookmark-concept) - 架构展示
//
// 性能提升：5-15倍 🚀
// 开发调试：window.__REACT_LIKE_CONCEPT__.showConcept()
//          window.__SMART_BOOKMARK_EXAMPLES__.runAllExamples()

// 解构响应式状态
const {
  // 核心数据状态
  searchQuery,
  originalTree,
  newProposalTree,
  structuresAreDifferent,
  hasDragChanges,

  // 加载和缓存状态
  isPageLoading,
  loadingMessage,
  cacheStatus,

  // AI处理状态
  isGenerating,
  // progressValue, // 注意：已迁移到IndexedDB
  // progressTotal, // 注意：已迁移到IndexedDB

  // 对话框状态  
  isEditBookmarkDialogOpen,
  isAddNewItemDialogOpen,
  isDuplicateDialogOpen,

  // 编辑状态
  editingBookmark,
  editTitle,
  editUrl,
  addItemType,
  parentFolder,
  newItemTitle,
  newItemUrl,
  duplicateInfo,
  addForm,

  // 操作状态
  isAddingItem,
  isEditingBookmark,

  // 操作记录状态
  currentOperationSession,
  pendingDiffResult,
  isOperationConfirmDialogOpen,
  isApplyingOperations,
  operationProgress,

  // 通知状态
  snackbar,
  snackbarText,
  snackbarColor,

  // 复杂状态
  bookmarkMapping,
  originalExpandedFolders,
  proposalExpandedFolders,
  hoveredBookmarkId,

  // 展开模式配置
  isAccordionMode,

  // 计算属性
  getProposalPanelTitle,
  getProposalPanelIcon,
  getProposalPanelColor,

  // 清理功能状态 
  cleanupState
} = storeToRefs(managementStore);

// 解构 actions (不需要 storeToRefs)
const {
  // 初始化
  initialize,
  // 工具函数
  parseUrlParams,
  showDataReadyNotification,
  // 数据操作
  // setRightPanelFromLocalOrAI, // 注意：已迁移到IndexedDB
  // recoverOriginalTreeFromChrome, // 注意：已迁移到IndexedDB
  rebuildOriginalIndexes,
  // 书签操作
  editBookmark,
  addNewItem,
  // 展开/折叠操作
  toggleAllFolders,
  toggleAccordionMode,
  // 清理功能actions
  startCleanupScan,
  completeCleanupScan,
  cancelCleanupScan,
  executeCleanup,
  toggleCleanupFilter,
  resetCleanupFilters,
  toggleCleanupLegendVisibility,
  showCleanupSettings,
  hideCleanupSettings,

  // 操作记录actions
  startOperationSession,
  endOperationSession,
  analyzeOperationDiff,
  showOperationConfirmDialog,
  hideOperationConfirmDialog,
  confirmAndApplyOperations,
  recordAIRegenerate
} = managementStore;

// 为了避免未使用变量警告，将清理actions暴露给模板
const cleanupActions = {
  startCleanupScan,
  completeCleanupScan,
  cancelCleanupScan,
  executeCleanup,
  toggleCleanupFilter,
  resetCleanupFilters,
  toggleCleanupLegendVisibility,
  showCleanupSettings,
  hideCleanupSettings,

  // 操作记录actions
  startOperationSession,
  endOperationSession,
  analyzeOperationDiff,
  showOperationConfirmDialog,
  hideOperationConfirmDialog,
  confirmAndApplyOperations,
  recordAIRegenerate
};

// 性能优化：数据加载缓存机制 - 使用配置常量
let dataLoaded = false;
let lastDataLoadTime = 0;

// （已移除树比较，应用按钮始终可用）
// （移除比较缓存机制）
// 应用按钮始终可用（移除比较与监听逻辑）
// 确认对话框统计已移除
// 取消左右面板数据变化监听（保留占位变量已移除）

// 注意：面板相关的计算属性和URL解析现在都在store中

// 注意：setRightPanelFromLocalOrAI, showDataReadyNotification, recoverOriginalTreeFromChrome, loadFromChromeStorage
// 这些函数现在都在store中，通过actions访问

// 本地搜索功能已移至超级缓存系统实现

// 强制刷新旧逻辑已移除
// 测试数据同步功能（已移除触发按钮，保留函数无用）


// 注意：以下所有状态变量现在都在store中，通过storeToRefs解构使用：
// isGenerating, progressValue, progressTotal, isPageLoading, loadingMessage, cacheStatus,
// snackbar, snackbarText, snackbarColor,
// isEditBookmarkDialogOpen, isDeleteBookmarkDialogOpen, isDeleteFolderDialogOpen,
// editingBookmark, deletingBookmark, deletingFolder, editTitle, editUrl,
// isAddNewItemDialogOpen, addItemType, parentFolder, newItemTitle, newItemUrl,
// isDuplicateDialogOpen, duplicateInfo, addForm, isCancelConfirmDialogOpen,
// isAddingItem, isEditingBookmark, isDeletingBookmark, isDeletingFolder, isApplyingChanges,
// hoveredBookmarkId, bookmarkMapping, originalExpandedFolders, proposalExpandedFolders

// 本地状态和工具函数
const originalIdToNode = ref<Map<string, any>>(new Map());
const originalIdToAncestors = ref<Map<string, BookmarkNode[]>>(new Map());
const originalIdToParentId = ref<Map<string, string>>(new Map());

// --- Fingerprint & Refresh ---
// 轻量指纹：稳定遍历顺序下，记录节点类型/id/children count/url长 等，生成短哈希
const hashString = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
};

const buildFingerprintFromFullTree = (nodes: ChromeBookmarkTreeNode[]): string => {
  const parts: string[] = [];
  const walk = (arr: ChromeBookmarkTreeNode[]) => {
    for (const n of arr) {
      if (n && n.url) {
        parts.push(`B:${n.id}:${(n.title || '').length}:${(n.url || '').length}`);
      } else {
        const count = Array.isArray(n?.children) ? n.children.length : 0;
        parts.push(`F:${n?.id}:${(n?.title || '').length}:${count}`);
        if (count > 0) walk(n.children || []);
      }
    }
  };
  walk(nodes);
  return hashString(parts.join('|'));
};

// 从 [root] 结构提取 fullTree（两个顶级容器）
const extractFullTreeFromRoot = (rootTree: ChromeBookmarkTreeNode[]): ChromeBookmarkTreeNode[] => {
  const full: ChromeBookmarkTreeNode[] = [];
  if (Array.isArray(rootTree) && rootTree.length > 0) {
    const rootNode = rootTree[0];
    if (rootNode && Array.isArray(rootNode.children)) {
      rootNode.children.forEach((folder: ChromeBookmarkTreeNode) => full.push(folder));
    }
  }
  return full;
};

// 校验 storage 与 live 是否一致，不一致则以 live 覆盖 storage 与界面
const refreshFromChromeIfOutdated = () => {
  try {
    chrome.bookmarks.getTree((tree) => {
      try { logger.info('Management', '📚 chrome.bookmarks.getTree 返回原始数据 [root]:', tree); } catch { }
      const liveFull = extractFullTreeFromRoot(tree as ChromeBookmarkTreeNode[]);
      try { logger.info('Management', '📚 提取后的 fullTree（两个顶层容器）:', liveFull); } catch { }
      const liveFp = buildFingerprintFromFullTree(liveFull);
      const localFp = buildFingerprintFromFullTree(originalTree.value);
      if (liveFp !== localFp) {
        try {
          logger.info('Management', '检测到书签变化，自动刷新缓存');
        } catch { }
        originalTree.value = liveFull;
        rebuildOriginalIndexes(liveFull);
        // 注意：不再使用chrome.storage.local，数据已存储在IndexedDB中
        // 非 AI 模式默认让右侧镜像左侧
        // setRightPanelFromLocalOrAI(liveFull, {}); // 暂时注释，由store处理
        // 保持顶层展开
        try {
          originalExpandedFolders.value.clear();
          liveFull.forEach((f: ChromeBookmarkTreeNode) => {
            if (Array.isArray(f.children) && f.children.length > 0) {
              originalExpandedFolders.value.add(f.id);
            }
          });
          originalExpandedFolders.value = new Set(originalExpandedFolders.value);
        } catch { }
      }
    });
  } catch { }
};

// Generate unique ID for each bookmark instance
const generateBookmarkId = (node: BookmarkNode): string => {
  if (!node || !node.url) return '';

  // Create truly unique ID by including node ID and other properties
  const identifier = `${node.id || 'no-id'}|${node.url}|${node.title || ''}|${node.dateAdded || ''
    }`;
  try {
    // Encode the string to handle Unicode characters
    const encoded = encodeURIComponent(identifier);
    return btoa(encoded)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16);
  } catch {
    // Fallback: use a simple hash if encoding fails
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }
};

// --- 简单的复杂度分析功能 ---

/**
 * 测试复杂度分析功能 - 基于Chrome API应用复杂度的完整分析
 */
const testComplexityAnalysis = () => {
  try {
    let analysis, strategy;

    // 🎯 检查是否有拖拽后的缓存分析结果
    const cached = (window as any)._cachedComplexityAnalysis;
    if (cached && cached.isDragTriggered && (Date.now() - cached.timestamp) < 5000) {
      // 使用5秒内的缓存结果
      console.log('✅ 使用拖拽后的缓存复杂度分析结果');
      ({ analysis, strategy } = cached);

      // 🛡️ 安全检查：确保缓存数据结构完整
      if (!analysis || !analysis.stats || !strategy) {
        console.warn('⚠️ 缓存数据结构不完整，重新执行分析');
        throw new Error('缓存数据不完整');
      }
    } else {
      // 重新执行分析
      console.log('🔄 执行新的复杂度分析');
      const originalData = originalTree.value || [];
      const proposedData = newProposalTree.value.children || [];

      analysis = analyzeBookmarkChanges(originalData, proposedData);
      strategy = calculateApplicationStrategy(analysis);
    }

    // 🛡️ 最终安全检查：确保数据结构完整
    if (!analysis || !analysis.stats || typeof analysis.stats.originalTotal === 'undefined') {
      throw new Error('分析数据结构不完整，缺少 stats.originalTotal');
    }

    if (!strategy || typeof strategy.changePercentage === 'undefined') {
      throw new Error('策略数据结构不完整，缺少 changePercentage');
    }

    console.log('🔍 最终分析数据验证:', {
      analysis: !!analysis,
      stats: !!analysis.stats,
      originalTotal: analysis.stats.originalTotal,
      strategy: !!strategy,
      changePercentage: strategy.changePercentage
    });

    // 显示详细分析报告
    showAnalysisReport(analysis, strategy);

  } catch (error) {
    console.error('🚨 复杂度分析详细错误:', error);

    // 🚨 更友好的错误提示
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    alert(`复杂度分析失败: ${errorMsg}\n\n建议：\n1. 重新拖拽操作后再试\n2. 刷新页面重新加载数据\n3. 检查控制台获取详细错误信息`);
  }
};

/**
 * 拖拽后自动触发复杂度分析 - 静默执行，更新缓存的复杂度数据
 */
const triggerComplexityAnalysisAfterDrag = () => {
  try {
    // 获取原始和目标数据
    const originalData = originalTree.value || [];
    const proposedData = newProposalTree.value.children || [];

    // 🔍 调试：检查数据是否有变化
    console.log('🎯 拖拽后复杂度分析:', {
      原始数据长度: originalData.length,
      目标数据长度: proposedData.length,
      拖拽标记: hasDragChanges.value,
      结构是否不同: structuresAreDifferent.value
    });

    // 执行完整的变化分析
    const analysis = analyzeBookmarkChanges(originalData, proposedData);

    // 基于Chrome API操作复杂度计算应用策略
    const strategy = calculateApplicationStrategy(analysis);

    // 🎯 缓存复杂度分析结果，而不是立即显示
    (window as any)._cachedComplexityAnalysis = {
      analysis,
      strategy,
      timestamp: Date.now(),
      isDragTriggered: true
    };

    // 🔍 调试：输出分析结果
    console.log('🎯 拖拽复杂度分析结果:', {
      变化幅度: `${strategy.changePercentage}%`,
      复杂度评分: strategy.complexityScore,
      操作总数: strategy.totalOperations,
      策略: strategy.strategy
    });

    // 如果检测到变化，可以显示一个轻量级提示
    if (strategy.changePercentage > 0) {
      console.log(`✅ 检测到书签结构变化: ${strategy.changePercentage}%`);
    }

  } catch (error) {
    console.warn('拖拽后复杂度分析失败:', error);
  }
};

/**
 * 完整的书签变化分析 - 基于Chrome API操作复杂度
 */
const analyzeBookmarkChanges = (originalData: ChromeBookmarkTreeNode[], proposedData: BookmarkNode[]): AnalysisData => {
  // 创建基于ID的映射（Chrome API以ID为准）
  const originalItems = new Map<string, BookmarkNode>();
  const proposedItems = new Map<string, BookmarkNode>();

  // 类型转换辅助函数
  const ensureBookmarkNode = (node: ChromeBookmarkTreeNode | BookmarkNode): BookmarkNode => {
    const bookmarkNode: any = {
      id: node.id,
      title: node.title,
      url: node.url,
      parentId: node.parentId,
      index: node.index,
      dateAdded: node.dateAdded,
      expanded: node.expanded,
      uniqueId: node.uniqueId,
      faviconUrl: (node as BookmarkNode).faviconUrl
    };

    // 只对文件夹节点设置children属性
    if (node.children && Array.isArray(node.children)) {
      bookmarkNode.children = node.children as BookmarkNode[];
    }

    return bookmarkNode;
  };

  // 收集所有项目信息（优化版本）
  const collectItems = (nodes: (ChromeBookmarkTreeNode | BookmarkNode)[], map: Map<string, BookmarkNode>, parentPath: string = '', parentId: string = '') => {
    for (let i = 0; i < (nodes || []).length; i++) {
      const node = nodes[i];
      const fullPath = parentPath ? `${parentPath}/${node.title}` : node.title;

      // 使用Chrome书签ID作为唯一标识
      const uniqueId = node.id || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 检测特殊文件夹（根据Chrome API文档）
      const isSpecialFolder = ['书签栏', '其他书签', '移动设备书签', '受管理书签'].includes(node.title) ||
        ['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks', 'Managed bookmarks'].includes(node.title);

      const bookmarkNode = ensureBookmarkNode(node);

      // 🎯 使用实际数组位置作为索引，确保拖拽后能检测到位置变化
      const actualIndex = node.index !== undefined ? node.index : i;

      map.set(uniqueId, {
        ...bookmarkNode,
        path: fullPath,
        parentPath,
        parentId,
        type: node.url ? 'bookmark' : 'folder',
        hasChildren: !!(node.children && node.children.length > 0),
        isSpecialFolder,
        // 添加Chrome API相关属性 - 🎯 使用实际位置索引
        index: actualIndex,
        dateAdded: node.dateAdded,
        unmodifiable: node.unmodifiable
      });

      if (node.children) {
        collectItems(node.children, map, fullPath, node.id);
      }
    }
  };

  collectItems(originalData, originalItems);
  collectItems(proposedData, proposedItems);

  // 过滤掉特殊文件夹（Chrome API不允许修改）
  const filterSpecialFolders = (map: Map<string, any>) => {
    const filtered = new Map<string, any>();
    for (const [id, item] of map) {
      if (!item.isSpecialFolder) {
        filtered.set(id, item);
      }
    }
    return filtered;
  };

  // 使用过滤后的数据进行分析（排除特殊文件夹）
  const workingOriginal = filterSpecialFolders(originalItems);
  const workingProposed = filterSpecialFolders(proposedItems);

  // 分析变化（基于可修改的项目）
  const analysis = {
    // 基础统计
    stats: {
      originalTotal: workingOriginal.size,
      proposedTotal: workingProposed.size,
      originalBookmarks: Array.from(workingOriginal.values()).filter(item => item.type === 'bookmark').length,
      proposedBookmarks: Array.from(workingProposed.values()).filter(item => item.type === 'bookmark').length,
      originalFolders: Array.from(workingOriginal.values()).filter(item => item.type === 'folder').length,
      proposedFolders: Array.from(workingProposed.values()).filter(item => item.type === 'folder').length,
      // 添加特殊文件夹统计
      specialFoldersCount: originalItems.size - workingOriginal.size
    },

    // Chrome API操作分析
    operations: {
      // 创建操作
      bookmarksToCreate: 0,
      foldersToCreate: 0,

      // 删除操作
      bookmarksToDelete: 0,
      foldersToDelete: 0,

      // 更新操作
      bookmarksToRename: 0,
      foldersToRename: 0,
      bookmarksToUpdateUrl: 0,

      // 移动操作
      bookmarksToMove: 0,
      foldersToMove: 0,

      // 复杂操作
      structureReorganization: 0,
      deepFolderChanges: 0
    },

    // 详细变化列表
    changes: {
      created: [] as BookmarkNode[],
      deleted: [] as BookmarkNode[],
      renamed: [] as Array<{ original: BookmarkNode; proposed: BookmarkNode; type: string }>,
      moved: [] as Array<{ original: BookmarkNode; proposed: BookmarkNode; type: string }>,
      urlChanged: [] as Array<{ original: BookmarkNode; proposed: BookmarkNode; type: string }>
    }
  };

  // 使用更智能的匹配算法（基于可修改项目）
  // 首先尝试基于ID匹配，然后基于内容匹配
  const matchedPairs = new Map<string, string>(); // originalId -> proposedId
  const unmatchedOriginal = new Set(workingOriginal.keys());
  const unmatchedProposed = new Set(workingProposed.keys());

  // 第一轮：精确ID匹配
  for (const originalId of workingOriginal.keys()) {
    if (workingProposed.has(originalId)) {
      matchedPairs.set(originalId, originalId);
      unmatchedOriginal.delete(originalId);
      unmatchedProposed.delete(originalId);
    }
  }

  // 第二轮：基于内容匹配（用于检测重命名等）
  for (const originalId of Array.from(unmatchedOriginal)) {
    const originalItem = workingOriginal.get(originalId);

    for (const proposedId of Array.from(unmatchedProposed)) {
      const proposedItem = workingProposed.get(proposedId);

      // 匹配条件：相同类型 + 相同URL（书签）或相似路径结构（文件夹）
      let isMatch = false;

      if (originalItem.type === 'bookmark' && proposedItem.type === 'bookmark') {
        // 书签：URL相同就认为是同一个书签
        isMatch = originalItem.url === proposedItem.url;
      } else if (originalItem.type === 'folder' && proposedItem.type === 'folder') {
        // 文件夹：父路径相同且只有名称变化，或者parentId相同
        isMatch = (originalItem.parentPath === proposedItem.parentPath) ||
          (originalItem.parentId === proposedItem.parentId && originalItem.parentId);
      }

      if (isMatch) {
        matchedPairs.set(originalId, proposedId);
        unmatchedOriginal.delete(originalId);
        unmatchedProposed.delete(proposedId);
        break;
      }
    }
  }

  // 分析匹配的项目（检测修改）
  for (const [originalId, proposedId] of matchedPairs) {
    const originalItem = workingOriginal.get(originalId);
    const proposedItem = workingProposed.get(proposedId);

    // 检测重命名（title变化）
    if (originalItem.title !== proposedItem.title) {
      analysis.changes.renamed.push({
        original: originalItem,
        proposed: proposedItem,
        type: 'rename'
      });
      if (proposedItem.type === 'bookmark') {
        analysis.operations.bookmarksToRename++;
      } else {
        analysis.operations.foldersToRename++;
      }
    }

    // 检测URL变化（仅书签）
    if (proposedItem.type === 'bookmark' && originalItem.url !== proposedItem.url) {
      analysis.changes.urlChanged.push({
        original: originalItem,
        proposed: proposedItem,
        type: 'url_change'
      });
      analysis.operations.bookmarksToUpdateUrl++;
    }

    // 检测移动（父路径变化或索引变化）
    const parentChanged = originalItem.parentPath !== proposedItem.parentPath ||
      originalItem.parentId !== proposedItem.parentId;
    const indexChanged = originalItem.index !== proposedItem.index;

    if (parentChanged || indexChanged) {
      analysis.changes.moved.push({
        original: originalItem,
        proposed: proposedItem,
        type: parentChanged ? 'parent_move' : 'index_move'
      });
      if (proposedItem.type === 'bookmark') {
        analysis.operations.bookmarksToMove++;
      } else {
        analysis.operations.foldersToMove++;
        // 移动文件夹会影响所有子项目
        if (proposedItem.hasChildren) {
          analysis.operations.structureReorganization++;
        }
      }
    }
  }

  // 分析未匹配的项目
  // 删除的项目
  for (const originalId of unmatchedOriginal) {
    const originalItem = workingOriginal.get(originalId);
    analysis.changes.deleted.push(originalItem);
    if (originalItem.type === 'bookmark') {
      analysis.operations.bookmarksToDelete++;
    } else {
      analysis.operations.foldersToDelete++;
      if (originalItem.hasChildren) {
        analysis.operations.deepFolderChanges++;
      }
    }
  }

  // 新增的项目
  for (const proposedId of unmatchedProposed) {
    const proposedItem = workingProposed.get(proposedId);
    analysis.changes.created.push(proposedItem);
    if (proposedItem.type === 'bookmark') {
      analysis.operations.bookmarksToCreate++;
    } else {
      analysis.operations.foldersToCreate++;
    }
  }

  return analysis;
};

/**
 * 基于Chrome API操作复杂度计算应用策略
 * 根据Chrome Bookmarks API文档优化评分系统
 */
const calculateApplicationStrategy = (analysis: AnalysisData): ApplicationStrategy => {
  const { operations, stats } = analysis;

  // 计算Chrome API操作总数
  const totalOperations =
    operations.bookmarksToCreate + operations.foldersToCreate +
    operations.bookmarksToDelete + operations.foldersToDelete +
    operations.bookmarksToRename + operations.foldersToRename +
    operations.bookmarksToUpdateUrl +
    operations.bookmarksToMove + operations.foldersToMove;

  // 基于Chrome API文档的精确复杂度权重
  let complexityScore = 0;

  // Chrome API操作复杂度（基于实际API调用成本）
  complexityScore += operations.bookmarksToCreate * 1;      // chrome.bookmarks.create() - 简单
  complexityScore += operations.foldersToCreate * 1;        // chrome.bookmarks.create() - 同样简单
  complexityScore += operations.bookmarksToDelete * 1;      // chrome.bookmarks.remove() - 简单
  complexityScore += operations.foldersToDelete * 3;        // chrome.bookmarks.removeTree() - 递归删除
  complexityScore += operations.bookmarksToRename * 1;      // chrome.bookmarks.update() - 简单
  complexityScore += operations.foldersToRename * 1;        // chrome.bookmarks.update() - 同样简单
  complexityScore += operations.bookmarksToUpdateUrl * 1;   // chrome.bookmarks.update() - 简单
  complexityScore += operations.bookmarksToMove * 2;        // chrome.bookmarks.move() - 需要更新索引
  complexityScore += operations.foldersToMove * 4;          // chrome.bookmarks.move() - 影响子项目索引

  // 结构复杂度权重（基于API调用连锁反应）
  complexityScore += operations.structureReorganization * 8; // 多个move操作的连锁反应
  complexityScore += operations.deepFolderChanges * 5;       // removeTree的影响范围

  // 计算变化百分比
  const changePercentage = (totalOperations / Math.max(stats.originalTotal, 1)) * 100;

  // 基于Chrome API特性的智能策略决策
  let strategy: 'no-change' | 'minor-update' | 'incremental' | 'full-rebuild' = 'minor-update';
  let reason = '';
  let estimatedTime = 0;
  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'low';
  let apiCalls = totalOperations;

  if (complexityScore === 0) {
    strategy = 'no-change';
    reason = '未检测到任何变化';
    estimatedTime = 0;
    riskLevel = 'none';
  } else if (complexityScore <= 3 && totalOperations <= 5 && operations.foldersToDelete === 0) {
    // 优化：只有简单的update/create操作
    strategy = 'minor-update';
    reason = '简单的Chrome API操作，直接增量更新最高效';
    estimatedTime = Math.max(1, totalOperations * 0.3);
    riskLevel = 'low';
  } else if (complexityScore <= 10 && operations.foldersToDelete === 0 && operations.structureReorganization === 0) {
    // 优化：中等复杂度但无删除操作
    strategy = 'incremental';
    reason = '中等复杂度但无风险操作，增量更新安全高效';
    estimatedTime = Math.max(3, totalOperations * 0.6);
    riskLevel = 'medium';
  } else {
    // 高复杂度或有风险操作
    strategy = 'full-rebuild';
    reason = '复杂操作或涉及删除，全量重建确保数据完整性';
    estimatedTime = Math.max(10, complexityScore * 0.5);
    riskLevel = 'high';

    // 全量重建：先清空再重建
    apiCalls = stats.originalTotal + stats.proposedTotal;
  }

  // 基于Chrome API限制的特殊情况
  if (operations.foldersToDelete > 0) {
    // removeTree操作有级联风险
    strategy = 'full-rebuild';
    reason = '包含文件夹删除操作(removeTree)，存在级联风险，建议全量重建';
    riskLevel = 'high';
  }

  if (operations.structureReorganization > 2) {
    // 大量move操作会影响索引
    strategy = 'full-rebuild';
    reason = '大量结构重组会影响书签索引，全量重建避免索引混乱';
    riskLevel = 'high';
  }

  if (changePercentage > 40) {
    // 变化过大时全量重建更可靠
    strategy = 'full-rebuild';
    reason = '变化幅度超过40%，全量重建避免复杂的增量同步';
    riskLevel = 'high';
  }

  return {
    strategy,
    reason,
    complexityScore,
    totalOperations,
    estimatedTime: Math.ceil(estimatedTime),
    riskLevel,
    changePercentage: Math.round(changePercentage * 10) / 10,
    apiCalls
  };
};

/**
 * 显示详细的分析报告
 */
const showAnalysisReport = (analysis: AnalysisData, strategy: ApplicationStrategy) => {
  const { stats, operations } = analysis;

  // 策略图标和颜色
  const strategyInfo = {
    'no-change': { icon: '⚪', color: 'gray', name: '无变化' },
    'minor-update': { icon: '🟢', color: 'green', name: '轻微更新' },
    'incremental': { icon: '🟡', color: 'orange', name: '增量更新' },
    'full-rebuild': { icon: '🔴', color: 'red', name: '全量重建' }
  };

  const strategyDisplay = strategyInfo[strategy.strategy as keyof typeof strategyInfo] || strategyInfo['full-rebuild'];

  // 构建操作详情
  const operationDetails = [];

  // 创建操作
  if (operations.bookmarksToCreate > 0) {
    operationDetails.push(`📝 创建 ${operations.bookmarksToCreate} 个书签`);
  }
  if (operations.foldersToCreate > 0) {
    operationDetails.push(`📁 创建 ${operations.foldersToCreate} 个文件夹`);
  }

  // 删除操作
  if (operations.bookmarksToDelete > 0) {
    operationDetails.push(`🗑️ 删除 ${operations.bookmarksToDelete} 个书签`);
  }
  if (operations.foldersToDelete > 0) {
    operationDetails.push(`🗂️ 删除 ${operations.foldersToDelete} 个文件夹`);
  }

  // 修改操作
  if (operations.bookmarksToRename > 0) {
    operationDetails.push(`✏️ 重命名 ${operations.bookmarksToRename} 个书签`);
  }
  if (operations.foldersToRename > 0) {
    operationDetails.push(`📝 重命名 ${operations.foldersToRename} 个文件夹`);
  }
  if (operations.bookmarksToUpdateUrl > 0) {
    operationDetails.push(`🔗 更新 ${operations.bookmarksToUpdateUrl} 个书签URL`);
  }

  // 移动操作
  if (operations.bookmarksToMove > 0) {
    operationDetails.push(`📦 移动 ${operations.bookmarksToMove} 个书签`);
  }
  if (operations.foldersToMove > 0) {
    operationDetails.push(`📂 移动 ${operations.foldersToMove} 个文件夹`);
  }

  // 复杂操作
  if (operations.structureReorganization > 0) {
    operationDetails.push(`🔄 结构重组 ${operations.structureReorganization} 处`);
  }
  if (operations.deepFolderChanges > 0) {
    operationDetails.push(`🏗️ 深层文件夹变化 ${operations.deepFolderChanges} 处`);
  }

  // 风险等级描述
  const riskInfo = {
    'none': '⚪ 无风险',
    'low': '🟢 低风险',
    'medium': '🟡 中等风险',
    'high': '🔴 高风险'
  };

  const message = `📊 书签变化复杂度分析报告

📈 基础统计：
• 原始项目：${stats.originalTotal} 个 (书签 ${stats.originalBookmarks} + 文件夹 ${stats.originalFolders})
• 目标项目：${stats.proposedTotal} 个 (书签 ${stats.proposedBookmarks} + 文件夹 ${stats.proposedFolders})
• 变化幅度：${strategy.changePercentage}%

🔧 需要执行的Chrome API操作：
${operationDetails.length > 0 ? operationDetails.map(op => `• ${op}`).join('\n') : '• 无操作需要执行'}

📊 复杂度评估：
• 复杂度评分：${strategy.complexityScore} 分
• Chrome API调用：${strategy.apiCalls} 次
• 操作总数：${strategy.totalOperations} 个

${strategyDisplay.icon} 推荐策略：${strategyDisplay.name}
⏱️ 预估耗时：${strategy.estimatedTime} 秒
⚠️ 风险等级：${riskInfo[strategy.riskLevel as keyof typeof riskInfo]}

💡 策略说明：
${strategy.reason}

🎯 应用建议：
${strategy.strategy === 'no-change' ? '当前无需应用任何变化' :
      strategy.strategy === 'minor-update' ? '可以直接应用，操作简单快速' :
        strategy.strategy === 'incremental' ? '建议分步应用，先处理简单操作' :
          '建议备份后应用，确保数据安全'}`;

  alert(message);
};

// Build mapping between original and proposed bookmarks
// 注意：已迁移到IndexedDB，整个映射函数已废弃
// const _buildBookmarkMapping = (originalTree: ChromeBookmarkTreeNode[], proposedTree: BookmarkNode[]) => {

// 添加缺失的变量定义
let hoverTimeout: number | null = null;
let hoverScrollInProgress = false;

// 添加缺失的函数定义
const findOriginalByUrlTitle = (url: string, title: string) => {
  // 注意：已迁移到IndexedDB，暂时返回null
  console.log('findOriginalByUrlTitle已迁移到IndexedDB', { url, title });
  return null;
};

const waitForElementInLeft = async (selector: string, timeout: number = 1500) => {
  // 注意：已迁移到IndexedDB，暂时返回null
  console.log('waitForElementInLeft已迁移到IndexedDB', { selector, timeout });
  return null;
};

// Handle bookmark hover（自动展开并只滚动一次）
const handleBookmarkHover = (payload: BookmarkNode | { id?: string; node?: BookmarkNode; isOriginal?: boolean }) => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
  hoverTimeout = window.setTimeout(async () => {
    if (!payload) {
      hoveredBookmarkId.value = null;
      originalExpandedFolders.value.clear();
      return;
    }

    const { id: bookmarkId, node: hoveredNode } = payload as {
      id: string | null;
      node: BookmarkNode;
    };
    if (hoveredBookmarkId.value === bookmarkId) return;
    hoveredBookmarkId.value = bookmarkId;

    const mapping = bookmarkMapping.value.get(bookmarkId || '');
    let targetOriginal: BookmarkNode | null = null;

    // 优先：若 hover 的就是左侧原始项
    if (
      hoveredNode &&
      hoveredNode.id &&
      originalIdToNode.value.has(hoveredNode.id)
    ) {
      targetOriginal = originalIdToNode.value.get(hoveredNode.id) || null;
    }
    // 其次：映射中有 original
    if (!targetOriginal && mapping && mapping.original) {
      targetOriginal = mapping.original;
    }

    // 回退：若没有 original 映射，但拿到了 proposed，则基于 URL(+标题) 从 originalTree 反查
    if (!targetOriginal) {
      const url = mapping?.proposed?.url || hoveredNode?.url;
      const title = mapping?.proposed?.title || hoveredNode?.title;
      if (url) {
        targetOriginal = findOriginalByUrlTitle(url, title);
      }
    }
    if (!targetOriginal) return;

    if (hoverScrollInProgress) return;
    hoverScrollInProgress = true;

    // 展开包含目标书签的所有父级文件夹（优先用 id 索引得到的祖先链，若无则用 parentId 向上回溯）
    originalExpandedFolders.value.clear();
    let ancestors: string[] | null =
      (targetOriginal.id && originalIdToAncestors.value.get(targetOriginal.id)?.map(node => node.id)) ||
      null;
    if (!ancestors || ancestors.length === 0) {
      // 动态用 parentId 向上回溯
      const chain: string[] = [];
      let curId: string | undefined = targetOriginal.id;
      while (curId && originalIdToParentId.value.has(curId)) {
        const parentId: string = originalIdToParentId.value.get(curId)!;
        chain.unshift(parentId);
        curId = parentId;
      }
      ancestors = chain;
    }
    for (const folderId of ancestors || []) {
      if (typeof folderId === 'string') {
        originalExpandedFolders.value.add(folderId);
      }
    }
    originalExpandedFolders.value = new Set(originalExpandedFolders.value);

    await nextTick();
    // 优先按原生 id 命中；失败再按 uniqueId 兜底
    let el = null as Element | null;
    if (targetOriginal.id) {
      el = await waitForElementInLeft(
        `[data-native-id="${CSS.escape(String(targetOriginal.id))}"]`,
        1500
      );
    }
    if (!el) {
      const targetId =
        targetOriginal.uniqueId || generateBookmarkId(targetOriginal);
      el = await waitForElementInLeft(`[data-bookmark-id="${targetId}"]`, 1500);
    }
    if (el) {
      scrollToBookmark(el);
    }

    // 稍后允许下一次滚动
    setTimeout(() => {
      hoverScrollInProgress = false;
    }, 200);
  }, 120);
};

// Find and expand the folder path containing the target bookmark
// 已被基于 id 的祖先链与 parentId 回溯替代；保留函数体以降低改动风险
// 移除未使用声明以通过类型检查（功能已由 id 映射替代）

// Recursive helper to expand the complete path
const _expandFolderPathRecursive = (nodes: BookmarkNode[], targetNode: BookmarkNode) => {
  for (const node of nodes) {
    if (node.children) {
      if (findNodeInChildren(node.children, targetNode)) {
        originalExpandedFolders.value.add(node.id);

        // Force reactivity update for recursive additions too
        originalExpandedFolders.value = new Set(originalExpandedFolders.value);

        _expandFolderPathRecursive(node.children, targetNode);
        break;
      }
    }
  }
};

// Helper function to find if target node exists in children
const findNodeInChildren = (children: BookmarkNode[], targetNode: BookmarkNode): boolean => {
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

// 左侧面板滚动容器
const leftPanelRef = ref<HTMLElement | null>(null);

// 在左侧容器内滚动到目标元素
const scrollToBookmark = (element: Element) => {
  if (!element) return;
  // 仅滚动左侧容器
  (element as HTMLElement).scrollIntoView({
    behavior: 'smooth',
    block: 'center',
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
function getComparable(
  nodes: ProposalNode[],
  depth: number = 0,
  visited: Set<string> = new Set()
): BookmarkNode[] {
  if (!nodes || nodes.length === 0) return [];

  // 防止死循环：限制深度和检查访问过的节点
  if (depth > 15) {
    console.warn('🚨 [比较函数] 递归深度过深，停止处理:', depth);
    return [];
  }

  return nodes
    .map((node) => {
      // 检查是否已经访问过这个节点（防止循环引用）
      if (visited.has(node.id)) {
        console.warn('🚨 [比较函数] 检测到循环引用，跳过节点:', node.id);
        return {
          title: node.title,
          id: node.id,
          url: node.url
        };
      }

      const newVisited = new Set(visited);
      newVisited.add(node.id);

      const newNode: BookmarkNode = {
        title: node.title,
        id: node.id,
        url: node.url
      };

      // 安全的递归处理子节点
      if (node.children && node.children.length > 0) {
        newNode.children = getComparable(node.children, depth + 1, newVisited);
      }

      return newNode;
    })
    .sort((a, b) => {
      // 按ID排序，确保比较的一致性
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
}

function updateComparisonState(): void {
  const originalComparable = getComparable(originalTree.value);
  const proposalComparable = getComparable(
    newProposalTree.value.children ?? []
  );
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
onMounted(async () => {
  // 使用store的initialize方法代替复杂的初始化逻辑
  await initialize();

  // 保留必要的本地功能
  // 开发辅助：将关键 ref 暴露到全局，便于控制台调试
  try {
    if (typeof window !== 'undefined') {
      const g: Record<string, unknown> = (window as unknown as Record<string, unknown>).__AB__ as Record<string, unknown> || ((window as unknown as Record<string, unknown>).__AB__ = {});
      g.originalTree = originalTree;
      g.newProposalTree = newProposalTree;
      g.cleanupActions = cleanupActions; // 暴露清理actions供调试使用
      g.cleanupState = cleanupState; // 暴露清理状态供调试使用
      // 控制台测试API：展开指定文件夹ID，可选是否滚动到可见
      g.expandFolderById = async (folderId: string, doScroll: boolean = true) => {
        if (!folderId) return false;
        // 写入展开集合
        originalExpandedFolders.value.add(folderId);
        originalExpandedFolders.value = new Set(originalExpandedFolders.value);
        await nextTick();
        if (doScroll) {
          const el = await waitForElementInLeft(`[data-native-id="${CSS.escape(String(folderId))}"]`, 1500);
          if (el) scrollToBookmark(el);
        }
        return true;
      };
    }
  } catch { }

  logger.info('Management', '🎯 [页面初始化] Management页面已挂载');
  logger.info(
    'Management',
    '🎯 [初始状态] dataLoaded:',
    dataLoaded,
    'lastDataLoadTime:',
    lastDataLoadTime
  );
  logger.info('Management', '🎯 [URL参数] 当前URL:', window.location.href);
  logger.info('Management', '🎯 [右侧面板] 初始状态:', newProposalTree.value.id);

  // 性能优化：检查是否可以跳过数据加载
  const now = Date.now();
  if (dataLoaded && now - lastDataLoadTime < PERFORMANCE_CONFIG.DATA_CACHE_TIME) {
    logger.info('Management', '📦 [缓存使用] 使用缓存数据，跳过重新加载');
    isPageLoading.value = false;
    loadingMessage.value = '';
    return;
  }

  // 解析URL参数，确定进入模式
  const urlMode = parseUrlParams();

  // 根据模式设置初始化行为
  if (urlMode === 'manual') {
  } else if (urlMode === 'ai') {
  }

  // 显示初始加载状态
  loadingMessage.value = '正在检查本地数据...';

  // 页面已加载，直接请求数据准备，不触发页面重新打开
  chrome.runtime.sendMessage(
    {
      action: 'prepareManagementData'
    },
    (_response) => {
      // 记录数据加载时间戳
      lastDataLoadTime = Date.now();
    }
  );

  // 初次挂载后，做一次轻量指纹校验，若 storage 过期则用 live 刷新
  setTimeout(() => {
    try {
      refreshFromChromeIfOutdated();
    } catch { }
  }, 300);

  chrome.runtime.onMessage.addListener(async (request) => {
    logger.info('Management', '📨 [消息监听] 收到消息:', request.action, request);
    if (request.action === 'aiOrganizeStarted') {
      snackbarText.value = 'AI正在分析您的书签结构，请稍候...';
      snackbar.value = true;
      snackbarColor.value = 'info';
    } else if (request.action === 'aiOrganizeComplete') {
      snackbarText.value = 'AI建议结构已生成，请在右侧面板查看和调整';
      snackbar.value = true;
      snackbarColor.value = 'success';
    } else if (request.action === 'dataReady') {
      logger.info('Management', '🚀 [消息处理] 收到dataReady消息');
      logger.info('Management', '🚀 [消息详情] request:', JSON.stringify(request, null, 2));

      // 更新缓存状态
      cacheStatus.value.isFromCache = request.fromCache || false;

      // 处理本地数据状态
      if (request.localData) {
        if (
          request.localData.status === 'cached' ||
          request.localData.status === 'recovered'
        ) {
          // 优化：并行处理数据加载，减少串联延迟

          // 注意：数据加载已简化为IndexedDB方式
          try {
            // 使用IndexedDB适配器获取数据
            const data = await managementIndexedDBAdapter.getBookmarkTreeData();
            
            // 构建兼容的数据结构
            if (data && data.bookmarks) {
              const fullTree: ChromeBookmarkTreeNode[] = [];
              // 暂时使用空的书签树，实际实现需要重建树形结构
              originalTree.value = fullTree;
            } else {
              originalTree.value = [];
            }
          } catch (error) {
            console.error('加载书签数据失败:', error);
            originalTree.value = [];
          }
          
          // 更新比较状态
          updateComparisonState();
          
          // 设置加载完成状态
          isPageLoading.value = false;
          loadingMessage.value = '';
          
          // 设置数据标志
          dataLoaded = true;

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
      // 注意：数据加载已迁移到IndexedDB
      try {
        console.log('数据加载请求：已迁移到IndexedDB架构');
        // 暂时简化处理逻辑
      } catch (error) {
        console.error('数据加载处理失败:', error);
      }
    } else if (request.action === 'dataRefreshed') {
      // 更新缓存状态
      cacheStatus.value.isFromCache = false;

      // 重新加载数据
      // 注意：已迁移到IndexedDB，使用IndexedDB适配器
      try {
        console.log('数据刷新请求：已迁移到IndexedDB架构');
        // 暂时简化处理逻辑
        snackbarText.value = '数据刷新功能已迁移到IndexedDB';
        snackbar.value = true;
        snackbarColor.value = 'info';
      } catch (error) {
        console.error('数据刷新处理失败:', error);
      }
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.isGenerating)
      isGenerating.value = changes.isGenerating.newValue;
    if (changes.progressCurrent || changes.progressTotal) {
      // 注意：已迁移到IndexedDB，进度数据通过IndexedDB管理
      console.log('进度查询已迁移到IndexedDB');
    }
    if (changes.newProposal && changes.newProposal.newValue) {
      // 修复：不要覆盖用户已经克隆或手动设置的数据
      const currentState = newProposalTree.value.id;
      console.log(
        '🔄 Storage变化监听器 - newProposal变化，当前右侧面板状态:',
        currentState
      );
      console.log(
        '🔄 Storage变化监听器 - 新的proposal数据:',
        changes.newProposal.newValue
      );

      // 只有在右侧面板为空时才应用新的proposal数据，避免覆盖已克隆的数据
      if (currentState === 'root-empty') {
        const proposal = convertLegacyProposalToTree(
          changes.newProposal.newValue
        );
        newProposalTree.value = JSON.parse(JSON.stringify(proposal));
        updateComparisonState();
      } else {
        console.log(
          '🚫 Storage监听器：右侧面板有数据，跳过覆盖:',
          currentState
        );
      }
    }
  });
});

// --- Methods ---


// 🧪 测试函数：直接测试Chrome API
const testMoveBookmark = async () => {
  try {
    console.log('🧪 开始测试Chrome书签移动API');

    // 获取当前书签栏
    const bookmarksBar = await new Promise<ChromeBookmarkTreeNode[]>((resolve, reject) => {
      chrome.bookmarks.getChildren('1', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result as ChromeBookmarkTreeNode[]);
        }
      });
    });

    console.log('📋 当前书签栏:', bookmarksBar.map((c, i) => `${i}:${c.title} (ID:${c.id})`));

    if (bookmarksBar.length >= 2) {
      const firstBookmark = bookmarksBar[0];
      const secondBookmark = bookmarksBar[1];

      console.log(`🧪 尝试交换前两个书签: "${firstBookmark.title}" 和 "${secondBookmark.title}"`);

      // 移动第一个书签到位置1
      await new Promise<void>((resolve, reject) => {
        chrome.bookmarks.move(firstBookmark.id, {
          parentId: '1',
          index: 1
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('❌ 移动失败:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('✅ 移动成功!');
            resolve();
          }
        });
      });

      alert('测试完成！请检查书签栏顺序是否改变');
    } else {
      alert('书签栏中书签数量不足，无法测试');
    }
  } catch (error) {
    console.error('🚨 测试失败:', error);
    alert(`测试失败: ${error}`);
  }
};

// 临时添加到window对象以便在控制台调用
(window as any).testMoveBookmark = testMoveBookmark;

// 🎯 旧的 applyAllBookmarkChanges 函数已移除，现在使用新的操作记录系统

// 🎯 旧的 adjustBookmarkOrder 函数已移除，现在使用新的操作记录系统

// 🎯 旧的 confirmApplyChanges 函数已移除，现在使用新的操作确认对话框系统

const handleReorder = (): void => {

  // 立即设置拖拽变更标记
  hasDragChanges.value = true;

  // 强制触发响应式更新，让Vue检测到数组内部的变化
  const currentChildren = newProposalTree.value.children
    ? [...newProposalTree.value.children]
    : [];

  // 🎯 重新计算所有节点的索引，确保复杂度分析能检测到位置变化
  const updateNodeIndices = (nodes: BookmarkNode[], parentId: string = '') => {
    nodes.forEach((node, index) => {
      node.index = index;
      if (parentId) {
        node.parentId = parentId;
      }

      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        updateNodeIndices(node.children, node.id);
      }
    });
  };

  // 更新所有节点的索引
  updateNodeIndices(currentChildren, newProposalTree.value.id);

  // 创建一个新的对象来确保Vue检测到变化
  // 添加时间戳确保对象确实发生了变化
  newProposalTree.value = {
    ...newProposalTree.value,
    children: currentChildren,
    dateAdded: Date.now() // 添加时间戳标记变更
  };

  console.log('🎯 拖拽操作完成，索引已更新:', {
    childrenCount: currentChildren.length,
    firstChildIndex: currentChildren[0]?.index,
    lastChildIndex: currentChildren[currentChildren.length - 1]?.index
  });

  // 关键修复：拖拽后按钮仍保持可用
  nextTick(() => {
    structuresAreDifferent.value = true; // 仅用于显示提示

    // 🎯 拖拽后自动触发复杂度分析，确保能检测到变化
    try {
      updateComparisonState();

      // 延迟触发复杂度分析，确保DOM和数据都已更新
      setTimeout(() => {
        triggerComplexityAnalysisAfterDrag();
      }, 100);
    } catch (error) {
      console.warn('拖拽后复杂度分析失败:', error);
    }
  });
};

// --- Bookmark Operations ---
// 编辑书签处理器 - 现在使用store action
const handleEditBookmark = (node: BookmarkNode) => {
  editBookmark(node);
};

// 删除书签处理器 - 直接删除预览状态的书签，无需确认
const handleDeleteBookmark = (node: BookmarkNode) => {
  // 直接从预览树中移除书签
  const success = removeBookmarkFromTree(newProposalTree.value.children || [], node.id);
  if (success) {
    // 设置拖拽变更标记，让"应用"按钮可用
    hasDragChanges.value = true;
    // 显示预览删除成功提示
    snackbarText.value = `已从预览中删除书签: ${node.title}`;
    snackbar.value = true;
    snackbarColor.value = 'success';
  } else {
    snackbarText.value = '删除书签失败，请重试';
    snackbar.value = true;
    snackbarColor.value = 'error';
  }
};

// 删除文件夹处理器 - 直接删除预览状态的文件夹，无需确认
const handleDeleteFolder = (node: BookmarkNode) => {
  // 直接从预览树中移除文件夹
  const success = removeBookmarkFromTree(newProposalTree.value.children || [], node.id);
  if (success) {
    // 设置拖拽变更标记，让"应用"按钮可用
    hasDragChanges.value = true;
    // 显示预览删除成功提示
    snackbarText.value = `已从预览中删除文件夹: ${node.title}`;
    snackbar.value = true;
    snackbarColor.value = 'success';
  } else {
    snackbarText.value = '删除文件夹失败，请重试';
    snackbar.value = true;
    snackbarColor.value = 'error';
  }
};

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

// 旧的确认删除函数已移除 - 现在直接在预览状态下删除，无需确认

// 在书签树中更新项目的辅助函数
const updateBookmarkInTree = (
  tree: any[],
  bookmarkId: string,
  updates: any
): boolean => {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    if (node.id === bookmarkId) {
      Object.assign(node, updates);
      return true;
    }
    if (
      node.children &&
      updateBookmarkInTree(node.children, bookmarkId, updates)
    ) {
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
    await new Promise((resolve) => setTimeout(resolve, 600));

    const updates = {
      title: editTitle.value.trim(),
      url: editUrl.value.trim() || undefined
    };

    // 注意：右侧面板只是预览编辑区，只修改本地数据，不与Chrome API交互
    // 只有点击应用按钮时才会一次性更新Chrome书签

    // 只更新右侧面板数据（预览编辑区）
    if (newProposalTree.value.children) {
      updateBookmarkInTree(newProposalTree.value.children, editingBookmark.value.id, updates);
    }

    snackbarText.value = '书签已更新（预览）';
    snackbar.value = true;
    snackbarColor.value = 'success';

    // 响应式系统会自动检测变化并更新按钮状态
    isEditBookmarkDialogOpen.value = false;
    editingBookmark.value = null;
    editTitle.value = '';
    editUrl.value = '';
  } catch {
    snackbarText.value = '更新书签失败，请重试';
    snackbar.value = true;
    snackbarColor.value = 'error';
  } finally {
    isEditingBookmark.value = false;
  }
};

// 复制成功处理器 - 现在使用store action
const handleCopySuccess = () => {
  managementStore.handleCopySuccess();
};

// 复制失败处理器 - 现在使用store action
const handleCopyFailed = () => {
  managementStore.handleCopyFailed();
};

// --- Add New Item Functions ---
// 添加新项目处理器 - 现在使用store action
const handleAddNewItem = (parentNode: any) => {
  console.log('Management.vue: handleAddNewItem CALLED. parentNode:', parentNode?.title);
  addNewItem(parentNode);
  console.log('Management.vue: isAddNewItemDialogOpen state is now:', isAddNewItemDialogOpen.value);
};

// 监听tab切换，重置表单验证状态
watch(addItemType, () => {
  // 重置表单验证状态
  newItemTitle.value = '';
  newItemUrl.value = '';
  // 重置表单验证
  if (addForm.value && 'resetValidation' in addForm.value) {
    addForm.value.resetValidation?.();
  }
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

const checkForDuplicates = (
  title: string,
  url: string,
  type: 'folder' | 'bookmark'
): any => {
  const parentChildren = parentFolder.value?.children || [];

  // 检查同级目录是否有相同名称
  const nameDuplicates = parentChildren.filter(
    (child: any) =>
      child.title === title &&
      ((type === 'folder' && child.children) ||
        (type === 'bookmark' && !child.children))
  );

  if (nameDuplicates.length > 0) {
    return {
      type: 'name',
      duplicates: nameDuplicates,
      message: `同级目录中已存在名称 "${title}" 的${type === 'folder' ? '文件夹' : '书签'
        }`
    };
  }

  // 如果是书签，检查整个书签树是否有相同URL
  if (type === 'bookmark' && url) {
    const urlDuplicates = findUrlDuplicates(
      originalTree.value,
      url,
      parentFolder.value?.id || ''
    );
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

const findUrlDuplicates = (
  tree: BookmarkNode[],
  url: string,
  excludeParentId: string
): BookmarkNode[] => {
  const duplicates: BookmarkNode[] = [];

  const traverseTree = (nodes: BookmarkNode[], path: string[] = []) => {
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
  const validateResult = await addForm.value?.validate();
  const valid = typeof validateResult === 'boolean' ? validateResult : validateResult?.valid || false;

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
  // 预览状态无需确认，直接关闭添加对话框
  closeAddDialog();
};


const closeAddDialog = () => {
  isAddNewItemDialogOpen.value = false;
  // 重置表单
  newItemTitle.value = '';
  newItemUrl.value = '';
  addItemType.value = 'bookmark';
  parentFolder.value = null;
  // 重置表单验证
  if (addForm.value && 'resetValidation' in addForm.value) {
    addForm.value.resetValidation?.();
  }
};

const addItemToTree = async () => {
  const title = newItemTitle.value.trim();
  const url = newItemUrl.value.trim();

  if (!parentFolder.value || !title) return;

  // 模拟网络请求延迟
  await new Promise((resolve) => setTimeout(resolve, 800));

  const newItem: any = {
    id: `new-${addItemType.value}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`,
    title,
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
  snackbarText.value = `已添加${addItemType.value === 'folder' ? '文件夹' : '书签'
    }: ${title}`;
  snackbar.value = true;
  snackbarColor.value = 'success';
};

const confirmAddDuplicate = () => {
  isDuplicateDialogOpen.value = false;
  addItemToTree();
};

function convertLegacyProposalToTree(
  proposal: Record<string, any>
): ProposalNode {
  // 根据数据内容判断数据来源，设置正确的id
  let rootId = 'root-0'; // 默认AI建议
  let rootTitle = 'AI 建议结构';

  // 如果proposal中有特殊标记，说明是克隆的数据
  if (proposal._source === 'cloned') {
    rootId = 'root-cloned';
    rootTitle = '克隆的书签结构';
  } else if (proposal._source === 'quick') {
    rootId = 'root-quick';
    rootTitle = '快速预览结构';
  } else if (proposal._source === 'ai') {
    rootId = 'root-0';
    rootTitle = 'AI 建议结构';
  }

  // 如果没有_source标记但数据结构看起来像克隆的数据，则自动识别
  if (
    !proposal._source &&
    proposal['书签栏'] &&
    typeof proposal['书签栏'] === 'object'
  ) {
    // 检查是否包含原始书签结构特征（有书签栏且结构完整）
    const bookmarkBar = proposal['书签栏'];
    if (Object.keys(bookmarkBar).length > 0) {
      // 如果没有明确标记但有完整书签栏结构，则认为是克隆数据
      rootId = 'root-cloned';
      rootTitle = '克隆的书签结构';
    }
  }

  // 如果没有任何特殊结构，可能是AI生成的数据
  if (
    !proposal._source &&
    !proposal['书签栏'] &&
    Object.keys(proposal).length > 0
  ) {
    rootId = 'root-0';
    rootTitle = 'AI 建议结构';
  }

  const root: ProposalNode = { title: rootTitle, children: [], id: rootId };

  // 验证参数是否有效
  if (!proposal || typeof proposal !== 'object') {
    return root; // 返回空根节点
  }

  const findOrCreateNode = (path: string[]): ProposalNode => {
    let current = root;
    path.forEach((part) => {
      let node = current.children?.find(
        (child) => child.title === part && child.children
      );
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

// 计算属性：左侧面板展开/收起按钮状态
const leftToggleButtonState = computed(() => {
  if (originalTree.value.length === 0) return { icon: 'mdi-expand-all-outline', title: '展开所有文件夹' };

  // 收集所有文件夹ID
  const collectAllFolderIds = (nodes: any[]): string[] => {
    const ids: string[] = [];
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        ids.push(...collectAllFolderIds(node.children));
      }
    });
    return ids;
  };

  const allFolderIds = collectAllFolderIds(originalTree.value);
  if (allFolderIds.length === 0) return { icon: 'mdi-expand-all-outline', title: '展开所有文件夹' };

  const expandedCount = allFolderIds.filter(id => originalExpandedFolders.value.has(id)).length;
  const expansionRatio = expandedCount / allFolderIds.length;

  return expansionRatio > 0.5
    ? { icon: 'mdi-collapse-all-outline', title: '折叠所有文件夹' }
    : { icon: 'mdi-expand-all-outline', title: '展开所有文件夹' };
});

// 计算属性：右侧面板展开/收起按钮状态
const rightToggleButtonState = computed(() => {
  const tree = newProposalTree.value.children || [];
  if (tree.length === 0) return { icon: 'mdi-expand-all-outline', title: '展开所有文件夹' };

  // 收集所有文件夹ID
  const collectAllFolderIds = (nodes: any[]): string[] => {
    const ids: string[] = [];
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        ids.push(...collectAllFolderIds(node.children));
      }
    });
    return ids;
  };

  const allFolderIds = collectAllFolderIds(tree);
  if (allFolderIds.length === 0) return { icon: 'mdi-expand-all-outline', title: '展开所有文件夹' };

  const expandedCount = allFolderIds.filter(id => proposalExpandedFolders.value.has(id)).length;
  const expansionRatio = expandedCount / allFolderIds.length;

  return expansionRatio > 0.5
    ? { icon: 'mdi-collapse-all-outline', title: '折叠所有文件夹' }
    : { icon: 'mdi-expand-all-outline', title: '展开所有文件夹' };
});

// 将树状结构转换为legacy proposal格式

// handleDrop 函数已移除，拖拽逻辑现在在 FolderItem.vue 的 Sortable onEnd 事件中处理

// 🎯 超高性能书签统计数据（使用超级缓存预计算值）
const bookmarkStats = computed(() => {
  // 🚀 尝试使用超级缓存的O(1)统计数据
  try {
    // 检查超级缓存是否可用
    // 注意：缓存状态现在通过IndexedDB管理
    const cacheStatus = { isActive: true, lastUpdate: Date.now() }
    
    if (cacheStatus.isActive) {
      // 🚀 使用正确的递归统计计算（IndexedDB优化版）
      const originalStats = calculateStatsFallback(originalTree.value || [])
      
      // 对于proposed统计，如果有新提案树，则计算差异
      let proposedStats = originalStats
      
      // 如果有新提案且与原始不同，计算提案统计
      if (newProposalTree.value.children && structuresAreDifferent.value) {
        proposedStats = calculateStatsFallback(newProposalTree.value.children)
      }
      
      return {
        original: originalStats,
        proposed: proposedStats,
        difference: {
          bookmarks: proposedStats.bookmarks - originalStats.bookmarks,
          folders: proposedStats.folders - originalStats.folders,
          total: proposedStats.total - originalStats.total
        },
        isOptimized: true // 标记为已优化
      }
    }
  } catch (error) {
    console.warn('⚠️ 超级缓存不可用，使用传统计算方法:', error)
  }
  
  // 🐌 降级到传统递归计算
  console.warn('⚠️ 性能降级：使用传统递归统计计算')
  const originalStats = calculateStatsFallback(originalTree.value)
  const proposedStats = newProposalTree.value.children 
    ? calculateStatsFallback(newProposalTree.value.children)
    : { bookmarks: 0, folders: 0, total: 0 }
  
  return {
    original: originalStats,
    proposed: proposedStats,
    difference: {
      bookmarks: proposedStats.bookmarks - originalStats.bookmarks,
      folders: proposedStats.folders - originalStats.folders,
      total: proposedStats.total - originalStats.total
    },
    isOptimized: false // 标记为未优化
  }
})

// 🐌 传统递归计算方法（性能较差，作为降级方案）
const calculateStatsFallback = (nodes: any[]) => {
  let bookmarks = 0
  let folders = 0
  
  const traverse = (nodeList: any[]) => {
    nodeList.forEach(node => {
      if (node.url) {
        bookmarks++
      } else if (node.children) {
        folders++
        traverse(node.children)
      }
    })
  }
  
  traverse(nodes)
  return { bookmarks, folders, total: bookmarks + folders }
}

// 计算属性：显示的树节点（根据筛选状态决定）
const displayTreeNodes = computed(() => {
  const baseNodes = newProposalTree.value.children || [];

  // 🎯 如果在筛选模式，根据隐藏标记和图例可见性过滤节点
  if (cleanupState.value?.isFiltering) {
    return filterNodesByVisibility(baseNodes);
  }

  return baseNodes;
});

// 🎯 根据问题标记和图例可见性过滤节点（筛选模式逻辑）
const filterNodesByVisibility = (nodes: BookmarkNode[]): BookmarkNode[] => {
  if (!cleanupState.value) return nodes;

  const { legendVisibility } = cleanupState.value;

  const filterNode = (node: BookmarkNode): BookmarkNode | null => {
    // 🎯 检查节点是否有可见的问题
    let hasVisibleProblems = false;
    if (node._cleanupProblems && node._cleanupProblems.length > 0) {
      if (legendVisibility.all) {
        hasVisibleProblems = true;
      } else {
        // 检查节点的问题类型是否在当前可见的图例中
        hasVisibleProblems = node._cleanupProblems.some(problem =>
          legendVisibility[problem.type as keyof typeof legendVisibility] === true
        );
      }
    }

    // 处理子节点（递归过滤）
    let filteredChildren: BookmarkNode[] = [];
    if (node.children && node.children.length > 0) {
      filteredChildren = node.children
        .map(filterNode)
        .filter(child => child !== null) as BookmarkNode[];
    }

    // 🎯 决定是否显示此节点：
    // 1. 节点本身有可见问题 或
    // 2. 节点有可见的子节点（文件夹路径）
    const shouldShow = hasVisibleProblems || filteredChildren.length > 0;

    if (!shouldShow) return null;

    // 🎯 只有原本就有children的节点才保留children属性
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: filteredChildren
      };
    } else {
      // 书签节点：不添加children属性
      return { ...node };
    }
  };

  return nodes
    .map(filterNode)
    .filter(node => node !== null) as BookmarkNode[];
};


// 退出筛选模式
const exitFilterMode = () => {
  if (!cleanupState.value) return;

  // 🎯 先重置展开状态，避免Vue响应式更新问题
  console.log('🔄 退出筛选模式：重置展开状态');
  managementStore.proposalExpandedFolders.clear();
  managementStore.proposalExpandedFolders.add('1'); // 书签栏
  managementStore.proposalExpandedFolders.add('2'); // 其他书签
  managementStore.proposalExpandedFolders.add('root-cloned'); // 克隆根节点

  // 🎯 清除所有问题标记
  const clearAllProblemMarks = (nodes: BookmarkNode[]) => {
    const walkAndClear = (nodeList: BookmarkNode[]) => {
      for (const node of nodeList) {
        delete node._cleanupProblems;

        if (node.children && node.children.length > 0) {
          walkAndClear(node.children);
        }
      }
    };

    walkAndClear(nodes);
  };

  clearAllProblemMarks(newProposalTree.value.children || []);

  cleanupState.value.isFiltering = false;
  cleanupState.value.filterResults.clear();
  cleanupState.value.tasks = [];

  // 重置所有筛选器状态
  cleanupState.value.activeFilters = ['404', 'duplicate', 'empty', 'invalid'];
  cleanupState.value.legendVisibility = {
    all: true,
    '404': true,
    duplicate: true,
    empty: true,
    invalid: true
  };

  logger.info('Cleanup', '退出筛选模式');
};
</script>

<template>
  <App class="app-container">
    <!-- 加载遮罩 -->
    <Overlay v-model:show="isPageLoading" persistent class="loading-overlay">
      <Card class="loading-card" elevation="high">
        <div class="loading-content">
          <Spinner color="primary" size="xl" class="loading-spinner" />
          <div class="loading-text">{{ loadingMessage }}</div>
          <div class="loading-subtitle">正在准备您的书签数据...</div>
        </div>
      </Card>
    </Overlay>

    <AppBar app flat class="app-bar-style">
      <template #title>
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="app-bar-logo" />
        <div class="app-bar-title-text">AcuityBookmarks</div>
      </template>
      <template #actions>
        <Button variant="secondary" color="secondary" @click="testComplexityAnalysis">
          <template v-slot:prepend>
            <Icon name="mdi-chart-line" />
          </template>
          Test Complexity
        </Button>
      </template>
    </AppBar>

    <Main withAppBar :padding="false" class="main-content">
      <Grid is="container" fluid class="fill-height management-container">
        <Grid is="row" class="fill-height" align="stretch">
          <!-- Current Structure Panel -->
          <Grid is="col" cols="5" class="panel-col">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <Icon name="mdi-folder-open-outline" color="primary" />
                  <span class="panel-title">当前书签目录</span>
                  <div 
                    class="panel-stats" 
                    :class="{ 'stats-optimized': bookmarkStats.isOptimized }"
                    :title="`包含 ${bookmarkStats.original.bookmarks} 条书签，${bookmarkStats.original.folders} 个文件夹${bookmarkStats.isOptimized ? ' (⚡ 超级缓存优化)' : ''}`"
                  >
                    <span class="stats-bookmarks">{{ bookmarkStats.original.bookmarks }}</span>
                    <span class="stats-separator">/</span>  
                    <span class="stats-folders">{{ bookmarkStats.original.folders }}</span>
                    <span v-if="bookmarkStats.isOptimized" class="optimization-indicator" title="使用超级缓存优化">⚡</span>
                  </div>
                  <Button variant="ghost" size="sm" icon @click="() => toggleAllFolders(true)"
                    :title="leftToggleButtonState.title">
                    <Icon :name="leftToggleButtonState.icon" />
                  </Button>
                </div>
              </template>
              <Divider />
              <div class="panel-content" ref="leftPanelRef">
                <!-- 调试信息 -->
                <div v-if="originalTree.length === 0" class="empty-state">
                  <Icon name="mdi-folder-outline" :size="48" color="secondary" />
                  <div class="empty-text">正在加载书签数据...</div>
                </div>

                <BookmarkTree :nodes="originalTree" :searchQuery="searchQuery"
                  :expandedFolders="originalExpandedFolders" isOriginal :isSortable="false" isTopLevel />
              </div>
            </Card>
          </Grid>

          <!-- Control Panel -->
          <Grid is="col" cols="2" class="control-panel">
            <div class="control-actions">
              <Button variant="secondary" size="lg" icon disabled class="control-btn">
                <Icon name="mdi-compare-horizontal" />
              </Button>
              <div class="control-label">对比</div>
              <div class="control-label">应用</div>
            </div>
          </Grid>

          <!-- Proposed Structure Panel -->
          <Grid is="col" cols="5" class="panel-col">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <Icon :name="getProposalPanelIcon" :color="getProposalPanelColor" />
                  <span class="panel-title">{{ getProposalPanelTitle }}</span>
                  <div 
                    v-if="bookmarkStats.proposed.total > 0" 
                    class="panel-stats"
                    :class="{ 'stats-optimized': bookmarkStats.isOptimized }"
                    :title="`包含 ${bookmarkStats.proposed.bookmarks} 条书签，${bookmarkStats.proposed.folders} 个文件夹${bookmarkStats.isOptimized ? ' (⚡ 超级缓存优化)' : ''}`"
                  >
                    <span class="stats-bookmarks">{{ bookmarkStats.proposed.bookmarks }}</span>
                    <span class="stats-separator">/</span>  
                    <span class="stats-folders">{{ bookmarkStats.proposed.folders }}</span>
                    <span v-if="bookmarkStats.difference.total !== 0" class="stats-change"
                          :class="bookmarkStats.difference.total > 0 ? 'stats-increase' : 'stats-decrease'">
                      {{ bookmarkStats.difference.total > 0 ? '+' : '' }}{{ bookmarkStats.difference.total }}
                    </span>
                    <span v-if="bookmarkStats.isOptimized" class="optimization-indicator" title="使用超级缓存优化">⚡</span>
                  </div>

                  <!-- 清理功能工具栏 - 只在有数据时显示 -->
                  <CleanupToolbar v-if="newProposalTree.children && newProposalTree.children.length > 0"
                    class="cleanup-toolbar" />

                  <Button icon size="sm" variant="ghost" @click="() => toggleAllFolders(false)"
                    :title="rightToggleButtonState.title">
                    <Icon :name="rightToggleButtonState.icon" />
                  </Button>
                  <!-- 手风琴模式切换按钮 -->
                  <Button icon size="sm" variant="ghost" @click="toggleAccordionMode"
                    :class="{ 'active': isAccordionMode }"
                    :title="isAccordionMode ? '关闭手风琴模式：允许同时展开多个同级文件夹' : '开启手风琴模式：同级文件夹互斥展开'">
                    <Icon :name="isAccordionMode ? 'mdi-view-sequential-outline' : 'mdi-view-parallel-outline'" />
                  </Button>
                </div>
              </template>

              <!-- 清理功能图例控制条 -->
              <div v-if="newProposalTree.children && newProposalTree.children.length > 0"
                class="cleanup-legend-wrapper">
                <CleanupLegend />
              </div>
              <Divider />
              <div class="panel-content">
                <div v-if="isGenerating" class="generating-state">
                  <div class="generating-progress">
                    <Spinner color="primary" size="xl" />
                    <Icon name="mdi-brain" :size="32" class="generating-icon" />
                  </div>
                  <div class="generating-title">AI 正在分析中...</div>
                  <div class="generating-subtitle">请稍候...</div>
                </div>
                <div v-else-if="newProposalTree.id === 'root-empty'" class="empty-state">
                  <Icon name="mdi-plus-circle-outline" :size="64" color="secondary" class="empty-icon" />
                  <div class="empty-title">右侧面板为空</div>
                  <div class="empty-subtitle">请选择数据源来开始编辑</div>
                </div>
                <!-- 右侧面板内容区域 -->
                <template v-if="displayTreeNodes && displayTreeNodes.length > 0">
                  <!-- 筛选模式提示 -->
                  <div v-if="cleanupState?.isFiltering" class="filter-notice">
                    <div class="filter-content">
                      <Icon name="mdi-filter" color="info" :size="16" class="filter-icon" />
                      <span class="filter-text">筛选模式：显示发现问题的书签</span>
                      <Spacer />
                      <Button size="sm" variant="ghost" color="info" @click="exitFilterMode">
                        <Icon name="mdi-close" :size="16" />
                        退出筛选
                      </Button>
                    </div>
                  </div>

                  <!-- 右侧面板调试信息 -->
                  <div class="pa-2" v-show="false">
                    <small class="text-grey">
                      📊 右侧面板数据: {{ displayTreeNodes.length }} 个顶层文件夹，
                      展开状态: {{ proposalExpandedFolders.size }} 个文件夹，
                      模式: {{ cleanupState?.isFiltering ? '筛选模式' : '正常模式' }}
                    </small>
                  </div>

                  <BookmarkTree :nodes="displayTreeNodes" :searchQuery="searchQuery" isProposal
                    :isSortable="!cleanupState?.isFiltering" isTopLevel :hoveredBookmarkId="hoveredBookmarkId"
                    :isOriginal="false" :expandedFolders="proposalExpandedFolders"
                    :cleanupMode="cleanupState?.isFiltering" @reorder="handleReorder"
                    @bookmark-hover="handleBookmarkHover" @edit-bookmark="handleEditBookmark"
                    @delete-bookmark="handleDeleteBookmark" @copy-success="handleCopySuccess"
                    @copy-failed="handleCopyFailed" @add-new-item="handleAddNewItem"
                    @delete-folder="handleDeleteFolder" />
                </template>
              </div>
            </Card>
          </Grid>
        </Grid>
      </Grid>
    </Main>

    <!-- 已移除旧的 Apply Confirm Dialog，现在使用 OperationConfirmDialog -->

    <!-- Edit Bookmark Dialog -->
    <Dialog v-model:show="isEditBookmarkDialogOpen" title="编辑书签" icon="mdi-pencil" maxWidth="500px" persistent>
      <div class="edit-form">
        <Input v-model="editTitle" label="书签标题" variant="outlined" class="form-field"
          @keydown.enter="saveEditedBookmark" />
        <Input v-model="editUrl" label="书签链接" variant="outlined" type="url" class="form-field"
          @keydown.enter="saveEditedBookmark" />
      </div>
      <template #actions>
        <Button variant="text" @click="isEditBookmarkDialogOpen = false" :disabled="isEditingBookmark">
          取消
        </Button>
        <Button variant="primary" @click="saveEditedBookmark" :loading="isEditingBookmark">
          保存
        </Button>
      </template>
    </Dialog>

    <!-- 删除确认框已移除 - 右侧面板为预览状态，无需二次确认 -->

    <!-- Add New Item Dialog -->
    <Dialog v-model:show="isAddNewItemDialogOpen" title="添加新项目" minWidth="600px" persistent enterToConfirm
      @confirm="confirmAddItem">
      <div class="add-item-form">
        <Tabs v-model="addItemType" :tabs="[
          { value: 'bookmark', text: '书签', icon: 'mdi-bookmark' },
          { value: 'folder', text: '文件夹', icon: 'mdi-folder' }
        ]" grow class="add-tabs" />
        <div class="form-fields">
          <Input v-model="newItemTitle" label="标题" variant="outlined" class="form-field" autofocus />
          <Input v-if="addItemType === 'bookmark'" v-model="newItemUrl" label="链接地址" variant="outlined" type="url"
            class="form-field" />
        </div>
      </div>
      <template #actions>
        <Button variant="text" @click="handleCancelAdd" :disabled="isAddingItem">
          取消
        </Button>
        <Button variant="primary" @click="confirmAddItem" :loading="isAddingItem">
          添加
        </Button>
      </template>
    </Dialog>

    <!-- Duplicate Confirmation Dialog -->
    <Dialog v-model:show="isDuplicateDialogOpen" title="发现重复项目" icon="mdi-alert-circle-outline" iconColor="warning"
      maxWidth="500px" enterToConfirm @confirm="confirmAddDuplicate">
      <div class="dialog-text">
        {{ duplicateInfo?.message }}. 确定要继续添加吗？
      </div>
      <template #actions>
        <Button variant="text" 
        @click="isDuplicateDialogOpen = false">
          取消
        </Button>
        <Button variant="primary" color="warning" @click="confirmAddDuplicate">
          继续添加
        </Button>
      </template>
    </Dialog>

    <!-- 取消添加确认框已移除 - 预览状态无需二次确认 -->

    <!-- Toast Notification -->
    <Toast v-model:show="snackbar" :text="snackbarText"
      :color="snackbarColor === 'success' ? 'success' : snackbarColor === 'error' ? 'error' : 'info'" :timeout="3000" />

    <!-- 清理功能组件 -->
    <CleanupProgress />
    <CleanupSettings />

    <!-- 操作确认对话框 -->
    <OperationConfirmDialog :show="isOperationConfirmDialogOpen" :session="currentOperationSession"
      :diffResult="pendingDiffResult" :isApplying="isApplyingOperations" :operationProgress="operationProgress"
      @update:show="hideOperationConfirmDialog" @confirm="confirmAndApplyOperations"
      @cancel="hideOperationConfirmDialog" />

  </App>
</template>

<style>
/* Global styles for management page to ensure full height and no overflow */
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.ghost-item {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>

<style scoped>
.app-container {
  background-color: var(--md-sys-color-surface-variant);
}

.app-bar-style {
  height: 64px;
  background-color: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--md-sys-color-outline-variant) !important;
}

.app-bar-logo {
  width: 32px;
  height: 32px;
  margin-right: 12px;
}

.app-bar-title-text {
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.main-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}



.panel-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}


.panel-header {
  font-size: 1rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
}

.apply-btn {
  box-shadow: 0 4px 15px rgba(var(--md-sys-color-primary), 0.4) !important;
}


.loading-overlay {
  --v-overlay-opacity: 0.8;
  backdrop-filter: blur(4px);
}

.loading-card {
  padding: 24px;
}

.loading-text {
  font-size: 1.25rem;
  font-weight: 500;
}

.loading-subtitle {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.overflow-y-auto {
  overflow-y: auto;
}

/* AcuityUI Specific Styles */
.fill-height {
  height: 100% !important;
}

.panel-col {
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.control-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.control-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.control-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}

.panel-title {
  flex: 1;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.panel-stats {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: var(--color-surface-variant);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: help;
  transition: all 0.15s ease;
}

.panel-stats:hover {
  background: var(--color-primary-alpha-10);
  transform: scale(1.02);
}

.stats-bookmarks {
  color: var(--color-primary);
}

.stats-separator {
  color: var(--color-text-tertiary);
  margin: 0 1px;
}

.stats-folders {
  color: var(--color-text-secondary);
}

.stats-change {
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 6px;
  margin-left: 4px;
  font-weight: 600;
}

.stats-increase {
  background: var(--color-success-alpha-20);
  color: var(--color-success);
}

.stats-decrease {
  background: var(--color-error-alpha-20);
  color: var(--color-error);
}

/* 🎯 超级缓存优化样式 */
.panel-stats.stats-optimized {
  background: linear-gradient(135deg, var(--color-primary-alpha-20), var(--color-success-alpha-20));
  border: 1px solid var(--color-primary-alpha-30);
  box-shadow: 0 1px 3px var(--color-primary-alpha-10);
}

.panel-stats.stats-optimized:hover {
  background: linear-gradient(135deg, var(--color-primary-alpha-30), var(--color-success-alpha-30));
  transform: scale(1.05);
  box-shadow: 0 2px 8px var(--color-primary-alpha-20);
}

.optimization-indicator {
  font-size: 10px;
  margin-left: 4px;
  opacity: 0.8;
  transition: opacity 0.15s ease;
  animation: optimizationGlow 2s ease-in-out infinite;
}

.optimization-indicator:hover {
  opacity: 1;
}

@keyframes optimizationGlow {
  0%, 100% { 
    opacity: 0.8;
    transform: scale(1);
  }
  50% { 
    opacity: 1;
    transform: scale(1.1);
  }
}

/* panel-content styles moved above to avoid duplication */


.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  gap: var(--spacing-md);
  color: var(--color-text-secondary);
}

.empty-text,
.empty-title {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

.empty-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.debug-info {
  padding: var(--spacing-md);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  margin: var(--spacing-md);
}

.debug-summary {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.debug-details {
  margin-top: var(--spacing-sm);
}

.debug-toggle {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.debug-data {
  font-size: var(--text-xs);
  margin-top: var(--spacing-xs);
  background: var(--color-surface);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.debug-expanded {
  font-size: var(--text-xs);
  margin-top: var(--spacing-xs);
  color: var(--color-text-tertiary);
}

.panel-col {
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.control-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.control-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.control-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-align: center;
  margin-top: var(--spacing-sm);
}

.apply-btn {
  transform: scale(1.2);
}

.cleanup-legend-wrapper {
  padding: 0 var(--spacing-lg) var(--spacing-md);
}

.cleanup-toolbar {
  margin-right: var(--spacing-md);
}

.filter-notice {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-info-alpha-10);
  border-left: 4px solid var(--color-info);
}

.filter-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.filter-text {
  font-size: var(--text-sm);
  color: var(--color-info);
}

.generating-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  gap: var(--spacing-lg);
}

.generating-progress {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.generating-icon {
  position: absolute;
  color: var(--color-primary);
}

.generating-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.generating-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.dialog-text {
  font-size: var(--text-base);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
}

.edit-form,
.add-item-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-field {
  width: 100%;
}

.add-tabs {
  margin-bottom: var(--spacing-md);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
}

.loading-spinner {
  margin-bottom: var(--spacing-md);
}

.loading-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.loading-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
</style>
