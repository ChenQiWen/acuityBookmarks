/**
 * Management管理页面状态管理Store
 * 管理书签管理页面的所有状态和操作
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { PERFORMANCE_CONFIG, BOOKMARK_CONFIG } from '../config/constants'
import { performanceMonitor, debounce } from '../utils/performance'
import { withRetry, operationQueue, safeExecute, DataValidator, ErrorType, AppError } from '../utils/error-handling'
import { logger } from '../utils/logger'
import type { 
  BookmarkNode, 
  ChromeBookmarkTreeNode, 
  BookmarkHoverPayload, 
  ReorderEvent, 
  CacheStatus as ICacheStatus,
  StorageData,
  DuplicateInfo,
  FormRef 
} from '../types'

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
  
  // 搜索状态
  const searchQuery = ref('')
  
  // 书签树状态
  const originalTree = ref<ChromeBookmarkTreeNode[]>([])  
  const newProposalTree = ref<ProposalNode>({
  id: "root-empty",
  title: "等待数据源",
  children: [],
  })
  
  // 变更追踪状态
  const structuresAreDifferent = ref(false)
  const hasDragChanges = ref(false)
  
  // === 数据加载和缓存状态 ===
  
  // 性能优化：数据加载缓存机制
  const dataLoaded = ref(false)
  const lastDataLoadTime = ref(0)
  
  // 防抖处理大数据集操作
  const debouncedBuildMapping = debounce((...args: unknown[]) => {
    const [originalTree, proposedTree] = args as [ChromeBookmarkTreeNode[], ProposalNode[]]
    buildBookmarkMappingImpl(originalTree, proposedTree)
  }, 300)
  
  // 页面加载状态
  const isPageLoading = ref(true)
  const loadingMessage = ref("正在加载书签数据...")
  
  // 缓存状态
  const cacheStatus = ref<CacheStatus>({
    isFromCache: false,
    lastUpdate: null,
    dataAge: null,
  })
  
  // === AI处理状态 ===
  
  // AI生成状态
  const isGenerating = ref(false)
  const progressValue = ref(0)
  const progressTotal = ref(0)
  
  // === 对话框状态 ===
  
  // 应用确认对话框
  const isApplyConfirmDialogOpen = ref(false)
  
  // 书签编辑相关对话框
  const isEditBookmarkDialogOpen = ref(false)
  const isDeleteBookmarkDialogOpen = ref(false)
  const isDeleteFolderDialogOpen = ref(false)
  const editingBookmark = ref<BookmarkNode | null>(null)
  const deletingBookmark = ref<BookmarkNode | null>(null)
  const deletingFolder = ref<BookmarkNode | null>(null)
  
  // 编辑表单状态
  const editTitle = ref("")
  const editUrl = ref("")
  
  // 添加新项对话框
  const isAddNewItemDialogOpen = ref(false)
  const addItemType = ref<"folder" | "bookmark">("bookmark")
  const parentFolder = ref<BookmarkNode | null>(null)
  const newItemTitle = ref("")
  const newItemUrl = ref("")
  
  // 其他对话框
  const isDuplicateDialogOpen = ref(false)
  const isCancelConfirmDialogOpen = ref(false)
  
  // === 操作进行状态 ===
  
  const isAddingItem = ref(false)
  const isEditingBookmark = ref(false)
  const isDeletingBookmark = ref(false)
  const isDeletingFolder = ref(false)
  const isApplyingChanges = ref(false)
  
  // === 通知状态 ===
  
  const snackbar = ref(false)
  const snackbarText = ref("")
  const snackbarColor = ref("info")
  
  // === 复杂数据结构状态 ===
  
  // 书签映射和展开状态
  const bookmarkMapping = ref<Map<string, any>>(new Map())
  const originalExpandedFolders = ref<Set<string>>(new Set())
  const proposalExpandedFolders = ref<Set<string>>(new Set())
  
  // === 书签悬停和交互状态 ===
  
  // 书签悬停状态
  const hoveredBookmarkId = ref<string | null>(null)
  
  // 重复检测状态
  const duplicateInfo = ref<DuplicateInfo | null>(null)
  
  // 表单引用状态
  const addForm = ref<FormRef>(null)
  
  // === 计算属性 ===
  
  // 获取右侧面板标题
  const getProposalPanelTitle = computed(() => {
    return "新的书签目录"
  })
  
  // 获取右侧面板图标
  const getProposalPanelIcon = computed(() => {
    if (newProposalTree.value.id === "root-empty") {
      return "mdi-plus-circle-outline"
    } else if (newProposalTree.value.id === "root-cloned") {
      return "mdi-database"
    } else if (newProposalTree.value.id === "root-quick") {
      return "mdi-flash"
    } else if (newProposalTree.value.id === "root-0") {
      return "mdi-magic-staff"
    }
    return "mdi-magic-staff"
  })
  
  // 获取右侧面板颜色
  const getProposalPanelColor = computed(() => {
    if (newProposalTree.value.id === "root-empty") {
      return "grey"
    } else if (newProposalTree.value.id === "root-cloned") {
      return "secondary"
    } else if (newProposalTree.value.id === "root-quick") {
      return "info"
    } else if (newProposalTree.value.id === "root-0") {
      return "primary"
    }
    return "primary"
  })
  
  // 是否可以应用更改
  const canApplyChanges = computed(() => {
    return true // 简化逻辑，应用按钮始终可用
  })
  
  // === 工具函数 ===
  
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
        dateAdded: child.dateAdded,
      };
      
      // 只有当子项确实是文件夹时才设置children属性
      if (child.children && Array.isArray(child.children) && child.children.length > 0) {
        processedChild.children = processChildrenRecursively(child.children);
      }
      
      return processedChild;
    });
  }
  
  /**
   * 解析URL参数
   */
  const parseUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const mode = urlParams.get("mode")
    return mode
  }
  
  /**
   * 显示通知 - 使用配置常量
   */
  const showNotification = (text: string, color: string = 'info', duration: number = PERFORMANCE_CONFIG.NOTIFICATION_HIDE_DELAY) => {
    snackbarText.value = text
    snackbarColor.value = color
    snackbar.value = true
    
    // 自动隐藏
    setTimeout(() => {
      snackbar.value = false
    }, duration)
  }
  
  /**
   * 显示数据准备完成通知
   */
  const showDataReadyNotification = (bookmarkCount: number) => {
    showNotification(`书签数据已准备就绪，共 ${bookmarkCount} 个书签`, 'success')
  }
  
  /**
   * 从Chrome Storage加载数据
   */
  const loadFromChromeStorage = async () => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get(
        ["originalTree", "newProposal", "isGenerating"],
        (data) => {
          try {
            if (data.originalTree) {
              const fullTree: ChromeBookmarkTreeNode[] = []

              // 处理书签树数据结构
              if (data.originalTree && data.originalTree.length > 0) {
                if (
                  data.originalTree[0].children &&
                  Array.isArray(data.originalTree[0].children)
                ) {
                  // [root] 格式：取根节点的子节点
                  const rootNode = data.originalTree[0]
                  
                  rootNode.children.forEach((node: BookmarkNode) => {
                    
                    const treeNode: any = {
                      id: node.id,
                      title: node.title,
                      url: node.url,
                      parentId: node.parentId,
                      index: node.index,
                      dateAdded: node.dateAdded,
                    }
                    
                    // 只对文件夹节点设置children属性
                    if (node.children && Array.isArray(node.children)) {
                      const processedChildren = processChildrenRecursively(node.children);
                      treeNode.children = processedChildren;
                    }
                    
                    fullTree.push(treeNode)
                  })
                } else {
                  // 直接是文件夹数组格式
                  data.originalTree.forEach((node: ChromeBookmarkTreeNode) => {
                    const treeNode: any = {
                      id: node.id,
                      title: node.title,
                      url: node.url,
                      parentId: node.parentId,
                      index: node.index,
                      dateAdded: node.dateAdded,
                    }
                    
                    // 只对文件夹节点设置children属性
                    if (node.children && Array.isArray(node.children)) {
                      // 🔑 递归处理所有子项
                      treeNode.children = processChildrenRecursively(node.children)
                    }
                    
                    fullTree.push(treeNode)
                  })
                }
              }

              originalTree.value = fullTree
              rebuildOriginalIndexes(fullTree)

              // 根据模式设置右侧数据
              setRightPanelFromLocalOrAI(fullTree, { newProposal: data.newProposal })

              // 默认展开顶层文件夹
              try {
                originalExpandedFolders.value.clear()
                originalExpandedFolders.value.add('1') // 书签栏
                originalExpandedFolders.value.add('2') // 其他书签
                fullTree.forEach((f: ChromeBookmarkTreeNode) => {
                  if (Array.isArray(f.children) && f.children.length > 0) {
                    originalExpandedFolders.value.add(f.id)
                  }
                })
                originalExpandedFolders.value = new Set(originalExpandedFolders.value)
              } catch (e) {
                console.warn('展开文件夹失败:', e)
              }

              updateComparisonState()

              if (originalTree.value && newProposalTree.value.children) {
                buildBookmarkMapping(
                  originalTree.value,
                  newProposalTree.value.children
                )
              }

              isGenerating.value = data.isGenerating || false
            }

            // 设置加载完成状态
            setTimeout(() => {
              isPageLoading.value = false
              loadingMessage.value = ""
            }, 100)

          } catch (error) {
            console.error('加载Chrome存储数据失败:', error)
            isPageLoading.value = false
            loadingMessage.value = "加载失败"
          }
          
          resolve()
        }
      )
    })
  }
  
  /**
   * 根据进入模式设置右侧数据
   */
  const setRightPanelFromLocalOrAI = (fullTree: ChromeBookmarkTreeNode[], storageData: StorageData): void => {
    const mode = parseUrlParams()
    if (mode === 'ai' && storageData && storageData.newProposal) {
      const proposal = convertLegacyProposalToTree(storageData.newProposal)
      newProposalTree.value = { ...proposal } as any
      
      // 初始化右侧面板展开状态
      try {
        proposalExpandedFolders.value.clear()
        proposalExpandedFolders.value.add('1') // 书签栏
        proposalExpandedFolders.value.add('2') // 其他书签
        proposalExpandedFolders.value.add('root-cloned') // 克隆根节点
        if (proposal.children) {
          proposal.children.forEach((f: any) => {
            if (Array.isArray(f.children) && f.children.length > 0) {
              proposalExpandedFolders.value.add(f.id)
            }
          })
        }
        proposalExpandedFolders.value = new Set(proposalExpandedFolders.value)
      } catch (e) {
        console.warn('右侧面板展开状态初始化失败(AI模式):', e)
      }
    } else {
      newProposalTree.value = {
        id: 'root-cloned',
        title: '克隆的书签结构',
        children: JSON.parse(JSON.stringify(fullTree))
      } as any
      
      // 初始化右侧面板展开状态（克隆模式）
      try {
        proposalExpandedFolders.value.clear()
        proposalExpandedFolders.value.add('1') // 书签栏
        proposalExpandedFolders.value.add('2') // 其他书签
        proposalExpandedFolders.value.add('root-cloned') // 克隆根节点
        fullTree.forEach((f: ChromeBookmarkTreeNode) => {
          if (Array.isArray(f.children) && f.children.length > 0) {
            proposalExpandedFolders.value.add(f.id)
          }
        })
        proposalExpandedFolders.value = new Set(proposalExpandedFolders.value)
      } catch (e) {
        console.warn('右侧面板展开状态初始化失败(克隆模式):', e)
      }
    }
  }
  
  /**
   * 转换旧版提案格式到树格式
   */
  const convertLegacyProposalToTree = (proposal: ProposalNode | Record<string, unknown> | undefined): ProposalNode => {
    // 如果已经是ProposalNode类型，直接返回
    if (proposal && typeof proposal === 'object' && 'id' in proposal && 'title' in proposal) {
      return proposal as ProposalNode
    }
    // 简化的转换逻辑，实际实现需要根据具体的提案格式
    const children = (proposal && typeof proposal === 'object' && 'children' in proposal) 
      ? (proposal.children as ProposalNode[] || []) 
      : []
    return {
      id: 'root-0',
      title: 'AI 建议结构',
      children
    }
  }
  
  /**
   * 重建原始索引
   */
  const rebuildOriginalIndexes = (tree: ChromeBookmarkTreeNode[]) => {
    // 这里应该实现索引重建逻辑
    logger.info('Management', '重建原始索引', { treeLength: tree.length })
  }
  
  /**
   * 更新比较状态
   */
  const updateComparisonState = () => {
    // 简化的比较逻辑
    structuresAreDifferent.value = true
  }
  
  /**
   * 构建书签映射实现 - 优化性能
   */
  function buildBookmarkMappingImpl(originalTree: ChromeBookmarkTreeNode[], proposedTree: ProposalNode[]) {
    performanceMonitor.startMeasure('buildBookmarkMapping', {
      originalCount: originalTree.length,
      proposedCount: proposedTree.length
    })
    
    try {
      bookmarkMapping.value.clear()
      
      // 如果数据集很大，使用优化算法
      const isLargeDataset = originalTree.length > BOOKMARK_CONFIG.LARGE_DATASET_THRESHOLD ||
                           proposedTree.length > BOOKMARK_CONFIG.LARGE_DATASET_THRESHOLD
      
      if (isLargeDataset) {
        logger.info('Management', '检测到大数据集，使用优化算法')
        // TODO: 实现优化的映射算法
      } else {
        // 简单映射算法
        // TODO: 实现基本映射算法
      }
      
      logger.info('Management', '构建书签映射完成', { 
        mappingCount: bookmarkMapping.value.size,
        isLargeDataset
      })
    } catch (error) {
      logger.error('Management', '构建书签映射失败', { error })
    } finally {
      performanceMonitor.endMeasure('buildBookmarkMapping')
    }
  }
  
  /**
   * 构建书签映射 - 防抖版本
   */
  const buildBookmarkMapping = (originalTree: ChromeBookmarkTreeNode[], proposedTree: ProposalNode[]) => {
    debouncedBuildMapping(originalTree, proposedTree)
  }
  
  /**
   * 当从Chrome直接拉取并回填缓存时恢复原始树
   */
  const recoverOriginalTreeFromChrome = async (): Promise<ChromeBookmarkTreeNode[]> => {
    return new Promise((resolve) => {
      try {
        chrome.bookmarks.getTree((tree) => {
          if (!Array.isArray(tree) || tree.length === 0) {
            resolve([])
            return
          }
          
          // 回写到storage，保持原始[root]形态
          chrome.storage.local.set({ originalTree: tree }, () => {
            const rootNode = tree[0]
            const fullTree: ChromeBookmarkTreeNode[] = []
            if (rootNode && Array.isArray(rootNode.children)) {
              (rootNode.children as ChromeBookmarkTreeNode[]).forEach((folder: ChromeBookmarkTreeNode) => {
                fullTree.push(folder)
              })
            }
            resolve(fullTree)
          })
        })
      } catch (e) {
        console.error('恢复原始树失败:', e)
        resolve([])
      }
    })
  }
  
  // === 对话框操作函数 ===
  
  /**
   * 打开编辑书签对话框
   */
  const openEditBookmarkDialog = (bookmark: BookmarkNode) => {
    editingBookmark.value = bookmark
    editTitle.value = bookmark.title || ""
    editUrl.value = bookmark.url || ""
    isEditBookmarkDialogOpen.value = true
  }
  
  /**
   * 关闭编辑书签对话框
   */
  const closeEditBookmarkDialog = () => {
    isEditBookmarkDialogOpen.value = false
    editingBookmark.value = null
    editTitle.value = ""
    editUrl.value = ""
  }
  
  /**
   * 打开删除书签对话框
   */
  const openDeleteBookmarkDialog = (bookmark: BookmarkNode) => {
    deletingBookmark.value = bookmark
    isDeleteBookmarkDialogOpen.value = true
  }
  
  /**
   * 关闭删除书签对话框
   */
  const closeDeleteBookmarkDialog = () => {
    isDeleteBookmarkDialogOpen.value = false
    deletingBookmark.value = null
  }
  
  /**
   * 打开删除文件夹对话框
   */
  const openDeleteFolderDialog = (folder: BookmarkNode) => {
    deletingFolder.value = folder
    isDeleteFolderDialogOpen.value = true
  }
  
  /**
   * 关闭删除文件夹对话框
   */
  const closeDeleteFolderDialog = () => {
    isDeleteFolderDialogOpen.value = false
    deletingFolder.value = null
  }
  
  /**
   * 打开添加新项对话框
   */
  const openAddNewItemDialog = (type: "folder" | "bookmark", parent: BookmarkNode | null = null) => {
    addItemType.value = type
    parentFolder.value = parent
    newItemTitle.value = ""
    newItemUrl.value = ""
    isAddNewItemDialogOpen.value = true
  }
  
  /**
   * 关闭添加新项对话框
   */
  const closeAddNewItemDialog = () => {
    isAddNewItemDialogOpen.value = false
    addItemType.value = "bookmark"
    parentFolder.value = null
    newItemTitle.value = ""
    newItemUrl.value = ""
  }
  
  // === 展开/折叠操作 ===
  
  /**
   * 展开所有文件夹
   */
  const expandAllFolders = (isOriginal: boolean) => {
    const expandedFolders = isOriginal ? originalExpandedFolders : proposalExpandedFolders
    const tree = isOriginal ? originalTree.value : newProposalTree.value.children || []
    
    const collectAllFolderIds = (nodes: ChromeBookmarkTreeNode[]): string[] => {
      const ids: string[] = []
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          ids.push(node.id)
          ids.push(...collectAllFolderIds(node.children))
        }
      })
      return ids
    }
    
    const allIds = collectAllFolderIds(tree)
    expandedFolders.value = new Set(allIds)
  }
  
  /**
   * 折叠所有文件夹
   */
  const collapseAllFolders = (isOriginal: boolean) => {
    const expandedFolders = isOriginal ? originalExpandedFolders : proposalExpandedFolders
    expandedFolders.value.clear()
    expandedFolders.value = new Set()
  }
  
  /**
   * 切换左侧面板文件夹展开状态
   */
  const toggleOriginalFolder = (nodeId: string) => {
    // 对于顶级文件夹（书签栏、其他书签），总是保持展开状态
    const isTopLevelFolder = nodeId === '1' || nodeId === '2'
    
    if (originalExpandedFolders.value.has(nodeId)) {
      if (!isTopLevelFolder) {
        originalExpandedFolders.value.delete(nodeId)
      }
    } else {
      originalExpandedFolders.value.add(nodeId)
    }
    
    // 触发响应式更新
    originalExpandedFolders.value = new Set(originalExpandedFolders.value)
  }

  /**
   * 切换右侧面板文件夹展开状态
   */
  const toggleProposalFolder = (nodeId: string) => {
    // 对于顶级文件夹（书签栏、其他书签），总是保持展开状态
    const isTopLevelFolder = nodeId === '1' || nodeId === '2' || nodeId === 'root-cloned'
    
    if (proposalExpandedFolders.value.has(nodeId)) {
      if (!isTopLevelFolder) {
        proposalExpandedFolders.value.delete(nodeId)
      }
    } else {
      proposalExpandedFolders.value.add(nodeId)
    }
    
    // 触发响应式更新
    proposalExpandedFolders.value = new Set(proposalExpandedFolders.value)
  }
  
  // === 书签悬停操作 ===
  
  /**
   * 设置悬停书签
   */
  const setBookmarkHover = (payload: BookmarkHoverPayload) => {
    if (!payload || payload === null || payload === undefined) {
      hoveredBookmarkId.value = null
      return
    }
    
    const id = (typeof payload === 'object' && 'id' in payload) ? payload.id : null
    const isOriginal = (typeof payload === 'object' && 'isOriginal' in payload) ? payload.isOriginal : false
    
    if (hoveredBookmarkId.value === id) return
    
    hoveredBookmarkId.value = id || null
    
    // 处理映射逻辑(预留以后扩展)
    // const mapping = bookmarkMapping.value.get(id || "")
    // let targetOriginal: BookmarkNode | null = null
    
    // 这里可以添加更复杂的悬停逻辑
    logger.info('Management', '设置书签悬停', { id, isOriginal })
  }
  
  // === 书签操作 ===
  
  /**
   * 删除书签
   */
  const deleteBookmark = async (node: BookmarkNode) => {
    openDeleteBookmarkDialog(node)
  }
  
  /**
   * 编辑书签
   */
  const editBookmark = (node: BookmarkNode) => {
    openEditBookmarkDialog(node)
  }
  
  /**
   * 删除文件夹
   */
  const deleteFolder = async (node: BookmarkNode) => {
    openDeleteFolderDialog(node)
  }
  
  /**
   * 处理重新排序
   */
  const handleReorder = (event?: ReorderEvent) => {
    hasDragChanges.value = true
    updateComparisonState()
    
    // 这里可以添加重新排序的具体逻辑
    logger.info('Management', '处理重新排序', { event })
  }
  
  /**
   * 复制成功处理
   */
  const handleCopySuccess = () => {
    showNotification('链接已复制到剪贴板', 'success', 2000)
  }
  
  /**
   * 复制失败处理
   */
  const handleCopyFailed = () => {
    showNotification('复制链接失败', 'error', 2000)
  }
  
  /**
   * 添加新项目
   */
  const addNewItem = (parentNode: BookmarkNode) => {
    openAddNewItemDialog('bookmark', parentNode)
  }
  

  
  return {
    // === 状态 ===
    
    // 核心数据
    searchQuery,
    originalTree,
    newProposalTree,
    structuresAreDifferent,
    hasDragChanges,
    
    // 加载和缓存
    dataLoaded,
    lastDataLoadTime,
    isPageLoading,
    loadingMessage,
    cacheStatus,
    
    // AI处理
    isGenerating,
    progressValue,
    progressTotal,
    
    // 对话框
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
    
    // 操作状态
    isAddingItem,
    isEditingBookmark,
    isDeletingBookmark,
    isDeletingFolder,
    isApplyingChanges,
    
    // 通知
    snackbar,
    snackbarText,
    snackbarColor,
    
    // 复杂状态
    bookmarkMapping,
    originalExpandedFolders,
    proposalExpandedFolders,
    hoveredBookmarkId,
    duplicateInfo,
    addForm,
    
    // === 计算属性 ===
    getProposalPanelTitle,
    getProposalPanelIcon,
    getProposalPanelColor,
    canApplyChanges,
    
    // === 方法 ===
    
    // 工具函数
    parseUrlParams,
    showNotification,
    showDataReadyNotification,
    
    // 数据操作
    loadFromChromeStorage,
    setRightPanelFromLocalOrAI,
    convertLegacyProposalToTree,
    rebuildOriginalIndexes,
    updateComparisonState,
    buildBookmarkMapping,
    recoverOriginalTreeFromChrome,
    
    // 对话框操作
    openEditBookmarkDialog,
    closeEditBookmarkDialog,
    openDeleteBookmarkDialog,
    closeDeleteBookmarkDialog,
    openDeleteFolderDialog,
    closeDeleteFolderDialog,
    openAddNewItemDialog,
    closeAddNewItemDialog,
    
    // 展开/折叠
    expandAllFolders,
    collapseAllFolders,
    toggleOriginalFolder,
    toggleProposalFolder,
    
    // 书签操作
    setBookmarkHover,
    deleteBookmark,
    editBookmark,
    deleteFolder,
    handleReorder,
    handleCopySuccess,
    handleCopyFailed,
    addNewItem,
    
    // 初始化
    initialize
  }
  
  /**
   * 初始化Management页面 - 增强性能监控、错误处理和竞态条件防护
   */
  async function initialize(): Promise<void> {
    // 使用操作队列防止重复初始化
    return operationQueue.serialize('management_initialization', async () => {
      return withRetry(
        async () => {
          performanceMonitor.startMeasure('management_initialization')
          logger.info('Management', 'ManagementStore初始化开始')
          
          try {
            // 检查数据缓存是否有效
            const now = Date.now()
            if (dataLoaded.value && (now - lastDataLoadTime.value) < PERFORMANCE_CONFIG.DATA_CACHE_TIME) {
              logger.info('Management', '使用缓存数据，跳过重新加载')
              isPageLoading.value = false
              loadingMessage.value = ""
              return
            }
            
            // 设置初始加载状态
            isPageLoading.value = true
            loadingMessage.value = "正在加载书签数据..."
            
            // 加载数据（带错误处理）
            await safeExecute(
              () => loadFromChromeStorage(),
              { operation: 'loadFromChromeStorage', component: 'ManagementStore' }
            )
            
            // 检查加载结果
            if (!DataValidator.isBookmarkArray(originalTree.value)) {
              throw new AppError('书签数据格式错误', ErrorType.VALIDATION)
            }
            
            // 记录加载时间
            lastDataLoadTime.value = Date.now()
            dataLoaded.value = true
            
            // 性能监控 - 记录初始化完成
            logger.info('Management', '初始化性能指标', {
              originalTreeLength: originalTree.value.length,
              proposalTreeLength: newProposalTree.value.children?.length || 0,
              cacheUsed: false,
              isLargeDataset: originalTree.value.length > BOOKMARK_CONFIG.LARGE_DATASET_THRESHOLD
            })
            
            // 显示数据准备完成通知
            const totalBookmarks = countBookmarksInTree(originalTree.value)
            showNotification(`书签数据已准备就绪，共 ${totalBookmarks} 个书签`, 'success')
            
            logger.info('Management', 'ManagementStore初始化完成', { totalBookmarks })
            
          } finally {
            performanceMonitor.endMeasure('management_initialization')
          }
        },
        {
          maxAttempts: 2,
          shouldRetry: (error) => {
            const errorType = error instanceof AppError ? error.type : undefined
            // 只重试网络和Chrome API错误
            return errorType === ErrorType.NETWORK || errorType === ErrorType.CHROME_API
          }
        },
        { operation: 'management_initialization', component: 'ManagementStore' }
      ).catch((error) => {
        logger.error('Management', 'Management初始化最终失败', { error })
        isPageLoading.value = false
        loadingMessage.value = "初始化失败"
        
        const userMessage = error instanceof AppError ? error.message : '初始化失败，请刷新页面后重试'
        showNotification(userMessage, 'error')
        
        throw error // 重新抛出以便上层处理
      })
    })
  }
  
  /**
   * 计算树中的书签数量
   */
  function countBookmarksInTree(tree: ChromeBookmarkTreeNode[]): number {
    let count = 0
    
    function traverse(nodes: ChromeBookmarkTreeNode[]) {
      for (const node of nodes) {
        if (node.url) {
          count++
        } else if (node.children) {
          traverse(node.children)
        }
      }
    }
    
    traverse(tree)
    return count
  }
})