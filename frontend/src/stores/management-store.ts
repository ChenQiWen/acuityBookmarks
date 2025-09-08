/**
 * Management管理页面状态管理Store
 * 管理书签管理页面的所有状态和操作
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { performanceMonitor } from '../utils/performance-monitor'
import { logger } from '../utils/logger'

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

export interface CacheStatus {
  isFromCache: boolean
  lastUpdate: number | null
  dataAge: number | null
}

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
  const originalTree = ref<chrome.bookmarks.BookmarkTreeNode[]>([])
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
  const DATA_CACHE_TIME = 5000 // 5秒内不重复加载
  
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
  const editingBookmark = ref<any>(null)
  const deletingBookmark = ref<any>(null)
  const deletingFolder = ref<any>(null)
  
  // 编辑表单状态
  const editTitle = ref("")
  const editUrl = ref("")
  
  // 添加新项对话框
  const isAddNewItemDialogOpen = ref(false)
  const addItemType = ref<"folder" | "bookmark">("bookmark")
  const parentFolder = ref<any>(null)
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
  const duplicateInfo = ref<any>(null)
  
  // 表单引用状态
  const addForm = ref<any>(null)
  
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
   * 解析URL参数
   */
  const parseUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const mode = urlParams.get("mode")
    return mode
  }
  
  /**
   * 显示通知
   */
  const showNotification = (text: string, color: string = 'info', duration: number = 3000) => {
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
              const fullTree: any[] = []

              // 处理书签树数据结构
              if (data.originalTree && data.originalTree.length > 0) {
                if (
                  data.originalTree[0].children &&
                  Array.isArray(data.originalTree[0].children)
                ) {
                  // [root] 格式：取根节点的子节点
                  const rootNode = data.originalTree[0]
                  rootNode.children.forEach((folder: any) => {
                    fullTree.push({
                      id: folder.id,
                      title: folder.title,
                      children: folder.children || [],
                    })
                  })
                } else {
                  // 直接是文件夹数组格式
                  data.originalTree.forEach((folder: any) => {
                    fullTree.push({
                      id: folder.id,
                      title: folder.title,
                      children: folder.children || [],
                    })
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
                fullTree.forEach((f: any) => {
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
  const setRightPanelFromLocalOrAI = (fullTree: any[], storageData: any): void => {
    const mode = parseUrlParams()
    if (mode === 'ai' && storageData && storageData.newProposal) {
      const proposal = convertLegacyProposalToTree(storageData.newProposal)
      newProposalTree.value = { ...proposal } as any
    } else {
      newProposalTree.value = {
        id: 'root-cloned',
        title: '克隆的书签结构',
        children: JSON.parse(JSON.stringify(fullTree))
      } as any
    }
  }
  
  /**
   * 转换旧版提案格式到树格式
   */
  const convertLegacyProposalToTree = (proposal: any): ProposalNode => {
    // 简化的转换逻辑，实际实现需要根据具体的提案格式
    return {
      id: 'root-0',
      title: 'AI 建议结构',
      children: proposal?.children || []
    }
  }
  
  /**
   * 重建原始索引
   */
  const rebuildOriginalIndexes = (tree: any[]) => {
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
   * 构建书签映射
   */
  const buildBookmarkMapping = (originalTree: any[], proposedTree: any[]) => {
    bookmarkMapping.value.clear()
    // 这里应该实现映射构建逻辑
    logger.info('Management', '构建书签映射', { 
      originalCount: originalTree.length, 
      proposedCount: proposedTree.length 
    })
  }
  
  /**
   * 当从Chrome直接拉取并回填缓存时恢复原始树
   */
  const recoverOriginalTreeFromChrome = async (): Promise<any[]> => {
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
            const fullTree: any[] = []
            if (rootNode && Array.isArray(rootNode.children)) {
              rootNode.children.forEach((folder: any) => {
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
  const openEditBookmarkDialog = (bookmark: any) => {
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
  const openDeleteBookmarkDialog = (bookmark: any) => {
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
  const openDeleteFolderDialog = (folder: any) => {
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
  const openAddNewItemDialog = (type: "folder" | "bookmark", parent: any = null) => {
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
    
    const collectAllFolderIds = (nodes: any[]): string[] => {
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
   * 切换文件夹展开状态
   */
  const toggleFolder = (nodeId: string, isOriginal: boolean = false) => {
    const expandedFolders = isOriginal ? originalExpandedFolders : proposalExpandedFolders
    
    if (expandedFolders.value.has(nodeId)) {
      expandedFolders.value.delete(nodeId)
    } else {
      expandedFolders.value.add(nodeId)
    }
    
    // 触发响应式更新
    expandedFolders.value = new Set(expandedFolders.value)
  }
  
  // === 书签悬停操作 ===
  
  /**
   * 设置悬停书签
   */
  const setBookmarkHover = (payload: any) => {
    if (!payload) {
      hoveredBookmarkId.value = null
      return
    }
    
    const { id, isOriginal } = payload
    if (hoveredBookmarkId.value === id) return
    
    hoveredBookmarkId.value = id
    
    // 处理映射逻辑(预留以后扩展)
    // const mapping = bookmarkMapping.value.get(id || "")
    // let targetOriginal: any | null = null
    
    // 这里可以添加更复杂的悬停逻辑
    logger.info('Management', '设置书签悬停', { id, isOriginal })
  }
  
  // === 书签操作 ===
  
  /**
   * 删除书签
   */
  const deleteBookmark = async (node: any) => {
    openDeleteBookmarkDialog(node)
  }
  
  /**
   * 编辑书签
   */
  const editBookmark = (node: any) => {
    openEditBookmarkDialog(node)
  }
  
  /**
   * 删除文件夹
   */
  const deleteFolder = async (node: any) => {
    openDeleteFolderDialog(node)
  }
  
  /**
   * 处理重新排序
   */
  const handleReorder = (event?: any) => {
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
  const addNewItem = (parentNode: any) => {
    openAddNewItemDialog('bookmark', parentNode)
  }
  
  // === 初始化函数 ===
  
  /**
   * 初始化Management页面
   */
  async function initialize(): Promise<void> {
    console.log('ManagementStore初始化开始...')
    
    try {
      // 设置初始加载状态
      isPageLoading.value = true
      loadingMessage.value = "正在加载书签数据..."
      
      // 加载数据
      await loadFromChromeStorage()
      
      // 性能监控
      performanceMonitor.trackUserAction('management_initialized', {
        originalTreeLength: originalTree.value.length,
        proposalTreeLength: newProposalTree.value.children?.length || 0
      })
      
      console.log('ManagementStore初始化完成')
      
    } catch (error) {
      console.error('Management初始化失败:', error)
      isPageLoading.value = false
      loadingMessage.value = "初始化失败"
      showNotification('初始化失败: ' + (error as Error).message, 'error')
    }
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
    DATA_CACHE_TIME,
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
    toggleFolder,
    
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
})