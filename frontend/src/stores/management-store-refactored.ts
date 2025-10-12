/**
 * 管理页面状态管理 Store（精简版）
 *
 * 职责：
 * - 仅管理UI状态（对话框、加载状态、展开状态等）
 * - 协调Application层服务
 * - 统一错误处理
 *
 * 移除的职责：
 * - 业务逻辑（迁移到Application层）
 * - 数据缓存（由Application层处理）
 * - 复杂的数据处理（由Application层处理）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import {
  useErrorHandling,
  withErrorHandling,
  withRetry
} from '@/infrastructure/error-handling'
import { notificationService } from '@/application/notification/notification-service'
import { cleanupAppService } from '@/application/cleanup/cleanup-app-service'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { searchAppService } from '@/application/search/search-app-service'
import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'
import type { CleanupProblem } from '@/core/bookmark/domain/cleanup-problem'

// === 类型定义 (从 @/types 导入) ===

import type {
  EditBookmarkData,
  AddItemData,
  CleanupState
} from '@/types/ui/store'

// === Store 定义 ===

export const useManagementStore = defineStore('management', () => {
  // === 错误处理 ===
  const { handleError, clearErrors, hasError, userErrorMessage } =
    useErrorHandling()

  // === UI 状态 ===

  // 页面加载状态
  const isPageLoading = ref(true)
  const loadingMessage = ref('正在加载书签数据...')

  // 对话框状态
  const isAddNewItemDialogOpen = ref(false)
  const addItemType = ref<'folder' | 'bookmark'>('bookmark')
  const parentFolder = ref<BookmarkNode | null>(null)
  const newItemTitle = ref('')
  const newItemUrl = ref('')

  const isEditBookmarkDialogOpen = ref(false)
  const editingBookmark = ref<BookmarkNode | null>(null)
  const editTitle = ref('')
  const editUrl = ref('')

  const isEditFolderDialogOpen = ref(false)
  const editingFolder = ref<BookmarkNode | null>(null)
  const editFolderTitle = ref('')

  // 展开状态
  const originalExpandedFolders = ref<Set<string>>(new Set())
  const proposalExpandedFolders = ref<Set<string>>(new Set())

  // 清理状态
  const cleanupState = ref<CleanupState>({
    isRunning: false,
    progress: 0,
    currentStep: '',
    results: [],
    settings: {
      removeDuplicates: true,
      removeDeadLinks: true,
      removeEmptyFolders: true
    }
  })

  // 搜索状态
  const searchQuery = ref('')
  const searchResults = ref<BookmarkNode[]>([])
  const isSearching = ref(false)

  // === 计算属性 ===

  const hasUnsavedChanges = computed(() => {
    return (
      isAddNewItemDialogOpen.value ||
      isEditBookmarkDialogOpen.value ||
      isEditFolderDialogOpen.value
    )
  })

  const canPerformCleanup = computed(() => {
    return !cleanupState.value.isRunning && !isPageLoading.value
  })

  // === 核心方法 ===

  /**
   * 初始化Store
   */
  const initialize = withErrorHandling(
    async () => {
      isPageLoading.value = true
      loadingMessage.value = '正在初始化...'

      try {
        // 初始化应用服务
        await Promise.all([
          bookmarkAppService.initialize(),
          searchAppService.initialize(),
          cleanupAppService.initialize()
        ])

        // 加载初始数据
        await loadInitialData()

        logger.info('ManagementStore', '✅ 初始化完成')
      } finally {
        isPageLoading.value = false
      }
    },
    { operation: 'initialize' }
  )

  /**
   * 加载初始数据
   */
  const loadInitialData = withErrorHandling(
    async () => {
      loadingMessage.value = '正在加载书签数据...'

      // 这里可以加载一些初始数据，但具体的业务逻辑由Application层处理
      logger.info('ManagementStore', '📊 初始数据加载完成')
    },
    { operation: 'loadInitialData' }
  )

  /**
   * 执行清理操作
   */
  const performCleanup = withRetry(
    withErrorHandling(
      async () => {
        if (cleanupState.value.isRunning) return

        cleanupState.value.isRunning = true
        cleanupState.value.progress = 0
        cleanupState.value.currentStep = '开始清理...'
        cleanupState.value.results = []

        try {
          const result = await cleanupAppService.performCleanup(
            cleanupState.value.settings,
            (progress, step) => {
              cleanupState.value.progress = progress
              cleanupState.value.currentStep = step
            }
          )

          if (result.ok && result.value) {
            cleanupState.value.results = result.value
            notificationService.notifySuccess('清理完成')
          } else {
            throw new Error(result.error || '清理失败')
          }
        } finally {
          cleanupState.value.isRunning = false
        }
      },
      { operation: 'performCleanup' }
    ),
    3,
    1000
  )

  /**
   * 搜索书签
   */
  const searchBookmarks = withErrorHandling(
    async (query: string) => {
      if (!query.trim()) {
        searchResults.value = []
        return
      }

      isSearching.value = true
      searchQuery.value = query

      try {
        const result = await searchAppService.search(query, { limit: 100 })
        searchResults.value = result.map(r => r.bookmark)
      } finally {
        isSearching.value = false
      }
    },
    { operation: 'searchBookmarks' }
  )

  /**
   * 添加新书签/文件夹
   */
  const addNewItem = withErrorHandling(
    async (data: AddItemData) => {
      const result = await bookmarkAppService.createBookmark({
        title: data.title,
        url: data.url,
        parentId: data.parentId || '1' // 默认添加到书签栏
      })

      if (result.ok) {
        notificationService.notifySuccess(
          `${data.type === 'folder' ? '文件夹' : '书签'}添加成功`
        )
        closeAddNewItemDialog()
      } else {
        throw new Error(result.error || '添加失败')
      }
    },
    { operation: 'addNewItem' }
  )

  /**
   * 编辑书签
   */
  const editBookmark = withErrorHandling(
    async (data: EditBookmarkData) => {
      const result = await bookmarkAppService.updateBookmark(data.id, {
        title: data.title,
        url: data.url,
        parentId: data.parentId
      })

      if (result.ok) {
        notificationService.notifySuccess('书签更新成功')
        closeEditBookmarkDialog()
      } else {
        throw new Error(result.error || '更新失败')
      }
    },
    { operation: 'editBookmark' }
  )

  /**
   * 删除书签
   */
  const deleteBookmark = withErrorHandling(
    async (id: string) => {
      const result = await bookmarkAppService.deleteBookmark(id)

      if (result.ok) {
        notificationService.notifySuccess('书签删除成功')
      } else {
        throw new Error(result.error || '删除失败')
      }
    },
    { operation: 'deleteBookmark' }
  )

  // === 对话框控制方法 ===

  const openAddNewItemDialog = (
    type: 'folder' | 'bookmark',
    parent?: BookmarkNode
  ) => {
    addItemType.value = type
    parentFolder.value = parent || null
    newItemTitle.value = ''
    newItemUrl.value = ''
    isAddNewItemDialogOpen.value = true
  }

  const closeAddNewItemDialog = () => {
    isAddNewItemDialogOpen.value = false
    parentFolder.value = null
    newItemTitle.value = ''
    newItemUrl.value = ''
  }

  const openEditBookmarkDialog = (bookmark: BookmarkNode) => {
    editingBookmark.value = bookmark
    editTitle.value = bookmark.title
    editUrl.value = bookmark.url || ''
    isEditBookmarkDialogOpen.value = true
  }

  const closeEditBookmarkDialog = () => {
    isEditBookmarkDialogOpen.value = false
    editingBookmark.value = null
    editTitle.value = ''
    editUrl.value = ''
  }

  const openEditFolderDialog = (folder: BookmarkNode) => {
    editingFolder.value = folder
    editFolderTitle.value = folder.title
    isEditFolderDialogOpen.value = true
  }

  const closeEditFolderDialog = () => {
    isEditFolderDialogOpen.value = false
    editingFolder.value = null
    editFolderTitle.value = ''
  }

  // === 展开状态控制 ===

  const toggleFolderExpansion = (
    folderId: string,
    isOriginal: boolean = true
  ) => {
    const expandedFolders = isOriginal
      ? originalExpandedFolders
      : proposalExpandedFolders

    if (expandedFolders.value.has(folderId)) {
      expandedFolders.value.delete(folderId)
    } else {
      expandedFolders.value.add(folderId)
    }
  }

  const expandAllFolders = (isOriginal: boolean = true) => {
    const expandedFolders = isOriginal
      ? originalExpandedFolders
      : proposalExpandedFolders
    // 这里需要从Application层获取所有文件夹ID
    // 简化实现
    expandedFolders.value.clear()
  }

  const collapseAllFolders = (isOriginal: boolean = true) => {
    const expandedFolders = isOriginal
      ? originalExpandedFolders
      : proposalExpandedFolders
    expandedFolders.value.clear()
  }

  // === 清理设置控制 ===

  const updateCleanupSettings = (
    settings: Partial<CleanupState['settings']>
  ) => {
    cleanupState.value.settings = {
      ...cleanupState.value.settings,
      ...settings
    }
  }

  // === 错误处理 ===

  const handleStoreError = async (error: Error) => {
    await handleError(error, { store: 'management' })
  }

  const clearStoreErrors = () => {
    clearErrors()
  }

  // === 返回公共接口 ===

  return {
    // 错误状态
    hasError,
    userErrorMessage,

    // UI状态
    isPageLoading,
    loadingMessage,

    // 对话框状态
    isAddNewItemDialogOpen,
    addItemType,
    parentFolder,
    newItemTitle,
    newItemUrl,
    isEditBookmarkDialogOpen,
    editingBookmark,
    editTitle,
    editUrl,
    isEditFolderDialogOpen,
    editingFolder,
    editFolderTitle,

    // 展开状态
    originalExpandedFolders,
    proposalExpandedFolders,

    // 清理状态
    cleanupState,

    // 搜索状态
    searchQuery,
    searchResults,
    isSearching,

    // 计算属性
    hasUnsavedChanges,
    canPerformCleanup,

    // 核心方法
    initialize,
    loadInitialData,
    performCleanup,
    searchBookmarks,
    addNewItem,
    editBookmark,
    deleteBookmark,

    // 对话框控制
    openAddNewItemDialog,
    closeAddNewItemDialog,
    openEditBookmarkDialog,
    closeEditBookmarkDialog,
    openEditFolderDialog,
    closeEditFolderDialog,

    // 展开状态控制
    toggleFolderExpansion,
    expandAllFolders,
    collapseAllFolders,

    // 清理设置控制
    updateCleanupSettings,

    // 错误处理
    handleStoreError,
    clearStoreErrors
  }
})
