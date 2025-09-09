<script setup lang="ts">
import { onMounted, nextTick, watch, onUnmounted, ref } from "vue";
import { storeToRefs } from 'pinia'
import { useManagementStore } from '../stores/management-store'
import { PERFORMANCE_CONFIG } from '../config/constants'
import { logger } from "../utils/logger";
import BookmarkTree from "./BookmarkTree.vue";
import type { 
  BookmarkNode, 
  ChromeBookmarkTreeNode, 
  AnalysisData, 
  ApplicationStrategy,
  StorageData 
} from '../types'

// === 使用 Pinia Stores ===
const managementStore = useManagementStore()

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
  progressValue,
  progressTotal,
  
  // 对话框状态
  isApplyConfirmDialogOpen,
  isEditBookmarkDialogOpen,
  isDeleteBookmarkDialogOpen,
  isDeleteFolderDialogOpen,
  isAddNewItemDialogOpen,
  isDuplicateDialogOpen,
  isCancelConfirmDialogOpen,
  
  // 编辑状态
  editingBookmark,
  deletingBookmark,
  deletingFolder,
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
  isDeletingBookmark,
  isDeletingFolder,
  isApplyingChanges,
  
  // 通知状态
  snackbar,
  snackbarText,
  snackbarColor,
  
  // 复杂状态
  bookmarkMapping,
  originalExpandedFolders,
  proposalExpandedFolders,
  hoveredBookmarkId,
  
  // 计算属性
  getProposalPanelTitle,
  getProposalPanelIcon,
  getProposalPanelColor
} = storeToRefs(managementStore)

// 解构 actions (不需要 storeToRefs)
const {
  // 初始化
  initialize,
  // 工具函数
  parseUrlParams,
  showDataReadyNotification,
  // 数据操作
  loadFromChromeStorage,
  setRightPanelFromLocalOrAI,
  recoverOriginalTreeFromChrome,
  rebuildOriginalIndexes,
  // 书签操作
  editBookmark,
  deleteBookmark,
  deleteFolder,
  addNewItem,
  // 展开/折叠操作
  toggleOriginalFolder,
  toggleProposalFolder
} = managementStore

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

// 本地搜索书签 - 预留功能，未来用于实现本地搜索功能
// @ts-ignore - 预留功能，暂时未使用
const searchBookmarksLocally = async (query: string) => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: "searchBookmarks",
      query: query.trim(),
      limit: 20,
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

// 强制刷新旧逻辑已移除
// 测试数据同步功能（已移除触发按钮，保留函数无用）

// Debug build identifier - 使用配置常量
const DEBUG_BUILD_ID = "BID-b7f2d9";

// 注意：以下所有状态变量现在都在store中，通过storeToRefs解构使用：
// isGenerating, progressValue, progressTotal, isPageLoading, loadingMessage, cacheStatus,
// isApplyConfirmDialogOpen, snackbar, snackbarText, snackbarColor,
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
      try { logger.info('Management', '📚 chrome.bookmarks.getTree 返回原始数据 [root]:', tree); } catch {}
      const liveFull = extractFullTreeFromRoot(tree as ChromeBookmarkTreeNode[]);
      try { logger.info('Management', '📚 提取后的 fullTree（两个顶层容器）:', liveFull); } catch {}
      const liveFp = buildFingerprintFromFullTree(liveFull);
      const localFp = buildFingerprintFromFullTree(originalTree.value);
      if (liveFp !== localFp) {
        try {
          logger.info('Management', '检测到书签变化，自动刷新缓存');
        } catch {}
        originalTree.value = liveFull;
        rebuildOriginalIndexes(liveFull);
        // 覆盖 storage 为 [root] 结构
        chrome.storage.local.set({ originalTree: tree });
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
        } catch {}
      }
    });
  } catch {}
};

