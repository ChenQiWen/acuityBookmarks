<script setup lang="ts">
import { ref, onMounted, nextTick, watch, onUnmounted } from "vue";
import { logger } from "../utils/logger";
import BookmarkTree from "./BookmarkTree.vue";

// --- State ---
const searchQuery = ref("");

const originalTree = ref<chrome.bookmarks.BookmarkTreeNode[]>([]);
const newProposalTree = ref<ProposalNode>({
  id: "root-empty",
  title: "等待数据源",
  children: [],
});
const structuresAreDifferent = ref(false);
const hasDragChanges = ref(false); // 专门跟踪拖拽变更

// 性能优化：数据加载缓存机制
let dataLoaded = false;
let lastDataLoadTime = 0;
const DATA_CACHE_TIME = 5000; // 5秒内不重复加载

// （已移除树比较，应用按钮始终可用）

// （移除比较缓存机制）

// 应用按钮始终可用（移除比较与监听逻辑）

// 确认对话框统计已移除

// 取消左右面板数据变化监听（保留占位变量已移除）

// 获取右侧面板标题
const getProposalPanelTitle = () => {
  // 固定标题为"新的书签目录"
  return "新的书签目录";
};

// 获取右侧面板图标
const getProposalPanelIcon = () => {
  if (newProposalTree.value.id === "root-empty") {
    return "mdi-plus-circle-outline";
  } else if (newProposalTree.value.id === "root-cloned") {
    return "mdi-database";
  } else if (newProposalTree.value.id === "root-quick") {
    return "mdi-flash";
  } else if (newProposalTree.value.id === "root-0") {
    return "mdi-magic-staff";
  }
  return "mdi-magic-staff";
};

// 获取右侧面板颜色
const getProposalPanelColor = () => {
  if (newProposalTree.value.id === "root-empty") {
    return "grey";
  } else if (newProposalTree.value.id === "root-cloned") {
    return "secondary";
  } else if (newProposalTree.value.id === "root-quick") {
    return "info";
  } else if (newProposalTree.value.id === "root-0") {
    return "primary";
  }
  return "primary";
};

// 解析URL参数
const parseUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");

  if (mode === "ai") {
    // 不预设右侧面板状态，等待AI生成完成后自动填充
  } else if (mode === "manual") {
    // 在数据加载完成后会自动克隆（如果右侧为空）
  }
  return mode;
};

// 深克隆左侧为右侧（保持顺序一致，避免过度处理）
 

// 根据进入模式设置右侧数据：AI 模式用 LLM 提案，否则默认克隆本地书签
function setRightPanelFromLocalOrAI(fullTree: any[], storageData: any): void {
  const mode = parseUrlParams();
  if (mode === 'ai' && storageData && storageData.newProposal) {
    const proposal = convertLegacyProposalToTree(storageData.newProposal);
    newProposalTree.value = { ...proposal } as any;
  } else {
    newProposalTree.value = {
      id: 'root-cloned',
      title: '克隆的书签结构',
      children: JSON.parse(JSON.stringify(fullTree))
    } as any;
  }
}

// 显示数据准备完成通知
const showDataReadyNotification = (bookmarkCount: number) => {
  snackbarText.value = `书签数据已准备就绪，共 ${bookmarkCount} 个书签`;
  snackbar.value = true;
  snackbarColor.value = "success";

  // 3秒后自动隐藏
  setTimeout(() => {
    snackbar.value = false;
  }, 3000);
};

// 当本地 originalTree 缺少 children 时，从 Chrome 直接拉取并回填缓存
function recoverOriginalTreeFromChrome(): Promise<any[]> {
  return new Promise((resolve) => {
    try {
      chrome.bookmarks.getTree((tree) => {
        if (!Array.isArray(tree) || tree.length === 0) {
          resolve([]);
          return;
        }
        // 回写到 storage，保持原始 [root] 形态
        chrome.storage.local.set({ originalTree: tree }, () => {
          const rootNode = tree[0];
          const fullTree: any[] = [];
          if (rootNode && Array.isArray(rootNode.children)) {
            rootNode.children.forEach((folder: any) => {
              fullTree.push(folder);
            });
          }
          resolve(fullTree);
        });
      });
    } catch (e) {
      resolve([]);
    }
  });
}

// 从Chrome Storage加载数据（降级方案）
const loadFromChromeStorage = () => {
  chrome.storage.local.get(
    ["originalTree", "newProposal", "isGenerating"],
    (data) => {
      if (data.originalTree) {
        // 修复：获取完整的书签树结构，包括书签栏和其他书签
        const fullTree: any[] = [];

        // 修复：正确处理书签树数据结构
        // data.originalTree 可能是 [root] 格式，也可能是直接的文件夹数组
        if (data.originalTree && data.originalTree.length > 0) {
          // 检查是否是 [root] 格式
          if (
            data.originalTree[0].children &&
            Array.isArray(data.originalTree[0].children)
          ) {
            // [root] 格式：取根节点的子节点
            const rootNode = data.originalTree[0];
            rootNode.children.forEach((folder: any) => {
              fullTree.push({
                id: folder.id,
                title: folder.title,
                children: folder.children || [],
              });
            });
          } else {
            // 直接是文件夹数组格式
            data.originalTree.forEach((folder: any) => {
              fullTree.push({
                id: folder.id,
                title: folder.title,
                children: folder.children || [],
              });
            });
          }
        }
        originalTree.value = fullTree;
        rebuildOriginalIndexes(fullTree);

        // 右侧：AI 模式用 LLM 提案，否则默认克隆本地书签
        setRightPanelFromLocalOrAI(fullTree, { newProposal: data.newProposal });
        // 默认展开顶层文件夹（若有子节点）
        try {
          expandedFolders.value.clear();
          fullTree.forEach((f: any) => {
            if (Array.isArray(f.children) && f.children.length > 0) {
              expandedFolders.value.add(f.id);
            }
          });
          expandedFolders.value = new Set(expandedFolders.value);
        } catch (e) {}

        updateComparisonState();

        if (originalTree.value && newProposalTree.value.children) {
          buildBookmarkMapping(
            originalTree.value,
            newProposalTree.value.children
          );
        }

        isGenerating.value = data.isGenerating || false;
      }

      // 设置加载完成状态
      setTimeout(() => {
        isPageLoading.value = false;
        loadingMessage.value = "";
      }, 100);
    }
  );
};

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
// const testDataSync = () => {

