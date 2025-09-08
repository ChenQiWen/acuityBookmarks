/**
 * Management管理页面状态管理Store
 * 管理书签管理页面的所有状态
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { performanceMonitor } from '../utils/performance-monitor'

// 类型定义
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
  // === 状态 ===
  
  // 搜索状态
  const searchQuery = ref('')
  
  // 书签树状态
  const originalTree = ref<chrome.bookmarks.BookmarkTreeNode[]>([])
  const newProposalTree = ref<ProposalNode>({
    id: "root-empty",
    title: "等待数据源",
    children: [],
  })
  
  // 变更状态
  const structuresAreDifferent = ref(false)
  const hasDragChanges = ref(false)
  
  // 数据加载缓存
  const dataLoaded = ref(false)
  const lastDataLoadTime = ref(0)
  const DATA_CACHE_TIME = 5000 // 5秒内不重复加载
  
  // 进度状态
  const progressValue = ref(0)
  const progressTotal = ref(0)
  const progressStage = ref('')
  const progressMessage = ref('')
  
  // 页面加载状态
  const isPageLoading = ref(true)
  const loadingMessage = ref("正在加载书签数据...")
  
  // 缓存状态
  const cacheStatus = ref<CacheStatus>({
    isFromCache: false,
    lastUpdate: null,
    dataAge: null,
  })
  
  // 对话框状态
  const isApplyConfirmDialogOpen = ref(false)
  
  // 书签编辑对话框
  const isEditBookmarkDialogOpen = ref(false)
  const isDeleteBookmarkDialogOpen = ref(false)
  const isDeleteFolderDialogOpen = ref(false)
  const editingBookmark = ref<any>(null)
  const deletingBookmark = ref<any>(null)
  const deletingFolder = ref<any>(null)
  const editTitle = ref("")
  const editUrl = ref("")
  
  // 添加新项对话框
  const isAddNewItemDialogOpen = ref(false)
  const addItemType = ref<"folder" | "bookmark">("bookmark")
  const parentFolder = ref<any>(null)
  const newItemTitle = ref("")
  const newItemUrl = ref("")
  const isDuplicateDialogOpen = ref(false)
  const duplicateInfo = ref<any>(null)
  const isCancelConfirmDialogOpen = ref(false)
  
  // 加载状态
  const isAddingItem = ref(false)
  const isEditingBookmark = ref(false)
  const isDeletingBookmark = ref(false)
  const isDeletingFolder = ref(false)
  const isApplyingChanges = ref(false)
  
  // 书签悬停映射
  const hoveredBookmarkId = ref<string | null>(null)
  const bookmarkMapping = ref<Map<string, any>>(new Map())
  const originalExpandedFolders = ref<Set<string>>(new Set())
  const proposalExpandedFolders = ref<Set<string>>(new Set())
  
  // 索引映射
  const originalIdToNode = ref<Map<string, any>>(new Map())
  const originalIdToAncestors = ref<Map<string, any[]>>(new Map())
  const originalIdToParentId = ref<Map<string, string>>(new Map())
  
  // Debug构建标识
  const DEBUG_BUILD_ID = "BID-b7f2d9"
  
  // === 计算属性 ===
  
  // 进度百分比
  const progressPercent = computed(() => {
    if (progressTotal.value === 0) return 0
    return Math.round((progressValue.value / progressTotal.value) * 100)
  })
  
  // 是否有变更
  const hasChanges = computed(() => {
    return structuresAreDifferent.value || hasDragChanges.value
  })
  
  // 提案面板标题
  const proposalPanelTitle = computed(() => {
    return "新的书签目录"
  })
  
  // 提案面板图标
  const proposalPanelIcon = computed(() => {
    const treeId = newProposalTree.value.id
    if (treeId === "root-empty") return "mdi-plus-circle-outline"
    if (treeId === "root-cloned") return "mdi-database"
    if (treeId === "root-quick") return "mdi-flash"
    if (treeId === "root-0") return "mdi-magic-staff"
    return "mdi-magic-staff"
  })
  
  // 提案面板颜色
  const proposalPanelColor = computed(() => {
    const treeId = newProposalTree.value.id
    if (treeId === "root-empty") return "grey"
    if (treeId === "root-cloned") return "secondary"
    if (treeId === "root-quick") return "info"
    if (treeId === "root-0") return "primary"
    return "primary"
  })
  
  // 书签总数
  const totalBookmarks = computed(() => {
    let count = 0
    function countBookmarks(nodes: any[]): void {
      nodes.forEach(node => {
        if (node.url) count++
        if (node.children) countBookmarks(node.children)
      })
    }
    countBookmarks(originalTree.value)
    return count
  })
  
  // 文件夹总数
  const totalFolders = computed(() => {
    let count = 0
    function countFolders(nodes: any[]): void {
      nodes.forEach(node => {
        if (!node.url && node.children) {
          count++
          countFolders(node.children)
        }
      })
    }
    countFolders(originalTree.value)
    return count
  })
  
  // === 动作 ===
  
  /**
   * 解析URL参数
   */
  function parseUrlParams(): Record<string, string> {
    const urlParams = new URLSearchParams(window.location.search)
    const params: Record<string, string> = {}
    
    for (const [key, value] of urlParams.entries()) {
      params[key] = value
    }
    
    return params
  }
  
  /**
   * 重建原始索引
   */
  function rebuildOriginalIndexes(nodes: any[]): void {
    originalIdToNode.value.clear()
    originalIdToAncestors.value.clear()
    originalIdToParentId.value.clear()
    
    function traverse(node: any, ancestors: any[] = [], parentId?: string): void {
      originalIdToNode.value.set(node.id, node)
      originalIdToAncestors.value.set(node.id, [...ancestors])
      
      if (parentId) {
        originalIdToParentId.value.set(node.id, parentId)
      }
      
      if (node.children) {
        node.children.forEach((child: any) => {
          traverse(child, [...ancestors, node], node.id)
        })
      }
    }
    
    nodes.forEach(node => traverse(node))
  }
  
  /**
   * 加载书签数据
   */
  async function loadBookmarkData(): Promise<void> {
    // 检查缓存
    const now = Date.now()
    if (dataLoaded.value && (now - lastDataLoadTime.value) < DATA_CACHE_TIME) {
      console.log('使用缓存的书签数据')
      return
    }
    
    isPageLoading.value = true
    loadingMessage.value = "正在加载书签数据..."
    
    try {
      await performanceMonitor.measureAIAnalysis(async () => {
        updateProgress(25, 100, 'loading', '正在获取书签树...')
        
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          const tree = await chrome.bookmarks.getTree()
          
          updateProgress(50, 100, 'processing', '正在处理书签数据...')
          
          // 处理书签树
          originalTree.value = tree[0]?.children || []
          
          updateProgress(75, 100, 'indexing', '正在建立索引...')
          
          // 重建索引
          rebuildOriginalIndexes(originalTree.value)
          
          updateProgress(100, 100, 'completed', '书签数据加载完成')
          
          // 更新缓存状态
          dataLoaded.value = true
          lastDataLoadTime.value = now
          cacheStatus.value = {
            isFromCache: false,
            lastUpdate: now,
            dataAge: 0
          }
          
        } else {
          // 开发环境模拟数据
          originalTree.value = generateMockBookmarkTree()
          rebuildOriginalIndexes(originalTree.value)
        }
        
        performanceMonitor.trackUserAction('bookmark_data_loaded', {
          bookmark_count: totalBookmarks.value,
          folder_count: totalFolders.value
        })
        
      }, totalBookmarks.value, 'data_loading')
      
    } catch (error) {
      console.error('加载书签数据失败:', error)
      loadingMessage.value = `加载失败: ${(error as Error).message}`
    } finally {
      isPageLoading.value = false
    }
  }
  
  /**
   * 生成模拟书签树（开发环境）
   */
  function generateMockBookmarkTree(): any[] {
    return [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: '2',
            title: 'Vue.js 官方文档',
            url: 'https://vuejs.org/'
          },
          {
            id: '3',
            title: '开发工具',
            children: [
              {
                id: '4',
                title: 'GitHub',
                url: 'https://github.com'
              },
              {
                id: '5',
                title: 'TypeScript',
                url: 'https://www.typescriptlang.org/'
              }
            ]
          }
        ]
      }
    ]
  }
  
  /**
   * 更新进度
   */
  function updateProgress(
    value: number,
    total: number,
    stage: string,
    message: string
  ): void {
    progressValue.value = value
    progressTotal.value = total
    progressStage.value = stage
    progressMessage.value = message
  }
  
  /**
   * 生成AI建议结构
   */
  async function generateAIProposal(): Promise<void> {
    if (!originalTree.value.length) {
      console.warn('没有原始数据，无法生成AI建议')
      return
    }
    
    try {
      await performanceMonitor.measureAIAnalysis(async () => {
        updateProgress(0, 100, 'analyzing', '正在分析书签内容...')
        
        // 模拟AI分析延迟
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        updateProgress(50, 100, 'categorizing', '正在智能分类...')
        
        // 模拟分类处理
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        updateProgress(75, 100, 'optimizing', '正在优化结构...')
        
        // 生成AI建议的树结构
        const aiProposal = await generateIntelligentStructure(originalTree.value)
        
        updateProgress(100, 100, 'completed', 'AI建议生成完成')
        
        newProposalTree.value = {
          id: "root-0",
          title: "AI智能整理结果",
          children: aiProposal
        }
        
        // 标记有变更
        structuresAreDifferent.value = true
        
        performanceMonitor.trackUserAction('ai_proposal_generated', {
          original_count: totalBookmarks.value,
          proposal_categories: aiProposal.length
        })
        
      }, totalBookmarks.value, 'ai_proposal')
      
    } catch (error) {
      console.error('生成AI建议失败:', error)
    }
  }
  
  /**
   * 生成智能结构
   */
  async function generateIntelligentStructure(nodes: any[]): Promise<ProposalNode[]> {
    const categories = new Map<string, ProposalNode>()
    
    // 分析所有书签
    function analyzeNodes(nodeList: any[]): void {
      nodeList.forEach(node => {
        if (node.url) {
          // 简化的分类逻辑
          const category = categorizeBookmark(node)
          
          if (!categories.has(category)) {
            categories.set(category, {
              id: `category-${category}`,
              title: getCategoryDisplayName(category),
              children: []
            })
          }
          
          categories.get(category)!.children!.push({
            id: node.id,
            title: node.title,
            url: node.url
          })
        }
        
        if (node.children) {
          analyzeNodes(node.children)
        }
      })
    }
    
    analyzeNodes(nodes)
    
    return Array.from(categories.values())
  }
  
  /**
   * 分类书签
   */
  function categorizeBookmark(bookmark: any): string {
    const url = bookmark.url.toLowerCase()
    const title = bookmark.title.toLowerCase()
    
    if (url.includes('github') || title.includes('code') || title.includes('dev')) {
      return 'development'
    }
    if (url.includes('docs') || title.includes('documentation')) {
      return 'documentation'
    }
    if (url.includes('news') || url.includes('blog')) {
      return 'news'
    }
    if (url.includes('social') || url.includes('twitter') || url.includes('facebook')) {
      return 'social'
    }
    if (url.includes('video') || url.includes('youtube')) {
      return 'media'
    }
    
    return 'general'
  }
  
  /**
   * 获取分类显示名称
   */
  function getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      development: '开发工具',
      documentation: '技术文档',
      news: '新闻资讯',
      social: '社交媒体',
      media: '影音娱乐',
      general: '综合'
    }
    
    return names[category] || category
  }
  
  /**
   * 克隆当前结构
   */
  function cloneCurrentStructure(): void {
    const cloned = JSON.parse(JSON.stringify(originalTree.value))
    
    newProposalTree.value = {
      id: "root-cloned",
      title: "当前书签结构",
      children: cloned
    }
    
    structuresAreDifferent.value = false
    hasDragChanges.value = false
    
    performanceMonitor.trackUserAction('structure_cloned')
  }
  
  /**
   * 应用变更到Chrome书签
   */
  async function applyChangesToChrome(): Promise<void> {
    if (!hasChanges.value) {
      console.log('没有变更需要应用')
      return
    }
    
    isApplyingChanges.value = true
    
    try {
      await performanceMonitor.measureAIAnalysis(async () => {
        updateProgress(0, 100, 'preparing', '正在准备应用变更...')
        
        // 模拟应用变更过程
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        updateProgress(50, 100, 'applying', '正在应用到Chrome书签...')
        
        // 这里应该是实际的Chrome书签API调用
        // await applyStructureToChrome(newProposalTree.value)
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        updateProgress(100, 100, 'completed', '变更应用完成')
        
        // 重新加载数据
        await loadBookmarkData()
        
        // 清除变更标记
        structuresAreDifferent.value = false
        hasDragChanges.value = false
        
        performanceMonitor.trackUserAction('changes_applied_to_chrome')
        
      }, totalBookmarks.value, 'apply_changes')
      
    } catch (error) {
      console.error('应用变更失败:', error)
    } finally {
      isApplyingChanges.value = false
      isApplyConfirmDialogOpen.value = false
    }
  }
  
  /**
   * 开始编辑书签
   */
  function startEditBookmark(bookmark: any): void {
    editingBookmark.value = bookmark
    editTitle.value = bookmark.title
    editUrl.value = bookmark.url
    isEditBookmarkDialogOpen.value = true
  }
  
  /**
   * 保存书签编辑
   */
  async function saveBookmarkEdit(): Promise<void> {
    if (!editingBookmark.value) return
    
    isEditingBookmark.value = true
    
    try {
      // 这里应该调用Chrome书签API更新书签
      // await chrome.bookmarks.update(editingBookmark.value.id, {
      //   title: editTitle.value,
      //   url: editUrl.value
      // })
      
      // 更新本地数据
      editingBookmark.value.title = editTitle.value
      editingBookmark.value.url = editUrl.value
      
      performanceMonitor.trackUserAction('bookmark_edited')
      
      isEditBookmarkDialogOpen.value = false
      
    } catch (error) {
      console.error('保存书签编辑失败:', error)
    } finally {
      isEditingBookmark.value = false
    }
  }
  
  /**
   * 删除书签
   */
  async function deleteBookmark(_bookmark: any): Promise<void> {
    isDeletingBookmark.value = true
    
    try {
      // 这里应该调用Chrome书签API删除书签
      // await chrome.bookmarks.remove(bookmark.id)
      
      performanceMonitor.trackUserAction('bookmark_deleted')
      
      // 重新加载数据
      await loadBookmarkData()
      
      isDeleteBookmarkDialogOpen.value = false
      
    } catch (error) {
      console.error('删除书签失败:', error)
    } finally {
      isDeletingBookmark.value = false
    }
  }
  
  /**
   * 标记拖拽变更
   */
  function markDragChanges(): void {
    hasDragChanges.value = true
    
    performanceMonitor.trackUserAction('drag_changes_made')
  }
  
  /**
   * 重置所有状态
   */
  function reset(): void {
    searchQuery.value = ''
    originalTree.value = []
    newProposalTree.value = {
      id: "root-empty",
      title: "等待数据源",
      children: [],
    }
    structuresAreDifferent.value = false
    hasDragChanges.value = false
    dataLoaded.value = false
    isPageLoading.value = true
    
    // 关闭所有对话框
    isApplyConfirmDialogOpen.value = false
    isEditBookmarkDialogOpen.value = false
    isDeleteBookmarkDialogOpen.value = false
    isAddNewItemDialogOpen.value = false
    isDuplicateDialogOpen.value = false
    isCancelConfirmDialogOpen.value = false
    
    // 清除所有映射
    bookmarkMapping.value.clear()
    originalExpandedFolders.value.clear()
    proposalExpandedFolders.value.clear()
    originalIdToNode.value.clear()
    originalIdToAncestors.value.clear()
    originalIdToParentId.value.clear()
  }
  
  /**
   * 初始化管理页面
   */
  async function initialize(): Promise<void> {
    reset()
    await loadBookmarkData()
    
    performanceMonitor.trackUserAction('management_initialized', {
      has_data: originalTree.value.length > 0,
      bookmark_count: totalBookmarks.value
    })
  }
  
  // 监听器
  watch(searchQuery, (newQuery) => {
    performanceMonitor.trackUserAction('search_query_changed', {
      query_length: newQuery.length
    })
  })
  
  // 返回公共API
  return {
    // 状态
    searchQuery,
    originalTree,
    newProposalTree,
    structuresAreDifferent,
    hasDragChanges,
    dataLoaded,
    lastDataLoadTime,
    progressValue,
    progressTotal,
    progressStage,
    progressMessage,
    isPageLoading,
    loadingMessage,
    cacheStatus,
    isApplyConfirmDialogOpen,
    isEditBookmarkDialogOpen,
    isDeleteBookmarkDialogOpen,
    isDeleteFolderDialogOpen,
    editingBookmark,
    deletingBookmark,
    deletingFolder,
    editTitle,
    editUrl,
    isAddNewItemDialogOpen,
    addItemType,
    parentFolder,
    newItemTitle,
    newItemUrl,
    isDuplicateDialogOpen,
    duplicateInfo,
    isCancelConfirmDialogOpen,
    isAddingItem,
    isEditingBookmark,
    isDeletingBookmark,
    isDeletingFolder,
    isApplyingChanges,
    hoveredBookmarkId,
    bookmarkMapping,
    originalExpandedFolders,
    proposalExpandedFolders,
    originalIdToNode,
    originalIdToAncestors,
    originalIdToParentId,
    DEBUG_BUILD_ID,
    
    // 计算属性
    progressPercent,
    hasChanges,
    proposalPanelTitle,
    proposalPanelIcon,
    proposalPanelColor,
    totalBookmarks,
    totalFolders,
    
    // 动作
    parseUrlParams,
    rebuildOriginalIndexes,
    loadBookmarkData,
    generateMockBookmarkTree,
    updateProgress,
    generateAIProposal,
    generateIntelligentStructure,
    categorizeBookmark,
    getCategoryDisplayName,
    cloneCurrentStructure,
    applyChangesToChrome,
    startEditBookmark,
    saveBookmarkEdit,
    deleteBookmark,
    markDragChanges,
    reset,
    initialize
  }
})