// Generate unique ID for each bookmark instance
const generateBookmarkId = (node: BookmarkNode): string => {
  if (!node || !node.url) return "";

  // Create truly unique ID by including node ID and other properties
  const identifier = `${node.id || "no-id"}|${node.url}|${node.title || ""}|${
    node.dateAdded || ""
  }`;
  try {
    // Encode the string to handle Unicode characters
    const encoded = encodeURIComponent(identifier);
    return btoa(encoded)
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 16);
  } catch (error) {
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
    // 获取原始和目标数据
    const originalData = originalTree.value || [];
    const proposedData = newProposalTree.value.children || [];

    // 执行完整的变化分析
    const analysis = analyzeBookmarkChanges(originalData, proposedData);

    // 基于Chrome API操作复杂度计算应用策略
    const strategy = calculateApplicationStrategy(analysis);

    // 显示详细分析报告
    showAnalysisReport(analysis, strategy);

  } catch (error) {
    alert("复杂度分析失败: " + (error as Error).message);
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
    }
    
    // 只对文件夹节点设置children属性
    if (node.children && Array.isArray(node.children)) {
      bookmarkNode.children = node.children as BookmarkNode[]
    }
    
    return bookmarkNode
  }
  
  // 收集所有项目信息（优化版本）
  const collectItems = (nodes: (ChromeBookmarkTreeNode | BookmarkNode)[], map: Map<string, BookmarkNode>, parentPath: string = '', parentId: string = '') => {
    for (const node of nodes || []) {
      const fullPath = parentPath ? `${parentPath}/${node.title}` : node.title;

      // 使用Chrome书签ID作为唯一标识
      const uniqueId = node.id || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 检测特殊文件夹（根据Chrome API文档）
      const isSpecialFolder = ['书签栏', '其他书签', '移动设备书签', '受管理书签'].includes(node.title) ||
                             ['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks', 'Managed bookmarks'].includes(node.title);

      const bookmarkNode = ensureBookmarkNode(node)
      map.set(uniqueId, {
        ...bookmarkNode,
        path: fullPath,
        parentPath: parentPath,
        parentId: parentId,
        type: node.url ? 'bookmark' : 'folder',
        hasChildren: !!(node.children && node.children.length > 0),
        isSpecialFolder: isSpecialFolder,
        // 添加Chrome API相关属性
        index: node.index,
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
const buildBookmarkMapping = (originalTree: ChromeBookmarkTreeNode[], proposedTree: BookmarkNode[]) => {
  bookmarkMapping.value.clear();

  // 性能优化：批量处理书签，避免频繁的Map操作
  const mappingUpdates: Map<string, { original: BookmarkNode | null; proposed: BookmarkNode | null }> =
    new Map();

  // Helper function to assign unique IDs and build mapping
  const processBookmarks = (nodes: (ChromeBookmarkTreeNode | BookmarkNode)[], isOriginal: boolean = true) => {
    for (const node of nodes) {
      if (node.url) {
        // This is a bookmark - assign unique ID
        const bookmarkId = generateBookmarkId(node);
        node.uniqueId = bookmarkId; // Add unique ID to node

        // 批量收集映射更新
        if (!mappingUpdates.has(bookmarkId)) {
          mappingUpdates.set(bookmarkId, {
            original: isOriginal ? node : null,
            proposed: !isOriginal ? node : null,
          });
        } else {
          const existing = mappingUpdates.get(bookmarkId);
          if (existing) {
            if (isOriginal) {
              existing.original = node;
            } else {
              existing.proposed = node;
            }
          }
        }
      } else if (node.children) {
        // This is a folder, traverse children
        processBookmarks(node.children, isOriginal);
      }
    }
  };

  // 执行处理
  if (originalTree) processBookmarks(originalTree, true);
  if (proposedTree) processBookmarks(proposedTree, false);

  // 批量更新Map，避免频繁操作
  for (const [key, value] of mappingUpdates) {
    bookmarkMapping.value.set(key, value);
  }
};

// 在 originalTree 中按 url 优先、(url+title) 精确匹配回溯原节点
const findOriginalByUrlTitle = (url: string, title?: string): BookmarkNode | null => {
  const stack: BookmarkNode[] = Array.isArray(originalTree.value)
    ? [...originalTree.value]
    : [];
  let fallbackByUrl: BookmarkNode | null = null;
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.url) {
      if (node.url === url && (!title || node.title === title)) {
        return node;
      }
      if (!fallbackByUrl && node.url === url) {
        fallbackByUrl = node;
      }
    } else if (Array.isArray(node.children)) {
      for (const child of node.children) stack.push(child);
    }
  }
  return fallbackByUrl;
};

// 文件夹展开/折叠现在直接通过组件的v-model处理，不再需要单独的处理器

// 防抖hover处理，避免频繁触发 - 使用性能工具
let hoverTimeout: number | null = null;
// 防抖hover处理已移至store中处理
let hoverScrollInProgress = false;

// 在左侧容器内等待元素出现（避免匹配右侧同名书签）
const waitForElementInLeft = async (selector: string, timeoutMs: number = 2000): Promise<Element | null> => {
  const start = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      const scope: ParentNode = leftPanelRef.value ?? document;
      const el = scope.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (performance.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
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

    let mapping = bookmarkMapping.value.get(bookmarkId || "");
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
const expandFolderPathRecursive = (nodes: BookmarkNode[], targetNode: BookmarkNode) => {
  for (const node of nodes) {
    if (node.children) {
      if (findNodeInChildren(node.children, targetNode)) {
        originalExpandedFolders.value.add(node.id);

        // Force reactivity update for recursive additions too
        originalExpandedFolders.value = new Set(originalExpandedFolders.value);

        expandFolderPathRecursive(node.children, targetNode);
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
    behavior: "smooth",
    block: "center",
    inline: "nearest",
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
    console.warn("🚨 [比较函数] 递归深度过深，停止处理:", depth);
    return [];
  }

  return nodes
    .map((node) => {
      // 检查是否已经访问过这个节点（防止循环引用）
      if (visited.has(node.id)) {
        console.warn("🚨 [比较函数] 检测到循环引用，跳过节点:", node.id);
        return {
          title: node.title,
          id: node.id,
          url: node.url,
        };
      }

      const newVisited = new Set(visited);
      newVisited.add(node.id);

      const newNode: BookmarkNode = {
        title: node.title,
        id: node.id,
        url: node.url,
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
  if (newProposalTree.value.id === "root-shortcut") {
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
    if (typeof window !== "undefined") {
      const g: Record<string, unknown> = (window as unknown as Record<string, unknown>).__AB__ as Record<string, unknown> || ((window as unknown as Record<string, unknown>).__AB__ = {});
      g.originalTree = originalTree;
      g.newProposalTree = newProposalTree;
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
  } catch {}

  logger.info("Management", "🎯 [页面初始化] Management页面已挂载");
  logger.info(
    "Management",
    "🎯 [初始状态] dataLoaded:",
    dataLoaded,
    "lastDataLoadTime:",
    lastDataLoadTime
  );
  logger.info("Management", "🎯 [URL参数] 当前URL:", window.location.href);
  logger.info("Management", "🎯 [右侧面板] 初始状态:", newProposalTree.value.id);

  // 性能优化：检查是否可以跳过数据加载
  const now = Date.now();
  if (dataLoaded && now - lastDataLoadTime < PERFORMANCE_CONFIG.DATA_CACHE_TIME) {
    logger.info("Management", "📦 [缓存使用] 使用缓存数据，跳过重新加载");
    isPageLoading.value = false;
    loadingMessage.value = "";
    return;
  }

  // 解析URL参数，确定进入模式
  const urlMode = parseUrlParams();

  // 根据模式设置初始化行为
  if (urlMode === "manual") {
  } else if (urlMode === "ai") {
  }

  // 显示初始加载状态
  loadingMessage.value = "正在检查本地数据...";

  // 页面已加载，直接请求数据准备，不触发页面重新打开
  chrome.runtime.sendMessage(
    {
      action: "prepareManagementData",
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
    } catch {}
  }, 300);

  chrome.runtime.onMessage.addListener((request) => {
    logger.info("Management", "📨 [消息监听] 收到消息:", request.action, request);
    if (request.action === "aiOrganizeStarted") {
      snackbarText.value = "AI正在分析您的书签结构，请稍候...";
      snackbar.value = true;
      snackbarColor.value = "info";
    } else if (request.action === "aiOrganizeComplete") {
      snackbarText.value = "AI建议结构已生成，请在右侧面板查看和调整";
      snackbar.value = true;
      snackbarColor.value = "success";
    } else if (request.action === "dataReady") {
      logger.info("Management", "🚀 [消息处理] 收到dataReady消息");
      logger.info("Management", "🚀 [消息详情] request:", JSON.stringify(request, null, 2));

      // 更新缓存状态
      cacheStatus.value.isFromCache = request.fromCache || false;

      // 处理本地数据状态
      if (request.localData) {
        if (
          request.localData.status === "cached" ||
          request.localData.status === "recovered"
        ) {
          // 优化：并行处理数据加载，减少串联延迟
          const loadStartTime = performance.now();

          // 并行获取两个数据源
          Promise.all([
            // 获取Chrome Storage数据
            new Promise((resolve, reject) => {
              chrome.storage.local.get(["originalTree"], (data) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else if (data.originalTree) {
                  // 修复：正确提取书签树的顶层文件夹（书签栏、其他书签等）
                  const fullTree: ChromeBookmarkTreeNode[] = [];

                  // data.originalTree 是 [root] 格式，直接取第一个根节点
                  const rootNode = data.originalTree[0];
                  if (
                    rootNode &&
                    rootNode.children &&
                    rootNode.children.length > 0
                  ) {
                    // 遍历所有顶层文件夹（书签栏、其他书签等）
                    rootNode.children.forEach((node: ChromeBookmarkTreeNode) => {
                      const treeNode: any = {
                        id: node.id,
                        title: node.title,
                        url: node.url,
                        parentId: node.parentId,
                        index: node.index,
                        dateAdded: node.dateAdded,
                      };
                      
                      // 只对文件夹节点设置children属性，且进行递归清理
                      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
                        // 递归处理子节点，确保只有真正的文件夹才有children属性
                        const ensureBookmarkNode = (child: any): any => {
                          const processedChild: any = {
                            id: child.id,
                            title: child.title,
                            url: child.url,
                            parentId: child.parentId,
                            index: child.index,
                            dateAdded: child.dateAdded,
                          };
                          
                          // 只有当子项确实是文件夹且有子项时才设置children属性
                          if (child.children && Array.isArray(child.children) && child.children.length > 0) {
                            processedChild.children = child.children.map(ensureBookmarkNode);
                          } else {
                          }
                          
                          return processedChild;
                        };
                        
                        treeNode.children = node.children.map(ensureBookmarkNode);
                      } else {
                      }
                      
                      fullTree.push(treeNode);
                    });
                  }
                  resolve(fullTree);
                } else {
                  reject(new Error("Chrome Storage load failed"));
                }
              });
            }),

            // 获取chrome.storage数据
            new Promise((resolve) => {
              chrome.storage.local.get(
                ["newProposal", "isGenerating"],
                (storageData) => {
                  resolve(storageData);
                }
              );
            }),
          ])
            .then((results) => {
              const treeData = results[0] as ChromeBookmarkTreeNode[];
              const storageData = results[1] as StorageData;
              // 如果顶层两个文件夹都无 children，触发兜底恢复
              const isTopEmpty =
                Array.isArray(treeData) &&
                treeData.length > 0 &&
                treeData.every(
                  (f: ChromeBookmarkTreeNode) => !f.children || (Array.isArray(f.children) && f.children.length === 0)
                );

              if (isTopEmpty) {
                recoverOriginalTreeFromChrome().then((recovered) => {
                  originalTree.value = recovered;
                  rebuildOriginalIndexes(recovered);
                  setRightPanelFromLocalOrAI(recovered, storageData as StorageData);
                  // 强制展开顶层
                  try {
                    recovered.forEach((f: ChromeBookmarkTreeNode) => (f.expanded = true));
                    originalExpandedFolders.value.clear();
                    recovered.forEach((f: ChromeBookmarkTreeNode) => {
                      if (
                        Array.isArray(f.children) &&
                        f.children.length > 0
                      ) {
                        originalExpandedFolders.value.add(f.id);
                      }
                    });
                    originalExpandedFolders.value = new Set(
                      originalExpandedFolders.value
                    );
                  } catch {}
                });
              } else {
                // 快速设置数据，减少UI阻塞
                originalTree.value = treeData;
                rebuildOriginalIndexes(treeData);
                // 右侧：AI 模式用 LLM 提案，否则默认克隆本地书签
                setRightPanelFromLocalOrAI(treeData, storageData as StorageData);

                // 默认展开顶层文件夹（若有子节点）
                try {
                  originalExpandedFolders.value.clear();
                  treeData.forEach((f: ChromeBookmarkTreeNode) => {
                    f.expanded = true;
                    if (
                      Array.isArray(f.children) &&
                      f.children.length > 0
                    ) {
                      originalExpandedFolders.value.add(f.id);
                    }
                  });
                  originalExpandedFolders.value = new Set(
                    originalExpandedFolders.value
                  );
                } catch (e) {}
              }

              // 批量更新UI状态
              updateComparisonState();
              isGenerating.value = Boolean(storageData.isGenerating) || false;

              // 构建映射
              if (
                originalTree.value &&
                newProposalTree.value.children &&
                newProposalTree.value.children.length > 0
              ) {
                buildBookmarkMapping(
                  originalTree.value,
                  newProposalTree.value.children
                );
              }

              // 立即设置加载完成状态
              isPageLoading.value = false;
              loadingMessage.value = "";

              // 设置数据加载缓存标志
              dataLoaded = true;

              cacheStatus.value.lastUpdate = request.localData.lastUpdate;
              cacheStatus.value.dataAge =
                Date.now() - request.localData.lastUpdate;

              // 注意：自动克隆逻辑已移到 originalTree 数据设置完成之后

              // 显示加载性能信息
              const loadTime = performance.now() - loadStartTime;
              logger.info("Management", `数据加载完成，耗时: ${loadTime.toFixed(2)}ms`, { count: request.localData.bookmarkCount, build: DEBUG_BUILD_ID });

              showDataReadyNotification(request.localData.bookmarkCount);
            })
            .catch((error) => {
              logger.warn("Management", "并行数据加载失败，降级到传统方式:", error);
              loadFromChromeStorage();
            });

          return; // 不继续执行下面的逻辑
        } else if (request.localData.status === "processed") {
          // 数据刚处理完成
          cacheStatus.value.lastUpdate = request.localData.lastUpdate;

          // 显示数据准备完成通知
          showDataReadyNotification(request.localData.bookmarkCount);
        } else if (request.localData.status === "fallback") {
          // 降级到基础模式
          cacheStatus.value.isFromCache = false;
        }
      }

      // 重新加载数据（兼容现有逻辑）
      chrome.storage.local.get(
        ["originalTree", "newProposal", "isGenerating"],
        (data) => {
          if (data.originalTree) {
            // 修复：获取完整的书签树结构，包括书签栏和其他书签
            const fullTree: ChromeBookmarkTreeNode[] = [];

            // 修复：正确处理书签树数据结构
            if (data.originalTree && data.originalTree.length > 0) {
              // 检查是否是 [root] 格式
              if (
                data.originalTree[0].children &&
                Array.isArray(data.originalTree[0].children)
              ) {
                // [root] 格式：取根节点的子节点
                const rootNode = data.originalTree[0];
                rootNode.children.forEach((folder: chrome.bookmarks.BookmarkTreeNode) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    // 🔑 修复：只对文件夹设置children
                    ...(folder.children && Array.isArray(folder.children) ? { children: folder.children as ChromeBookmarkTreeNode[] } : {}),
                    parentId: folder.parentId,
                    index: folder.index,
                    dateAdded: folder.dateAdded,
                    url: folder.url,
                  });
                });
              } else {
                // 直接是文件夹数组格式
                data.originalTree.forEach((folder: ChromeBookmarkTreeNode) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    // 🔑 修复：只对文件夹设置children
                    ...(folder.children && Array.isArray(folder.children) ? { children: folder.children } : {}),
                    parentId: folder.parentId,
                    index: folder.index,
                    dateAdded: folder.dateAdded,
                    url: folder.url,
                  });
                });
              }
            }
            const isTopEmpty =
              Array.isArray(fullTree) &&
              fullTree.length > 0 &&
              fullTree.every(
                (f: ChromeBookmarkTreeNode) => !f.children || (Array.isArray(f.children) && f.children.length === 0)
              );

            if (isTopEmpty) {
              recoverOriginalTreeFromChrome().then((recovered) => {
                originalTree.value = recovered;
                rebuildOriginalIndexes(recovered);
                setRightPanelFromLocalOrAI(recovered, { newProposal: data.newProposal });
                try {
                  originalExpandedFolders.value.clear();
                  recovered.forEach((f: ChromeBookmarkTreeNode) => {
                    f.expanded = true;
                    if (
                      Array.isArray(f.children) &&
                      f.children.length > 0
                    ) {
                      originalExpandedFolders.value.add(f.id);
                    }
                  });
                  originalExpandedFolders.value = new Set(
                    originalExpandedFolders.value
                  );
                } catch {}
              });
            } else {
              originalTree.value = fullTree;
              rebuildOriginalIndexes(fullTree);
              setRightPanelFromLocalOrAI(fullTree, { newProposal: data.newProposal });
              try {
                originalExpandedFolders.value.clear();
                fullTree.forEach((f: ChromeBookmarkTreeNode) => {
                  f.expanded = true;
                  if (
                    Array.isArray(f.children) &&
                    f.children.length > 0
                  ) {
                    originalExpandedFolders.value.add(f.id);
                  }
                });
                originalExpandedFolders.value = new Set(
                  originalExpandedFolders.value
                );
              } catch {}
            }
            updateComparisonState();

            // 🎯 在 originalTree 数据设置完成后立即检查是否需要自动克隆（消除延迟）
            const urlMode = parseUrlParams();
            console.log(
              "📋 [数据完成后] URL模式:",
              urlMode,
              "右侧面板状态:",
              newProposalTree.value.id
            );
            console.log(
              "📋 [数据完成后] originalTree长度:",
              originalTree.value?.length
            );
            console.log(
              "📋 [数据完成后] originalTree内容:",
              originalTree.value?.map((item) => ({
                title: item.title,
                childrenCount: item.children?.length,
              }))
            );

            // 检查是否需要自动克隆
            const shouldAutoClone = false;

            if (shouldAutoClone) {
              console.log(
                "✅ [自动克隆] 原因:",
                newProposalTree.value.id === "root-empty"
                  ? "右侧面板为空"
                  : "右侧面板数据不完整"
              );
              // 立即执行，不使用延迟
              console.log(
                "🚀 [自动克隆] 开始执行自动克隆，当前originalTree:",
                originalTree.value?.length
              );
            } else {
            }

            if (originalTree.value && newProposalTree.value.children) {
              buildBookmarkMapping(
                originalTree.value,
                newProposalTree.value.children
              );
            }
          }
          isGenerating.value = data.isGenerating || false;

          // 更新加载状态
          setTimeout(() => {
            isPageLoading.value = false;
            loadingMessage.value = "";
          }, 100);
        }
      );
    } else if (request.action === "dataRefreshed") {
      // 更新缓存状态
      cacheStatus.value.isFromCache = false;

      // 重新加载数据
      chrome.storage.local.get(
        ["originalTree", "newProposal", "isGenerating", "cacheInfo"],
        (data) => {
          if (data.originalTree) {
            // 修复：获取完整的书签树结构，包括书签栏和其他书签
            const fullTree: ChromeBookmarkTreeNode[] = [];

            // 修复：正确处理书签树数据结构
            if (data.originalTree && data.originalTree.length > 0) {
              // 检查是否是 [root] 格式
              if (
                data.originalTree[0].children &&
                Array.isArray(data.originalTree[0].children)
              ) {
                // [root] 格式：取根节点的子节点
                const rootNode = data.originalTree[0];
                rootNode.children.forEach((folder: chrome.bookmarks.BookmarkTreeNode) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    // 🔑 修复：只对文件夹设置children
                    ...(folder.children && Array.isArray(folder.children) ? { children: folder.children as ChromeBookmarkTreeNode[] } : {}),
                    parentId: folder.parentId,
                    index: folder.index,
                    dateAdded: folder.dateAdded,
                    url: folder.url,
                  });
                });
              } else {
                // 直接是文件夹数组格式
                data.originalTree.forEach((folder: ChromeBookmarkTreeNode) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    // 🔑 修复：只对文件夹设置children
                    ...(folder.children && Array.isArray(folder.children) ? { children: folder.children } : {}),
                    parentId: folder.parentId,
                    index: folder.index,
                    dateAdded: folder.dateAdded,
                    url: folder.url,
                  });
                });
              }
            }
            originalTree.value = fullTree;
            rebuildOriginalIndexes(fullTree);

            // 修复：dataRefreshed时保持右侧面板现有状态，避免覆盖用户操作
            const currentRightPanelState = newProposalTree.value.id;
            console.log(
              "dataRefreshed - 当前右侧面板状态:",
              currentRightPanelState
            );

            // 只有在右侧面板为空时才重新设置，否则保持现有状态
            if (currentRightPanelState === "root-empty") {
              console.log("右侧面板为空，重新设置数据");
              if (data.newProposal && typeof data.newProposal === "object") {
                const proposal = convertLegacyProposalToTree(data.newProposal);
                newProposalTree.value = { ...proposal };
              } else {
                newProposalTree.value = {
                  title: "root",
                  children: [],
                  id: "root-empty",
                };
              }
            } else {
              console.log(
                "右侧面板有数据，保持现有状态:",
                currentRightPanelState
              );
            }

            updateComparisonState();

            if (originalTree.value && newProposalTree.value.children) {
              buildBookmarkMapping(
                originalTree.value,
                newProposalTree.value.children
              );
            }

            // 更新缓存信息
            if (data.cacheInfo) {
              cacheStatus.value.lastUpdate = data.cacheInfo.lastUpdate;
              cacheStatus.value.dataAge = null; // 强制刷新后数据是新的
            }
          }
          isGenerating.value = data.isGenerating || false;

          // 显示强制刷新成功的提示
          snackbarText.value = "数据已强制刷新并更新";
          snackbar.value = true;
          snackbarColor.value = "success";
        }
      );
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.isGenerating)
      isGenerating.value = changes.isGenerating.newValue;
    if (changes.progressCurrent || changes.progressTotal) {
      chrome.storage.local.get(["progressCurrent", "progressTotal"], (data) => {
        progressTotal.value = data.progressTotal || 0;
        const current = data.progressCurrent || 0;
        progressValue.value =
          progressTotal.value > 0 ? (current / progressTotal.value) * 100 : 0;
      });
    }
    if (changes.newProposal && changes.newProposal.newValue) {
      // 修复：不要覆盖用户已经克隆或手动设置的数据
      const currentState = newProposalTree.value.id;
      console.log(
        "🔄 Storage变化监听器 - newProposal变化，当前右侧面板状态:",
        currentState
      );
      console.log(
        "🔄 Storage变化监听器 - 新的proposal数据:",
        changes.newProposal.newValue
      );

      // 只有在右侧面板为空时才应用新的proposal数据，避免覆盖已克隆的数据
      if (currentState === "root-empty") {
        const proposal = convertLegacyProposalToTree(
          changes.newProposal.newValue
        );
        newProposalTree.value = JSON.parse(JSON.stringify(proposal));
        updateComparisonState();
      } else {
        console.log(
          "🚫 Storage监听器：右侧面板有数据，跳过覆盖:",
          currentState
        );
      }
    }
  });
});