// 手动修改右侧面板数据进行测试
if (
  newProposalTree.value.children &&
  newProposalTree.value.children.length > 0
) {
  // 找到第一个没有被测试修改过的项目
  const testIndex = newProposalTree.value.children.findIndex(
    (item) => !item.title.includes("(测试修改)")
  );

  if (testIndex >= 0) {
    const originalItem = newProposalTree.value.children[testIndex];

    // 创建一个新的测试项目
    const testItem = {
      ...originalItem,
      title: originalItem.title + " (测试修改)",
      id: `test-${Date.now()}`,
    };

    // 替换项目
    newProposalTree.value.children[testIndex] = testItem;

    // 强制更新以触发响应式
    newProposalTree.value = { ...newProposalTree.value };
  } else {
  }
} else {
}
// };

const isGenerating = ref(false);
const progressValue = ref(0);
const progressTotal = ref(0);

// 页面加载状态
const isPageLoading = ref(true);
const loadingMessage = ref("正在加载书签数据...");

// 缓存状态
const cacheStatus = ref({
  isFromCache: false,
  lastUpdate: null as number | null,
  dataAge: null as number | null,
});
const isApplyConfirmDialogOpen = ref(false);
const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref("info");

// Debug build identifier (update this string after edits to bust caches visually)
const DEBUG_BUILD_ID = "BID-b7f2d9";

// --- Bookmark Edit/Delete Dialogs ---
const isEditBookmarkDialogOpen = ref(false);
const isDeleteBookmarkDialogOpen = ref(false);
const isDeleteFolderDialogOpen = ref(false);
const editingBookmark = ref<any>(null);
const deletingBookmark = ref<any>(null);
const deletingFolder = ref<any>(null);
const editTitle = ref("");
const editUrl = ref("");

// --- Add New Item Dialog ---
const isAddNewItemDialogOpen = ref(false);
const addItemType = ref<"folder" | "bookmark">("bookmark");
const parentFolder = ref<any>(null);
const newItemTitle = ref("");
const newItemUrl = ref("");
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

// 原始树索引：id -> 节点、id -> 祖先文件夹链
const originalIdToNode = ref<Map<string, any>>(new Map());
const originalIdToAncestors = ref<Map<string, string[]>>(new Map());
const originalIdToParentId = ref<Map<string, string>>(new Map());

function rebuildOriginalIndexes(nodes: any[]): void {
  originalIdToNode.value.clear();
  originalIdToAncestors.value.clear();
  originalIdToParentId.value.clear();

  const traverse = (node: any, ancestors: string[]) => {
    if (!node) return;
    if (node.id) {
      originalIdToNode.value.set(node.id, node);
    }
    const nextAncestors = node.id ? [...ancestors, node.id] : ancestors;

    if (Array.isArray(node.children) && node.children.length > 0) {
      for (const child of node.children) {
        if (child && child.id && node && node.id) {
          originalIdToParentId.value.set(child.id, node.id);
        }
        traverse(child, nextAncestors);
      }
    } else if (node.url && node.id) {
      // 书签：记录其祖先文件夹链（不包含自身）
      originalIdToAncestors.value.set(node.id, ancestors);
    }
  };

  for (const top of nodes || []) {
    traverse(top, []);
  }
}

// --- Fingerprint & Refresh ---
// 轻量指纹：稳定遍历顺序下，记录节点类型/id/children count/url长 等，生成短哈希
const hashString = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
};

const buildFingerprintFromFullTree = (nodes: any[]): string => {
  const parts: string[] = [];
  const walk = (arr: any[]) => {
    for (const n of arr) {
      if (n && n.url) {
        parts.push(`B:${n.id}:${(n.title || '').length}:${(n.url || '').length}`);
      } else {
        const count = Array.isArray(n?.children) ? n.children.length : 0;
        parts.push(`F:${n?.id}:${(n?.title || '').length}:${count}`);
        if (count > 0) walk(n.children);
      }
    }
  };
  walk(nodes || []);
  return hashString(parts.join('|'));
};

// 从 [root] 结构提取 fullTree（两个顶级容器）
const extractFullTreeFromRoot = (rootTree: any[]): any[] => {
  const full: any[] = [];
  if (Array.isArray(rootTree) && rootTree.length > 0) {
    const rootNode = rootTree[0];
    if (rootNode && Array.isArray(rootNode.children)) {
      rootNode.children.forEach((folder: any) => full.push(folder));
    }
  }
  return full;
};