// --- Methods ---

const applyChanges = () => (isApplyConfirmDialogOpen.value = true);

// 直接在前端应用更改到浏览器
const confirmApplyChanges = async (): Promise<void> => {
  isApplyingChanges.value = true;
  console.log(
    "🔄 [前端应用] 要应用的proposal:",
    JSON.stringify(newProposalTree.value, null, 2)
  );

  try {
    // 1. 创建备份文件夹
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
      now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const backupFolder = await new Promise<ChromeBookmarkTreeNode>(
      (resolve, reject) => {
        chrome.bookmarks.create(
          {
            parentId: "2", // 'Other bookmarks'
            title: `AcuityBookmarks Backup [${timestamp}]`,
          },
          (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result as ChromeBookmarkTreeNode);
            }
          }
        );
      }
    );

    // 2. 移动现有书签到备份文件夹
    const bookmarksBar = await new Promise<ChromeBookmarkTreeNode[]>(
      (resolve, reject) => {
        chrome.bookmarks.getChildren("1", (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve((result || []) as ChromeBookmarkTreeNode[]);
          }
        });
      }
    );

    const otherBookmarks = await new Promise<
      ChromeBookmarkTreeNode[]
    >((resolve, reject) => {
      chrome.bookmarks.getChildren("2", (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve((result || []) as ChromeBookmarkTreeNode[]);
        }
      });
    });


    // 移动书签栏内容到备份
    for (const node of bookmarksBar) {
      await new Promise<void>((resolve, reject) => {
        chrome.bookmarks.move(node.id, { parentId: backupFolder.id }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }

    // 移动其他书签内容到备份（除了刚创建的备份文件夹）
    for (const node of otherBookmarks) {
      if (node.id !== backupFolder.id) {
        await new Promise<void>((resolve, reject) => {
          chrome.bookmarks.move(node.id, { parentId: backupFolder.id }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    }

    // 3. 创建新的书签结构
    const proposalRoot = newProposalTree.value.children || [];
    const proposalBookmarksBar = proposalRoot.find((n) => n.title === "书签栏");
    const proposalOtherBookmarks = proposalRoot.find(
      (n) => n.title === "其他书签"
    );


    const createNodes = async (
      nodes: BookmarkNode[],
      parentId: string
    ): Promise<void> => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          // 有内容的文件夹
          const newFolder =
            await new Promise<ChromeBookmarkTreeNode>(
              (resolve, reject) => {
                chrome.bookmarks.create(
                  { parentId, title: node.title },
                  (result) => {
                    if (chrome.runtime.lastError) {
                      reject(chrome.runtime.lastError);
                    } else {
                      resolve(result as ChromeBookmarkTreeNode);
                    }
                  }
                );
              }
            );
          await createNodes(node.children, newFolder.id);
        } else if (!node.children) {
          // 书签
          await new Promise<void>((resolve, reject) => {
            chrome.bookmarks.create(
              { parentId, title: node.title, url: node.url },
              () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              }
            );
          });
        }
        // 空文件夹被忽略
      }
    };

    if (proposalBookmarksBar && proposalBookmarksBar.children) {
      await createNodes(proposalBookmarksBar.children, "1");
    }
    if (proposalOtherBookmarks && proposalOtherBookmarks.children) {
      await createNodes(proposalOtherBookmarks.children, "2");
    }


    // 4. 直接刷新左侧面板数据
    const updatedTree = await new Promise<ChromeBookmarkTreeNode[]>(
      (resolve, reject) => {
        chrome.bookmarks.getTree((tree) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tree as ChromeBookmarkTreeNode[]);
          }
        });
      }
    );

    const fullTree: ChromeBookmarkTreeNode[] = [];

    if (updatedTree && updatedTree.length > 0) {
      if (updatedTree[0].children && Array.isArray(updatedTree[0].children)) {
        const rootNode = updatedTree[0];

        (rootNode.children as ChromeBookmarkTreeNode[])?.forEach((folder: ChromeBookmarkTreeNode) => {
          console.log(
            "🔄 [前端应用] 处理文件夹:",
            folder.title,
            "子项数量:",
            folder.children?.length
          );

          // 🔑 关键修复：只对文件夹设置children，避免书签被错误识别为文件夹
          const nodeData: any = {
            id: folder.id,
            title: folder.title,
            url: folder.url,
            parentId: folder.parentId,
            index: folder.index,
            dateAdded: folder.dateAdded,
          };
          
          // 只有当节点确实有children时才设置children属性（文件夹才有）
          if (folder.children && Array.isArray(folder.children)) {
            nodeData.children = folder.children as ChromeBookmarkTreeNode[];
          }
          
          fullTree.push(nodeData);
        });
      } else {
      }
    } else {
    }

    console.log(
      "🔄 [前端应用] 更新前的originalTree:",
      JSON.stringify(originalTree.value, null, 2)
    );

    // 强制触发响应式更新 - 使用深度克隆确保完全独立的数据
    originalTree.value = JSON.parse(JSON.stringify(fullTree));
    rebuildOriginalIndexes(originalTree.value);

    console.log(
      "🔄 [前端应用] 更新后的originalTree:",
      JSON.stringify(originalTree.value, null, 2)
    );
    console.log(
      "🔄 [前端应用] 左侧面板已更新，数量:",
      originalTree.value.length
    );

    // 使用nextTick确保DOM更新
    await nextTick();

    // 清除拖拽变更标记
    hasDragChanges.value = false;

    // 重新计算比较状态，确保按钮状态正确
    try {
      updateComparisonState();
    } catch (error) {
      console.error("🚨 [前端应用] 比较状态计算出错:", error);
      // 如果比较出错，直接设置为无变更状态
      hasDragChanges.value = false;
      structuresAreDifferent.value = false;
    }

    // 关闭确认对话框
    isApplyConfirmDialogOpen.value = false;

    // 显示成功消息
    snackbarText.value = "书签结构已成功应用！";
    snackbar.value = true;
  } catch (error: unknown) {
    console.error("🔄 [前端应用] 应用更改失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    snackbarText.value = `应用更改失败: ${errorMessage}`;
    snackbar.value = true;
  } finally {
    isApplyingChanges.value = false;
  }
};