// 校验 storage 与 live 是否一致，不一致则以 live 覆盖 storage 与界面
const refreshFromChromeIfOutdated = () => {
  try {
    chrome.bookmarks.getTree((tree) => {
      try { logger.info('Management', '📚 chrome.bookmarks.getTree 返回原始数据 [root]:', tree); } catch {}
      const liveFull = extractFullTreeFromRoot(tree);
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
        setRightPanelFromLocalOrAI(liveFull, {});
        // 保持顶层展开
        try {
          expandedFolders.value.clear();
          liveFull.forEach((f: any) => {
            if (Array.isArray(f.children) && f.children.length > 0) {
              expandedFolders.value.add(f.id);
            }
          });
          expandedFolders.value = new Set(expandedFolders.value);
        } catch {}
      }
    });
  } catch {}
};

// Generate unique ID for each bookmark instance
const generateBookmarkId = (node: any): string => {
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
const analyzeBookmarkChanges = (originalData: any[], proposedData: any[]) => {
  // 创建基于ID的映射（Chrome API以ID为准）
  const originalItems = new Map<string, any>();
  const proposedItems = new Map<string, any>();

  // 收集所有项目信息（优化版本）
  const collectItems = (nodes: any[], map: Map<string, any>, parentPath: string = '', parentId: string = '') => {
    for (const node of nodes || []) {
      const fullPath = parentPath ? `${parentPath}/${node.title}` : node.title;

      // 使用Chrome书签ID作为唯一标识
      const uniqueId = node.id || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 检测特殊文件夹（根据Chrome API文档）
      const isSpecialFolder = ['书签栏', '其他书签', '移动设备书签', '受管理书签'].includes(node.title) ||
                             ['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks', 'Managed bookmarks'].includes(node.title);

      map.set(uniqueId, {
        id: node.id,
        title: node.title,
        url: node.url,
        path: fullPath,
        parentPath: parentPath,
        parentId: parentId,
        type: node.url ? 'bookmark' : 'folder',
        children: node.children || [],
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
      created: [] as any[],
      deleted: [] as any[],
      renamed: [] as any[],
      moved: [] as any[],
      urlChanged: [] as any[]
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
const calculateApplicationStrategy = (analysis: any) => {
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
  let strategy = 'minor-update';
  let reason = '';
  let estimatedTime = 0;
  let riskLevel = 'low';
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
const showAnalysisReport = (analysis: any, strategy: any) => {
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
const buildBookmarkMapping = (originalTree: any[], proposedTree: any[]) => {
  bookmarkMapping.value.clear();

  // 性能优化：批量处理书签，避免频繁的Map操作
  const mappingUpdates: Map<string, { original: any; proposed: any }> =
    new Map();

  // Helper function to assign unique IDs and build mapping
  const processBookmarks = (nodes: any[], isOriginal: boolean = true) => {
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
const findOriginalByUrlTitle = (url: string, title?: string): any | null => {
  const stack: any[] = Array.isArray(originalTree.value)
    ? [...originalTree.value]
    : [];
  let fallbackByUrl: any | null = null;
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

// Handle folder toggle (user manual operation)
const handleFolderToggle = (_data: { nodeId: string; expanded: boolean }) => {
  // For user manual operations, we don't interfere with other folders
  // Just let the folder maintain its own state
};

// 防抖hover处理，避免频繁触发
let hoverTimeout: number | null = null;
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
const handleBookmarkHover = (payload: any) => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
  hoverTimeout = window.setTimeout(async () => {
    if (!payload) {
      expandedFolders.value.clear();
      return;
    }

    const { id: bookmarkId, node: hoveredNode } = payload as { id: string | null, node: any };
    if (hoveredBookmarkId.value === bookmarkId) return;
    hoveredBookmarkId.value = bookmarkId;

    let mapping = bookmarkMapping.value.get(bookmarkId || '');
    let targetOriginal: any | null = null;

    // 优先：若 hover 的就是左侧原始项
    if (hoveredNode && hoveredNode.id && originalIdToNode.value.has(hoveredNode.id)) {
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
    expandedFolders.value.clear();
    let ancestors = (targetOriginal.id && originalIdToAncestors.value.get(targetOriginal.id)) || null;
    if (!ancestors || ancestors.length === 0) {
      // 动态用 parentId 向上回溯
      const chain: string[] = [];
      let curId: string | undefined = targetOriginal.id;
      while (curId && originalIdToParentId.value.has(curId)) {
        const parentId = originalIdToParentId.value.get(curId)!;
        chain.unshift(parentId);
        curId = parentId;
      }
      ancestors = chain;
    }
    for (const folderId of ancestors || []) {
      expandedFolders.value.add(folderId);
    }
    expandedFolders.value = new Set(expandedFolders.value);

    await nextTick();
    // 优先按原生 id 命中；失败再按 uniqueId 兜底
    let el = null as Element | null;
    if (targetOriginal.id) {
      el = await waitForElementInLeft(`[data-native-id="${CSS.escape(String(targetOriginal.id))}"]`, 1500);
    }
    if (!el) {
      const targetId = targetOriginal.uniqueId || generateBookmarkId(targetOriginal);
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
  lastModified?: number; // 添加时间戳字段
}

// --- Comparison Logic ---
function getComparable(
  nodes: ProposalNode[],
  depth: number = 0,
  visited: Set<string> = new Set()
): any[] {
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
          url: node.url || null,
        };
      }

      const newVisited = new Set(visited);
      newVisited.add(node.id);

      const newNode: any = {
        title: node.title,
        id: node.id,
        url: node.url || null,
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
onMounted(() => {
  // 开发辅助：将关键 ref 暴露到全局，便于控制台调试
  try {
    if (typeof window !== "undefined") {
      const g: any = (window as any).__AB__ || ((window as any).__AB__ = {});
      g.originalTree = originalTree;
      g.newProposalTree = newProposalTree;
      // 控制台测试API：展开指定文件夹ID，可选是否滚动到可见
      g.expandFolderById = async (folderId: string, doScroll: boolean = true) => {
        if (!folderId) return false;
        // 写入展开集合
        expandedFolders.value.add(folderId);
        expandedFolders.value = new Set(expandedFolders.value);
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
  if (dataLoaded && now - lastDataLoadTime < DATA_CACHE_TIME) {
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
                  const fullTree: any[] = [];

                  // data.originalTree 是 [root] 格式，直接取第一个根节点
                  const rootNode = data.originalTree[0];
                  if (
                    rootNode &&
                    rootNode.children &&
                    rootNode.children.length > 0
                  ) {
                    // 遍历所有顶层文件夹（书签栏、其他书签等）
                    rootNode.children.forEach((folder: any) => {
                      fullTree.push({
                        id: folder.id,
                        title: folder.title,
                        children: folder.children || [],
                      });
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
              const treeData = results[0] as any[];
              const storageData = results[1] as any;
              // 如果顶层两个文件夹都无 children，触发兜底恢复
              const isTopEmpty =
                Array.isArray(treeData) &&
                treeData.length > 0 &&
                treeData.every(
                  (f: any) => !f.children || (Array.isArray(f.children) && f.children.length === 0)
                );

              if (isTopEmpty) {
                recoverOriginalTreeFromChrome().then((recovered) => {
                  originalTree.value = recovered;
                  rebuildOriginalIndexes(recovered);
                  setRightPanelFromLocalOrAI(recovered, storageData);
                  // 强制展开顶层
                  try {
                    recovered.forEach((f: any) => (f.expanded = true));
                    expandedFolders.value.clear();
                    recovered.forEach((f: any) => {
                      if (Array.isArray(f.children) && f.children.length > 0) {
                        expandedFolders.value.add(f.id);
                      }
                    });
                    expandedFolders.value = new Set(expandedFolders.value);
                  } catch {}
                });
              } else {
                // 快速设置数据，减少UI阻塞
                originalTree.value = treeData;
                rebuildOriginalIndexes(treeData);
                // 右侧：AI 模式用 LLM 提案，否则默认克隆本地书签
                setRightPanelFromLocalOrAI(treeData, storageData);

                // 默认展开顶层文件夹（若有子节点）
                try {
                  expandedFolders.value.clear();
                  treeData.forEach((f: any) => {
                    f.expanded = true;
                    if (Array.isArray(f.children) && f.children.length > 0) {
                      expandedFolders.value.add(f.id);
                    }
                  });
                  expandedFolders.value = new Set(expandedFolders.value);
                } catch (e) {}
              }

              // 批量更新UI状态
              updateComparisonState();
              isGenerating.value = storageData.isGenerating || false;

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
            const fullTree: any[] = [];

            // 修复：正确处理书签树数据结构
            if (data.originalTree && data.originalTree.length > 0) {
              // 检查是否是 [root] 格式
              if (
                data.originalTree[0].children &&
                Array.isArray(data.originalTree[0].children)
              ) {
                // [root] 格式：取根节点的子节点
                const rootNode = data.originalTree[0];
                rootNode.children.forEach((folder: any) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    children: folder.children || [],
                  });
                });
              } else {
                // 直接是文件夹数组格式
                data.originalTree.forEach((folder: any) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    children: folder.children || [],
                  });
                });
              }
            }
            const isTopEmpty =
              Array.isArray(fullTree) &&
              fullTree.length > 0 &&
              fullTree.every(
                (f: any) => !f.children || (Array.isArray(f.children) && f.children.length === 0)
              );

            if (isTopEmpty) {
              recoverOriginalTreeFromChrome().then((recovered) => {
                originalTree.value = recovered;
                rebuildOriginalIndexes(recovered);
                setRightPanelFromLocalOrAI(recovered, { newProposal: data.newProposal });
                try {
                  expandedFolders.value.clear();
                  recovered.forEach((f: any) => {
                    f.expanded = true;
                    if (Array.isArray(f.children) && f.children.length > 0) {
                      expandedFolders.value.add(f.id);
                    }
                  });
                  expandedFolders.value = new Set(expandedFolders.value);
                } catch {}
              });
            } else {
              originalTree.value = fullTree;
              rebuildOriginalIndexes(fullTree);
              setRightPanelFromLocalOrAI(fullTree, { newProposal: data.newProposal });
              try {
                expandedFolders.value.clear();
                fullTree.forEach((f: any) => {
                  f.expanded = true;
                  if (Array.isArray(f.children) && f.children.length > 0) {
                    expandedFolders.value.add(f.id);
                  }
                });
                expandedFolders.value = new Set(expandedFolders.value);
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
              console.log("✅ [自动克隆] 条件满足，立即触发自动克隆逻辑");
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
            const fullTree: any[] = [];

            // 修复：正确处理书签树数据结构
            if (data.originalTree && data.originalTree.length > 0) {
              // 检查是否是 [root] 格式
              if (
                data.originalTree[0].children &&
                Array.isArray(data.originalTree[0].children)
              ) {
                // [root] 格式：取根节点的子节点
                const rootNode = data.originalTree[0];
                rootNode.children.forEach((folder: any) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    children: folder.children || [],
                  });
                });
              } else {
                // 直接是文件夹数组格式
                data.originalTree.forEach((folder: any) => {
                  fullTree.push({
                    id: folder.id,
                    title: folder.title,
                    children: folder.children || [],
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
        console.log("✅ Storage监听器：应用新的proposal数据");
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
  console.log("🔄 [前端应用] 开始直接应用书签结构变更");
  console.log(
    "🔄 [前端应用] 要应用的proposal:",
    JSON.stringify(newProposalTree.value, null, 2)
  );

  try {
    // 1. 创建备份文件夹
    console.log("🔄 [前端应用] 步骤1: 创建备份文件夹");
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
      now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const backupFolder = await new Promise<chrome.bookmarks.BookmarkTreeNode>(
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
              resolve(result);
            }
          }
        );
      }
    );
    console.log("🔄 [前端应用] 备份文件夹创建成功:", backupFolder);

    // 2. 移动现有书签到备份文件夹
    console.log("🔄 [前端应用] 步骤2: 移动现有书签到备份文件夹");
    const bookmarksBar = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
      (resolve, reject) => {
        chrome.bookmarks.getChildren("1", (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result || []);
          }
        });
      }
    );

    const otherBookmarks = await new Promise<
      chrome.bookmarks.BookmarkTreeNode[]
    >((resolve, reject) => {
      chrome.bookmarks.getChildren("2", (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result || []);
        }
      });
    });

    console.log("🔄 [前端应用] 书签栏现有内容:", bookmarksBar);
    console.log("🔄 [前端应用] 其他书签现有内容:", otherBookmarks);

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
    console.log("🔄 [前端应用] 步骤3: 创建新的书签结构");
    const proposalRoot = newProposalTree.value.children || [];
    const proposalBookmarksBar = proposalRoot.find((n) => n.title === "书签栏");
    const proposalOtherBookmarks = proposalRoot.find(
      (n) => n.title === "其他书签"
    );

    console.log("🔄 [前端应用] 提案中的书签栏:", proposalBookmarksBar);
    console.log("🔄 [前端应用] 提案中的其他书签:", proposalOtherBookmarks);

    const createNodes = async (
      nodes: any[],
      parentId: string
    ): Promise<void> => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          // 有内容的文件夹
          const newFolder =
            await new Promise<chrome.bookmarks.BookmarkTreeNode>(
              (resolve, reject) => {
                chrome.bookmarks.create(
                  { parentId, title: node.title },
                  (result) => {
                    if (chrome.runtime.lastError) {
                      reject(chrome.runtime.lastError);
                    } else {
                      resolve(result);
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
      console.log("🔄 [前端应用] 创建书签栏内容...");
      await createNodes(proposalBookmarksBar.children, "1");
    }
    if (proposalOtherBookmarks && proposalOtherBookmarks.children) {
      console.log("🔄 [前端应用] 创建其他书签内容...");
      await createNodes(proposalOtherBookmarks.children, "2");
    }

    console.log("🔄 [前端应用] 书签结构创建完成");

    // 4. 直接刷新左侧面板数据
    console.log("🔄 [前端应用] 步骤4: 刷新左侧面板数据");
    const updatedTree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
      (resolve, reject) => {
        chrome.bookmarks.getTree((tree) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tree);
          }
        });
      }
    );

    console.log("🔄 [前端应用] 获取到更新后的书签树:", updatedTree);
    const fullTree: any[] = [];

    if (updatedTree && updatedTree.length > 0) {
      if (updatedTree[0].children && Array.isArray(updatedTree[0].children)) {
        const rootNode = updatedTree[0];
        console.log("🔄 [前端应用] rootNode.children:", rootNode.children);

        rootNode.children?.forEach((folder: any) => {
          console.log(
            "🔄 [前端应用] 处理文件夹:",
            folder.title,
            "子项数量:",
            folder.children?.length
          );

          // 简化处理：直接使用Chrome API返回的数据，避免复杂递归
          fullTree.push({
            id: folder.id,
            title: folder.title,
            url: folder.url,
            children: folder.children, // 直接使用原始children，Chrome API已经处理好了结构
          });
        });
      } else {
        console.log("🔄 [前端应用] 警告: updatedTree结构异常", updatedTree);
      }
    } else {
      console.log("🔄 [前端应用] 警告: updatedTree为空", updatedTree);
    }

    console.log("🔄 [前端应用] 处理后的fullTree:", fullTree);
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
    console.log("🔄 [前端应用] DOM更新完成");

    // 清除拖拽变更标记
    hasDragChanges.value = false;

    // 重新计算比较状态，确保按钮状态正确
    try {
      updateComparisonState();
      console.log("🔄 [前端应用] 更新完成");
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
  } catch (error: any) {
    console.error("🔄 [前端应用] 应用更改失败:", error);
    snackbarText.value = `应用更改失败: ${error.message || "未知错误"}`;
    snackbar.value = true;
  } finally {
    isApplyingChanges.value = false;
  }
};

const handleReorder = (): void => {
  console.log("🔄 [拖拽重排] 检测到拖拽操作，开始处理...");

  // 立即设置拖拽变更标记
  hasDragChanges.value = true;
  console.log("🔄 [拖拽重排] 设置拖拽变更标记，应用按钮应该立即激活");

  // 强制触发响应式更新，让Vue检测到数组内部的变化
  const currentChildren = newProposalTree.value.children
    ? [...newProposalTree.value.children]
    : [];

  // 创建一个新的对象来确保Vue检测到变化
  // 添加时间戳确保对象确实发生了变化
  newProposalTree.value = {
    ...newProposalTree.value,
    children: currentChildren,
    lastModified: Date.now(), // 添加时间戳标记变更
  };

  console.log("🔄 [拖拽重排] 数据结构已更新");

  // 关键修复：拖拽后按钮仍保持可用
  nextTick(() => {
    console.log("✅ [拖拽重排] 拖拽完成，应用按钮保持可用");
    structuresAreDifferent.value = true; // 仅用于显示提示
  });
};

// --- Bookmark Operations ---
const handleEditBookmark = (node: any) => {
  editingBookmark.value = node;
  editTitle.value = node.title;
  editUrl.value = node.url || "";
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

const handleCopySuccess = () => {
  snackbarText.value = "链接已复制到剪贴板";
  snackbar.value = true;
  snackbarColor.value = "success";
};

const handleCopyFailed = () => {
  snackbarText.value = "复制链接失败，请重试";
  snackbar.value = true;
  snackbarColor.value = "error";
};

// --- Add New Item Functions ---
const handleAddNewItem = (parentNode: any) => {
  console.log('Management.vue: handleAddNewItem CALLED. parentNode:', parentNode?.title);
  parentFolder.value = parentNode;
  addItemType.value = "bookmark";
  newItemTitle.value = "";
  newItemUrl.value = "";
  isAddNewItemDialogOpen.value = true;
  console.log('Management.vue: isAddNewItemDialogOpen state is now:', isAddNewItemDialogOpen.value);
};

// 监听tab切换，重置表单验证状态
watch(addItemType, () => {
  // 重置表单验证状态
  newItemTitle.value = "";
  newItemUrl.value = "";
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
      parentFolder.value.id
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
  tree: any[],
  url: string,
  excludeParentId: string
): any[] => {
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
  const { valid } = (await addForm.value?.validate()) || { valid: false };

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
  addForm.value?.resetValidation();
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
      <v-spacer></v-spacer>

      <!-- 复杂度分析测试按钮 -->
      <v-btn
        variant="flat"
        color="success"
        size="small"
        class="me-2"
        @click="testComplexityAnalysis"
      >
        <v-icon start size="16">mdi-chart-line</v-icon>
        测试复杂度
      </v-btn>

      <v-chip size="x-small" color="grey" variant="outlined" class="ml-2"
        >Build {{ DEBUG_BUILD_ID }}</v-chip
      >
    </v-app-bar>

    <v-main class="main-content">

      <!-- Main Comparison Section -->
      <v-container fluid class="comparison-section page-container">
        <v-row class="comparison-row">
          <!-- Current Structure Panel -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar color="info" size="24" class="me-2">
                    <v-icon color="white" size="16"
                      >mdi-folder-open-outline</v-icon
                    >
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">
                      当前书签目录
                    </div>
                  </div>
                </div>
              </v-card-title>

              <div class="comparison-content" ref="leftPanelRef">
                <!-- 调试信息 -->
                <div
                  style="
                    background: #e8f5e8;
                    padding: 8px;
                    margin: 8px;
                    font-size: 12px;
                  "
                >
                  <strong>🐛 左侧面板渲染调试:</strong><br />
                  originalTree数量: {{ originalTree.length }}<br />
                  originalTree标题:
                  {{ originalTree.map((c) => c.title).join(", ") }}
                </div>
                <BookmarkTree
                  :nodes="originalTree"
                  :search-query="searchQuery"
                  :is-sortable="false"
                  :is-top-level="true"
                  :hovered-bookmark-id="hoveredBookmarkId"
                  :is-original="true"
                  :expanded-folders="expandedFolders"
                  @bookmark-hover="handleBookmarkHover"
                  @copy-success="handleCopySuccess"
                  @copy-failed="handleCopyFailed"
                  @add-new-item="handleAddNewItem"
                  @delete-folder="handleDeleteFolder"
                  @folder-toggle="handleFolderToggle"
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
                    icon="mdi-arrow-right-bold-box"
                    variant="tonal"
                    color="primary"
                    size="large"
                    class="control-btn"
                  ></v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">
                    对2比
                  </div>
                </div>

                <div class="control-section">
                  <v-btn
                    variant="flat"
                    color="success"
                    size="large"
                    class="control-btn apply-btn"
                    @click="applyChanges"
                  >
                    <v-icon>mdi-arrow-left-bold-box</v-icon>
                    <v-tooltip location="top" activator="parent">
                      <span>应用新结构</span>
                    </v-tooltip>
                  </v-btn>
                  <div class="text-caption text-medium-emphasis mt-2">应用</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Proposed Structure Panel -->
          <v-col cols="12" md="5" class="comparison-col">
            <v-card class="comparison-card" elevation="2">
              <v-card-title class="comparison-header-compact">
                <div class="d-flex align-center">
                  <v-avatar
                    :color="getProposalPanelColor()"
                    size="24"
                    class="me-2"
                  >
                    <v-icon color="white" size="16">{{
                      getProposalPanelIcon()
                    }}</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-1 font-weight-medium">
                      {{ getProposalPanelTitle() }}
                    </div>
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

                <div
                  v-else-if="newProposalTree.id === 'root-empty'"
                  class="empty-state"
                >
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey" class="mb-4"
                      >mdi-plus-circle-outline</v-icon
                    >
                    <div class="text-h6 mb-2">右侧面板为空</div>
                    <div class="text-body-2 text-medium-emphasis mb-4">
                      请选择数据源来开始编辑
                    </div>
                  </div>
                </div>

                <div v-else>
                  <!-- 调试信息 -->
                  <div
                    style="
                      background: #f0f0f0;
                      padding: 8px;
                      margin: 8px;
                      font-size: 12px;
                    "
                  >
                    <strong>🐛 右侧面板渲染调试:</strong><br />
                    newProposalTree.id: {{ newProposalTree.id }}<br />
                    newProposalTree.title: {{ newProposalTree.title }}<br />
                    children数量: {{ newProposalTree.children?.length || 0
                    }}<br />
                    children标题:
                    {{
                      newProposalTree.children?.map((c) => c.title).join(", ")
                    }}
                  </div>
                  <BookmarkTree
                    :nodes="newProposalTree.children || []"
                    :search-query="searchQuery"
                    is-proposal
                    :is-sortable="true"
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
              <div class="text-body-2 text-medium-emphasis">
                此操作将永久更改您的书签组织方式
              </div>
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
              <strong>重要提醒：</strong
              >此操作将完全覆盖您现有的书签栏和"其他书签"目录
            </div>
          </v-alert>

          <div class="warning-list">
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3"
                >mdi-close-circle</v-icon
              >
              <span class="text-body-2">原有的文件夹结构将被删除</span>
            </div>
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3"
                >mdi-close-circle</v-icon
              >
              <span class="text-body-2">书签将被重新组织到新结构中</span>
            </div>
            <div class="d-flex align-center mb-3">
              <v-icon color="error" size="20" class="me-3"
                >mdi-close-circle</v-icon
              >
              <span class="text-body-2">此操作不可撤销</span>
            </div>
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
    <v-dialog v-model="isEditBookmarkDialogOpen" max-width="500px" persistent @keydown.enter="saveEditedBookmark" @keydown.esc="isEditBookmarkDialogOpen = false">
      <v-card class="edit-dialog">
        <v-card-title class="edit-header">
          <v-icon start size="24" color="primary">mdi-pencil</v-icon>
          编辑书签
        </v-card-title>
        <v-card-text class="edit-content">
          <v-form>
            <v-text-field
              v-model="editTitle"
              label="书签标题"
              variant="outlined"
              density="comfortable"
              class="mb-3"
              @keydown.enter="saveEditedBookmark"
            ></v-text-field>
            <v-text-field
              v-model="editUrl"
              label="书签链接"
              variant="outlined"
              density="comfortable"
              type="url"
              @keydown.enter="saveEditedBookmark"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions class="edit-actions">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="isEditBookmarkDialogOpen = false"
            :disabled="isEditingBookmark"
            >取消</v-btn
          >
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
    <v-dialog v-model="isDeleteBookmarkDialogOpen" max-width="400px" persistent @keydown.enter="confirmDeleteBookmark" @keydown.esc="isDeleteBookmarkDialogOpen = false">
      <v-card class="delete-dialog">
        <v-card-title class="delete-header">
          <v-icon start size="24" color="error">mdi-alert-circle</v-icon>
          确认删除
        </v-card-title>
        <v-card-text class="delete-content">
          <div class="text-body-1 mb-2">
            确定要删除书签 "<strong>{{ deletingBookmark?.title }}</strong
            >" 吗？
          </div>
          <div class="text-body-2 text-medium-emphasis">此操作无法撤销。</div>
        </v-card-text>
        <v-card-actions class="delete-actions">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="isDeleteBookmarkDialogOpen = false"
            :disabled="isDeletingBookmark"
            @keydown.esc="isDeleteBookmarkDialogOpen = false"
            >取消</v-btn
          >
          <v-btn
            color="error"
            variant="flat"
            @click="confirmDeleteBookmark"
            :loading="isDeletingBookmark"
            :disabled="isDeletingBookmark"
            @keydown.enter="confirmDeleteBookmark"
          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Folder Dialog -->
    <v-dialog v-model="isDeleteFolderDialogOpen" max-width="400px" persistent @keydown.enter="confirmDeleteFolder" @keydown.esc="isDeleteFolderDialogOpen = false">
      <v-card class="delete-dialog">
        <v-card-title class="delete-header">
          <v-icon start size="24" color="error">mdi-folder-remove</v-icon>
          确认删除文件夹
        </v-card-title>
        <v-card-text class="delete-content">
          <div class="text-body-1 mb-2">
            确定要删除文件夹 "<strong>{{ deletingFolder?.title }}</strong
            >" 吗？
          </div>
          <div class="text-body-2 text-medium-emphasis">
            此操作将删除文件夹及其包含的所有书签，此操作无法撤销。
          </div>
        </v-card-text>
        <v-card-actions class="delete-actions">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="isDeleteFolderDialogOpen = false"
            :disabled="isDeletingFolder"
            @keydown.esc="isDeleteFolderDialogOpen = false"
            >取消</v-btn
          >
          <v-btn
            color="error"
            variant="flat"
            @click="confirmDeleteFolder"
            :loading="isDeletingFolder"
            :disabled="isDeletingFolder"
            @keydown.enter="confirmDeleteFolder"
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
      @keydown.enter="confirmAddItem"
      @keydown.esc="handleCancelAdd"
    >
      <v-card class="add-dialog">
        <v-card-text class="add-content" style="padding: 24px">
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
              @keydown.enter="confirmAddItem"
            ></v-text-field>

            <v-text-field
              v-if="addItemType === 'bookmark'"
              v-model="newItemUrl"
              label="链接地址"
              variant="outlined"
              density="comfortable"
              type="url"
              :rules="[(v: string) => !!v?.trim() || '链接地址不能为空']"
              @keydown.enter="confirmAddItem"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions class="add-actions">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="handleCancelAdd"
            :disabled="isAddingItem"
            >取消</v-btn
          >
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
          <v-icon start size="24" color="warning"
            >mdi-alert-circle-outline</v-icon
          >
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
            <div class="text-body-2 text-medium-emphasis mb-2">
              重复的URL已在以下位置存在：
            </div>
            <v-list dense class="duplicate-list">
              <v-list-item
                v-for="duplicate in duplicateInfo?.duplicates"
                :key="duplicate.id"
              >
                <template v-slot:prepend>
                  <v-icon size="16" color="warning"
                    >mdi-bookmark-outline</v-icon
                  >
                </template>
                <v-list-item-title>{{ duplicate.title }}</v-list-item-title>
                <v-list-item-subtitle>{{
                  duplicate.path
                }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </div>

          <div class="text-body-2 text-medium-emphasis">确定要继续添加吗？</div>
        </v-card-text>
        <v-card-actions class="duplicate-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isDuplicateDialogOpen = false"
            >取消</v-btn
          >
          <v-btn color="warning" variant="flat" @click="confirmAddDuplicate"
            >继续添加</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cancel Add Confirmation Dialog -->
    <v-dialog v-model="isCancelConfirmDialogOpen" max-width="400px" persistent>
      <v-card class="cancel-confirm-dialog">
        <v-card-title class="cancel-confirm-header">
          <v-icon start size="24" color="warning"
            >mdi-alert-circle-outline</v-icon
          >
          确认取消
        </v-card-title>
        <v-card-text class="cancel-confirm-content">
          <div class="text-body-1 mb-2">您已输入内容，确定要取消添加吗？</div>
          <div class="text-body-2 text-medium-emphasis">
            取消后已输入的内容将不会被保存。
          </div>
        </v-card-text>
        <v-card-actions class="cancel-confirm-actions">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isCancelConfirmDialogOpen = false"
            >继续编辑</v-btn
          >
          <v-btn color="warning" variant="flat" @click="confirmCancelAdd"
            >确认取消</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" timeout="3000" color="success">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false"
          >关闭</v-btn
        >
      </template>
    </v-snackbar>
    <div class="build-badge">Build {{ DEBUG_BUILD_ID }}</div>
  </v-app>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  /* Prevent scrollbars on the root elements */
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
  background-image: url("/logo.png");
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
  height: calc(100vh - 64px);
  /* 固定高度为一屏减去顶部导航栏 */
  background-color: #fafafa;
  overflow: hidden;
  /* 防止主容器出现滚动条 */
}

/* Page Container - Add margins to all sections */
/* Page Container - 统计区域 */
.stats-section {
  flex-shrink: 0;
  /* 防止统计区域被压缩 */
  padding: 16px 24px 0 24px;
  /* 上16px，左右24px，下0 */
}

.page-container {
  padding-left: 0 !important;
}

/* Statistics Section */
.stats-section {
  padding: 12px 0;
  /* 减少内边距 */
  background-color: #ffffff;
  margin-bottom: 4px;
  /* 减少间距 */
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
  /* 让比较区域占据剩余空间 */
  height: 0;
  /* 配合flex: 1 实现真正的剩余空间占据 */
  padding: 24px;
  /* 四个方向各24px间距 */
  overflow: hidden;
  /* 防止整个区域滚动 */
  background-color: #fafafa;
}

.comparison-row {
  height: 100%;
  /* 占满父容器高度 */
  margin: 0;
  /* 移除默认margin */
}

.comparison-col {
  padding: 0 12px !important;
  /* 左右间距，上下间距由父容器提供 */
  height: 100%;
  /* 占满父容器高度 */
  display: flex;
  /* 使子元素能够占满高度 */
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
  /* PC浏览器轻微上移效果 */
}

.comparison-header-compact {
  background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 16px !important;
  /* Reduce padding for compact design */
  min-height: 56px;
  /* Reduce minimum height */
}

.comparison-content {
  flex: 1;
  /* 占据剩余空间 */
  overflow-y: auto;
  /* 垂直滚动 */
  overflow-x: hidden;
  /* 隐藏水平滚动 */
  padding: 16px;
  min-height: 0;
  /* 重要：允许flex子项缩小到内容以下 */
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

/* Grid布局的正确方式 - 移除无效的margin设置 */

/* Grid布局间距调整 */
:deep(.v-list-item) {
  gap: 4px !important;
  column-gap: 4px !important;
  grid-column-gap: 4px !important;
}

/* 关键修复：控制prepend容器的宽度 */
:deep(.v-list-item__prepend),
:deep(.v-list-item--prepend) {
  width: auto !important;
  min-width: auto !important;
  flex-shrink: 0 !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

/* 直接控制icon和avatar的大小和间距 */
:deep(.v-list-item__prepend .v-icon),
:deep(.v-list-item--prepend .v-icon) {
  width: 20px !important;
  height: 20px !important;
  font-size: 20px !important;
  margin: 0 !important;
}

:deep(.v-list-item__prepend .v-avatar),
:deep(.v-list-item--prepend .v-avatar) {
  width: 20px !important;
  height: 20px !important;
  min-width: 20px !important;
  margin: 0 !important;
}

/* 控制拖拽手柄大小 */
:deep(.v-list-item__prepend .drag-handle),
:deep(.v-list-item--prepend .drag-handle) {
  width: 16px !important;
  height: 16px !important;
  margin: 0 !important;
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
  content: "";
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
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }

  100% {
    opacity: 1;
  }
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
  width: 8px;
  /* 稍微宽一点，更容易操作 */
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

/* removed confirmation-stats */

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
  margin: 0 2px !important;
  /* 按钮间距4px */
}

.refresh-btn,
.confirm-btn {
  margin-left: 8px !important;
  /* 按钮间距8px */
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
  margin-bottom: 0;
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

.build-badge {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 99999;
  background: rgba(33, 33, 33, 0.9);
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>