const handleReorder = (): void => {

  // 立即设置拖拽变更标记
  hasDragChanges.value = true;

  // 强制触发响应式更新，让Vue检测到数组内部的变化
  const currentChildren = newProposalTree.value.children
    ? [...newProposalTree.value.children]
    : [];

  // 创建一个新的对象来确保Vue检测到变化
  // 添加时间戳确保对象确实发生了变化
  newProposalTree.value = {
    ...newProposalTree.value,
    children: currentChildren,
    dateAdded: Date.now() // 添加时间戳标记变更
  };


  // 关键修复：拖拽后按钮仍保持可用
  nextTick(() => {
    structuresAreDifferent.value = true; // 仅用于显示提示
  });
};

// --- Bookmark Operations ---
// 编辑书签处理器 - 现在使用store action
const handleEditBookmark = (node: BookmarkNode) => {
  editBookmark(node);
};

// 删除书签处理器 - 现在使用store action
const handleDeleteBookmark = (node: BookmarkNode) => {
  deleteBookmark(node);
};

// 删除文件夹处理器 - 现在使用store action
const handleDeleteFolder = (node: BookmarkNode) => {
  deleteFolder(node);
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

const confirmDeleteBookmark = async () => {
  if (!deletingBookmark.value) return;

  isDeletingBookmark.value = true;

  try {
    // 模拟网络请求延迟
    await new Promise((resolve) => setTimeout(resolve, 600));

    // 注意：右侧面板只是预览编辑区，只修改本地数据，不与Chrome API交互
    // 只有点击应用按钮时才会一次性更新Chrome书签
    
    // 只从右侧面板数据中移除项目（预览编辑区）
    if (newProposalTree.value.children) {
      removeBookmarkFromTree(newProposalTree.value.children, deletingBookmark.value.id);
    }

    snackbarText.value = `已删除书签: ${deletingBookmark.value.title}（预览）`;
    snackbar.value = true;
    snackbarColor.value = "success";

    // 响应式系统会自动检测变化并更新按钮状态
    isDeleteBookmarkDialogOpen.value = false;
    deletingBookmark.value = null;
  } catch (error) {
    snackbarText.value = "删除书签失败，请重试";
    snackbar.value = true;
    snackbarColor.value = "error";
  } finally {
    isDeletingBookmark.value = false;
  }
};

// 检查文件夹是否包含书签的辅助函数
const countBookmarksInFolder = (folder: any): number => {
  if (!folder || !folder.children) return 0;
  
  let count = 0;
  for (const child of folder.children) {
    if (child.url) {
      // 这是一个书签
      count++;
    } else if (child.children) {
      // 这是一个子文件夹，递归计算
      count += countBookmarksInFolder(child);
    }
  }
  return count;
};

const confirmDeleteFolder = async () => {
  if (!deletingFolder.value) return;

  // 检查文件夹是否包含书签
  const bookmarkCount = countBookmarksInFolder(deletingFolder.value);
  
  if (bookmarkCount > 0) {
    // 如果包含书签，需要二次确认
    const confirmed = confirm(`文件夹 "${deletingFolder.value.title}" 包含 ${bookmarkCount} 个书签。确定要删除吗？此操作无法撤销。`);
    if (!confirmed) {
      return;
    }
  }

  isDeletingFolder.value = true;

  try {
    // 注意：右侧面板只修改本地数据，不与Chrome API交互
    // 这里应该根据当前操作的面板来决定是否调用Chrome API
    
    // 如果是左侧面板的操作，才调用Chrome API
    // 右侧面板只修改本地数据
    
    // 模拟网络请求延迟
    await new Promise((resolve) => setTimeout(resolve, 600));

    // 从右侧面板数据中移除文件夹（预览编辑区）
    if (newProposalTree.value.children) {
      removeBookmarkFromTree(newProposalTree.value.children, deletingFolder.value.id);
    }

    snackbarText.value = `已删除文件夹: ${deletingFolder.value.title}`;
    snackbar.value = true;
    snackbarColor.value = "success";

    // 响应式系统会自动检测变化并更新按钮状态
    isDeleteFolderDialogOpen.value = false;
    deletingFolder.value = null;
  } catch (error) {
    snackbarText.value = "删除文件夹失败，请重试";
    snackbar.value = true;
    snackbarColor.value = "error";
  } finally {
    isDeletingFolder.value = false;
  }
};

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
      url: editUrl.value.trim() || undefined,
    };

    // 注意：右侧面板只是预览编辑区，只修改本地数据，不与Chrome API交互
    // 只有点击应用按钮时才会一次性更新Chrome书签
    
    // 只更新右侧面板数据（预览编辑区）
    if (newProposalTree.value.children) {
      updateBookmarkInTree(newProposalTree.value.children, editingBookmark.value.id, updates);
    }

    snackbarText.value = "书签已更新（预览）";
    snackbar.value = true;
    snackbarColor.value = "success";

    // 响应式系统会自动检测变化并更新按钮状态
    isEditBookmarkDialogOpen.value = false;
    editingBookmark.value = null;
    editTitle.value = "";
    editUrl.value = "";
  } catch (error) {
    snackbarText.value = "更新书签失败，请重试";
    snackbar.value = true;
    snackbarColor.value = "error";
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
  newItemTitle.value = "";
  newItemUrl.value = "";
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
  type: "folder" | "bookmark"
): any => {
  const parentChildren = parentFolder.value?.children || [];

  // 检查同级目录是否有相同名称
  const nameDuplicates = parentChildren.filter(
    (child: any) =>
      child.title === title &&
      ((type === "folder" && child.children) ||
        (type === "bookmark" && !child.children))
  );

  if (nameDuplicates.length > 0) {
    return {
      type: "name",
      duplicates: nameDuplicates,
      message: `同级目录中已存在名称 "${title}" 的${
        type === "folder" ? "文件夹" : "书签"
      }`,
    };
  }

  // 如果是书签，检查整个书签树是否有相同URL
  if (type === "bookmark" && url) {
    const urlDuplicates = findUrlDuplicates(
      originalTree.value,
      url,
      parentFolder.value?.id || ''
    );
    if (urlDuplicates.length > 0) {
      return {
        type: "url",
        duplicates: urlDuplicates,
        message: `整个书签目录中已存在URL "${url}" 的书签`,
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
          path: path.join(" / "),
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
  newItemTitle.value = "";
  newItemUrl.value = "";
  addItemType.value = "bookmark";
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
    title: title,
    dateAdded: Date.now(),
    index: 0, // 新项目放在最顶部
  };

  if (addItemType.value === "bookmark") {
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
  snackbarText.value = `已添加${
    addItemType.value === "folder" ? "文件夹" : "书签"
  }: ${title}`;
  snackbar.value = true;
  snackbarColor.value = "success";
};

const confirmAddDuplicate = () => {
  isDuplicateDialogOpen.value = false;
  addItemToTree();
};

function convertLegacyProposalToTree(
  proposal: Record<string, any>
): ProposalNode {
  // 根据数据内容判断数据来源，设置正确的id
  let rootId = "root-0"; // 默认AI建议
  let rootTitle = "AI 建议结构";

  // 如果proposal中有特殊标记，说明是克隆的数据
  if (proposal._source === "cloned") {
    rootId = "root-cloned";
    rootTitle = "克隆的书签结构";
  } else if (proposal._source === "quick") {
    rootId = "root-quick";
    rootTitle = "快速预览结构";
  } else if (proposal._source === "ai") {
    rootId = "root-0";
    rootTitle = "AI 建议结构";
  }

  // 如果没有_source标记但数据结构看起来像克隆的数据，则自动识别
  if (
    !proposal._source &&
    proposal["书签栏"] &&
    typeof proposal["书签栏"] === "object"
  ) {
    // 检查是否包含原始书签结构特征（有书签栏且结构完整）
    const bookmarkBar = proposal["书签栏"];
    if (Object.keys(bookmarkBar).length > 0) {
      // 如果没有明确标记但有完整书签栏结构，则认为是克隆数据
      rootId = "root-cloned";
      rootTitle = "克隆的书签结构";
    }
  }

  // 如果没有任何特殊结构，可能是AI生成的数据
  if (
    !proposal._source &&
    !proposal["书签栏"] &&
    Object.keys(proposal).length > 0
  ) {
    rootId = "root-0";
    rootTitle = "AI 建议结构";
  }

  const root: ProposalNode = { title: rootTitle, children: [], id: rootId };

  // 验证参数是否有效
  if (!proposal || typeof proposal !== "object") {
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
          id: `folder-${Date.now()}-${Math.random()}`,
        };
        current.children = current.children || [];
        current.children.push(node);
      }
      current = node;
    });
    return current;
  };

  // 安全地检查书签栏
  if (proposal["书签栏"] && typeof proposal["书签栏"] === "object") {
    for (const categoryPath in proposal["书签栏"]) {
      const pathParts = categoryPath.split(" / ");
      const leafNode = findOrCreateNode(["书签栏", ...pathParts]);
      const bookmarks = proposal["书签栏"][categoryPath];
      if (Array.isArray(bookmarks)) {
        leafNode.children?.push(...bookmarks);
      }
    }
  }
  // 安全地检查其他书签
  if (proposal["其他书签"] && Array.isArray(proposal["其他书签"])) {
    const otherBookmarksNode = findOrCreateNode(["其他书签"]);
    otherBookmarksNode.children = proposal["其他书签"];
  }
  return root;
}

// 将树状结构转换为legacy proposal格式

const expandAllFolders = (isOriginal: boolean) => {
  const tree = isOriginal
    ? originalTree.value
    : newProposalTree.value.children || [];
  const targetSet = isOriginal
    ? originalExpandedFolders
    : proposalExpandedFolders;

  const folderIds = new Set<string>();
  const collectFolderIds = (nodes: any[]) => {
    for (const node of nodes) {
      if (node.children) {
        folderIds.add(node.id);
        collectFolderIds(node.children);
      }
    }
  };

  collectFolderIds(tree);
  targetSet.value = folderIds;
};

const collapseAllFolders = (isOriginal: boolean) => {
  if (isOriginal) {
    originalExpandedFolders.value = new Set();
  } else {
    proposalExpandedFolders.value = new Set();
  }
};

const handleDrop = (data: {
  draggedId: string;
  targetId: string;
  position: "before" | "after" | "inside";
  isOriginal: boolean;
}) => {
  if (data.isOriginal) return;

  // Actual reordering logic needs to be implemented here based on data.draggedId, data.targetId, etc.
  // For now, just mark that a change has occurred.
  handleReorder();
};
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
        <img src="/logo.png" alt="AcuityBookmarks Logo" class="app-bar-logo" />
        <div class="app-bar-title-text">AcuityBookmarks</div>
      </v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn variant="tonal" color="secondary" @click="testComplexityAnalysis">
        <v-icon start>mdi-chart-line</v-icon>
        Test Complexity
      </v-btn>
      <v-chip size="small" variant="outlined" class="ml-4">Build {{ DEBUG_BUILD_ID }}</v-chip>
    </v-app-bar>

    <v-main class="main-content">
      <v-container fluid class="fill-height">
        <v-row class="fill-height" align="stretch">
          <!-- Current Structure Panel -->
          <v-col cols="12" md="5" class="d-flex flex-column fill-height">
            <v-card class="flex-grow-1 d-flex flex-column panel-card" elevation="2">
              <v-card-title class="panel-header d-flex align-center">
                <v-icon start color="primary">mdi-folder-open-outline</v-icon>
                <span class="flex-grow-1">当前书签目录</span>
                <v-btn icon size="x-small" variant="text" @click="() => expandAllFolders(true)" title="展开所有文件夹">
                  <v-icon>mdi-expand-all-outline</v-icon>
                </v-btn>
                <v-btn icon size="x-small" variant="text" @click="() => collapseAllFolders(true)" title="折叠所有文件夹">
                  <v-icon>mdi-collapse-all-outline</v-icon>
                </v-btn>
                <!-- 调试按钮：手动测试展开状态 -->
                <v-btn icon size="x-small" variant="text" @click="() => {
                  if (originalTree.length > 0 && originalTree[0]) {
                    toggleOriginalFolder(originalTree[0].id);
                  }
                }" title="调试：切换第一个文件夹">
                  <v-icon>mdi-bug</v-icon>
                </v-btn>
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text class="flex-grow-1 pa-0" style="min-height: 0" ref="leftPanelRef">
                <div class="scrolling-content">
                  <!-- 调试信息 -->
                  <div v-if="originalTree.length === 0" class="pa-4 text-center">
                    <v-icon size="48" color="grey-lighten-1">mdi-folder-outline</v-icon>
                    <div class="mt-2 text-grey">正在加载书签数据...</div>
                  </div>
                  <div v-else-if="originalTree.length > 0" class="pa-2">
                    <small class="text-grey">
                      📊 左侧面板数据: {{ originalTree.length }} 个顶层文件夹，
                      展开状态: {{ originalExpandedFolders.size }} 个文件夹
                    </small>
                    <details class="mt-2">
                      <summary class="text-xs text-grey cursor-pointer">🔍 详细数据结构</summary>
                      <pre class="text-xs mt-1">{{ JSON.stringify(originalTree, null, 2) }}</pre>
                      <div class="text-xs mt-1">展开ID列表: {{ Array.from(originalExpandedFolders) }}</div>
                    </details>
                  </div>
                  
                  <BookmarkTree
                    :nodes="originalTree"
                    :search-query="searchQuery"
                    :expanded-folders="originalExpandedFolders"
                    :is-original="true"
                    :is-sortable="false"
                  />
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Control Panel -->
          <v-col cols="12" md="2" class="d-flex flex-column align-center justify-center">
              <div class="d-flex flex-column align-center">
                  <v-btn icon="mdi-compare-horizontal" variant="tonal" color="secondary" size="large" class="mb-2" :disabled="true">
                      <v-icon>mdi-compare-horizontal</v-icon>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mb-8">对比</div>

                  <v-btn icon="mdi-check-decagram" variant="flat" color="primary" size="x-large" @click="applyChanges" class="apply-btn">
                      <v-icon>mdi-check-decagram</v-icon>
                      <v-tooltip activator="parent" location="top">应用新结构</v-tooltip>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">应用</div>
              </div>
          </v-col>

          <!-- Proposed Structure Panel -->
          <v-col cols="12" md="5" class="d-flex flex-column fill-height">
            <v-card class="flex-grow-1 d-flex flex-column panel-card" elevation="2">
                <v-card-title class="panel-header d-flex align-center">
                    <v-icon start :color="getProposalPanelColor">{{ getProposalPanelIcon }}</v-icon>
                    <span class="flex-grow-1">{{ getProposalPanelTitle }}</span>
                    <v-btn icon size="x-small" variant="text" @click="() => expandAllFolders(false)" title="展开所有文件夹">
                      <v-icon>mdi-expand-all-outline</v-icon>
                    </v-btn>
                    <v-btn icon size="x-small" variant="text" @click="() => collapseAllFolders(false)" title="折叠所有文件夹">
                      <v-icon>mdi-collapse-all-outline</v-icon>
                    </v-btn>
                    <!-- 调试按钮：手动测试展开状态 -->
                    <v-btn icon size="x-small" variant="text" @click="() => {
                      if (newProposalTree.children && newProposalTree.children.length > 0 && newProposalTree.children[0]) {
                        toggleProposalFolder(newProposalTree.children[0].id);
                      }
                    }" title="调试：切换第一个文件夹">
                      <v-icon>mdi-bug</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="flex-grow-1 pa-0" style="min-height: 0">
                    <div class="scrolling-content">
                        <div v-if="isGenerating" class="d-flex flex-column justify-center align-center fill-height">
                            <v-progress-circular :model-value="progressValue" color="primary" size="80" width="8" class="mb-4">
                                <v-icon size="32">mdi-brain</v-icon>
                            </v-progress-circular>
                            <div class="text-h6 mb-2">AI 正在分析中...</div>
                            <div class="text-body-2 text-medium-emphasis">请稍候...</div>
                        </div>
                        <div v-else-if="newProposalTree.id === 'root-empty'" class="d-flex flex-column justify-center align-center fill-height text-center">
                            <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-plus-circle-outline</v-icon>
                            <div class="text-h6 mb-2">右侧面板为空</div>
                            <div class="text-body-2 text-medium-emphasis">请选择数据源来开始编辑</div>
                        </div>
                        <!-- 右侧面板内容区域 -->
                        <template v-if="newProposalTree.children && newProposalTree.children.length > 0">
                          <!-- 右侧面板调试信息 -->
                          <div class="pa-2">
                            <small class="text-grey">
                              📊 右侧面板数据: {{ newProposalTree.children.length }} 个顶层文件夹，
                              展开状态: {{ proposalExpandedFolders.size }} 个文件夹，
                              面板ID: {{ newProposalTree.id }}
                            </small>
                            <details class="mt-2">
                              <summary class="text-xs text-grey cursor-pointer">🔍 详细数据结构</summary>
                              <pre class="text-xs mt-1">{{ JSON.stringify(newProposalTree.children, null, 2) }}</pre>
                              <div class="text-xs mt-1">展开ID列表: {{ Array.from(proposalExpandedFolders) }}</div>
                            </details>
                          </div>
                          
                          <BookmarkTree
                              :nodes="newProposalTree.children || []"
                            :search-query="searchQuery"
                            is-proposal
                            :is-sortable="true"
                            :is-top-level="true"
                            :hovered-bookmark-id="hoveredBookmarkId"
                            :is-original="false"
                            :expanded-folders="proposalExpandedFolders"
                            @reorder="handleReorder"
                            @bookmark-hover="handleBookmarkHover"
                            @edit-bookmark="handleEditBookmark"
                            @delete-bookmark="handleDeleteBookmark"
                            @copy-success="handleCopySuccess"
                            @copy-failed="handleCopyFailed"
                            @add-new-item="handleAddNewItem"
                            @delete-folder="handleDeleteFolder"
                            @drop="handleDrop"
                        />
                        </template>
                    </div>
                </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Dialogs remain mostly the same, but will inherit new styles -->
    <v-dialog v-model="isApplyConfirmDialogOpen" max-width="500px" persistent @keydown.esc="isApplyConfirmDialogOpen = false">
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon color="warning" start>mdi-alert-circle</v-icon>
                <span>确认应用新结构</span>
            </v-card-title>
            <v-card-text>
                此操作将永久更改您的书签组织方式，且无法撤销。现有的书签栏和"其他书签"目录将被完全覆盖。
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="isApplyConfirmDialogOpen = false" :disabled="isApplyingChanges">取消</v-btn>
                <v-btn color="warning" variant="flat" @click="confirmApplyChanges" :loading="isApplyingChanges">确认应用</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Edit Bookmark Dialog -->
    <v-dialog v-model="isEditBookmarkDialogOpen" max-width="500px" persistent @keydown.enter="saveEditedBookmark" @keydown.esc="isEditBookmarkDialogOpen = false">
        <v-card>
            <v-card-title>
                <v-icon start>mdi-pencil</v-icon>
                编辑书签
            </v-card-title>
            <v-card-text>
                <v-text-field v-model="editTitle" label="书签标题" variant="outlined" density="comfortable" class="mb-3"></v-text-field>
                <v-text-field v-model="editUrl" label="书签链接" variant="outlined" density="comfortable" type="url"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="isEditBookmarkDialogOpen = false" :disabled="isEditingBookmark">取消</v-btn>
                <v-btn color="primary" variant="flat" @click="saveEditedBookmark" :loading="isEditingBookmark">保存</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    
    <!-- Delete Bookmark Dialog -->
    <v-dialog v-model="isDeleteBookmarkDialogOpen" max-width="400px" persistent @keydown.enter="confirmDeleteBookmark" @keydown.esc="isDeleteBookmarkDialogOpen = false">
      <v-card>
        <v-card-title>
          <v-icon start color="error">mdi-alert-circle</v-icon>
          确认删除
        </v-card-title>
        <v-card-text>
          确定要删除书签 "<strong>{{ deletingBookmark?.title }}</strong>" 吗？此操作无法撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="isDeleteBookmarkDialogOpen = false" :disabled="isDeletingBookmark">取消</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDeleteBookmark" :loading="isDeletingBookmark">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Folder Dialog -->
    <v-dialog v-model="isDeleteFolderDialogOpen" max-width="400px" persistent @keydown.enter="confirmDeleteFolder" @keydown.esc="isDeleteFolderDialogOpen = false">
        <v-card>
            <v-card-title>
                <v-icon start color="error">mdi-folder-remove</v-icon>
                确认删除文件夹
            </v-card-title>
            <v-card-text>
                确定要删除文件夹 "<strong>{{ deletingFolder?.title }}</strong>" 及其所有内容吗？此操作无法撤销。
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="isDeleteFolderDialogOpen = false" :disabled="isDeletingFolder">取消</v-btn>
                <v-btn color="error" variant="flat" @click="confirmDeleteFolder" :loading="isDeletingFolder">删除</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Add New Item Dialog -->
    <v-dialog v-model="isAddNewItemDialogOpen" max-width="500px" persistent @keydown.esc="handleCancelAdd" @update:model-value="handleAddDialogClose">
        <v-card>
            <v-card-title>添加新项目</v-card-title>
            <v-card-text>
                <v-tabs v-model="addItemType" grow class="mb-4">
                    <v-tab value="bookmark"><v-icon start>mdi-bookmark</v-icon>书签</v-tab>
                    <v-tab value="folder"><v-icon start>mdi-folder</v-icon>文件夹</v-tab>
                </v-tabs>
                <v-text-field v-model="newItemTitle" label="标题" variant="outlined" density="comfortable" class="mb-3" autofocus></v-text-field>
                <v-text-field v-if="addItemType === 'bookmark'" v-model="newItemUrl" label="链接地址" variant="outlined" density="comfortable" type="url"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="handleCancelAdd" :disabled="isAddingItem">取消</v-btn>
                <v-btn color="primary" variant="flat" @click="confirmAddItem" :loading="isAddingItem">添加</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Duplicate Confirmation Dialog -->
    <v-dialog v-model="isDuplicateDialogOpen" max-width="500px">
        <v-card>
            <v-card-title><v-icon start color="warning">mdi-alert-circle-outline</v-icon>发现重复项目</v-card-title>
            <v-card-text>{{ duplicateInfo?.message }}. 确定要继续添加吗？</v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="isDuplicateDialogOpen = false">取消</v-btn>
                <v-btn color="warning" variant="flat" @click="confirmAddDuplicate">继续添加</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Cancel Add Confirmation Dialog -->
    <v-dialog v-model="isCancelConfirmDialogOpen" max-width="400px" persistent>
        <v-card>
            <v-card-title><v-icon start color="warning">mdi-alert-circle-outline</v-icon>确认取消</v-card-title>
            <v-card-text>您已输入内容，确定要取消添加吗？</v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="isCancelConfirmDialogOpen = false">继续编辑</v-btn>
                <v-btn color="warning" variant="flat" @click="confirmCancelAdd">确认取消</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" timeout="3000" :color="snackbarColor">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false">关闭</v-btn>
      </template>
    </v-snackbar>
    <div class="build-badge">Build {{ DEBUG_BUILD_ID }}</div>
  </v-app>
</template>

<style>
/* Global styles for management page to ensure full height and no overflow */
html, body, #app {
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
  height: calc(100vh - 64px);
}

.panel-card {
  overflow: hidden;
}

.scrolling-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.panel-header {
    font-size: 1rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
}

.apply-btn {
    box-shadow: 0 4px 15px rgba(var(--md-sys-color-primary), 0.4) !important;
}

.build-badge {
    position: fixed;
    bottom: 8px;
    right: 8px;
    background-color: rgba(0,0,0,0.5);
    color: white;
    padding: 2px 6px;
    font-size: 10px;
    border-radius: 4px;
    z-index: 1000;
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
  overflow-y: auto;
  min-height: 0;
}

.overflow-y-auto {
  overflow-y: auto;
}
</style>
