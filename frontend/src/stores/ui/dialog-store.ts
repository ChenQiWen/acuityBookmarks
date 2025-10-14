/**
 * 对话框状态 Store
 * 负责管理各种对话框的显示状态和数据
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'

export interface DialogState {
  show: boolean
  title: string
  content: string
  confirmText: string
  cancelText: string
  onConfirm?: () => void
  onCancel?: () => void
}

export interface EditBookmarkDialogState {
  isOpen: boolean
  bookmark: BookmarkNode | null
  title: string
  url: string
  parentId?: string
}

export interface EditFolderDialogState {
  isOpen: boolean
  folder: BookmarkNode | null
  title: string
}

export interface AddItemDialogState {
  isOpen: boolean
  type: 'folder' | 'bookmark'
  parentFolder: BookmarkNode | null
  title: string
  url: string
}

export const useDialogStore = defineStore('dialog', () => {
  // === 通用对话框状态 ===
  const dialogState = ref<DialogState>({
    show: false,
    title: '',
    content: '',
    confirmText: '确认',
    cancelText: '取消'
  })

  // === 编辑书签对话框 ===
  const editBookmarkDialog = ref<EditBookmarkDialogState>({
    isOpen: false,
    bookmark: null,
    title: '',
    url: '',
    parentId: undefined
  })

  // === 编辑文件夹对话框 ===
  const editFolderDialog = ref<EditFolderDialogState>({
    isOpen: false,
    folder: null,
    title: ''
  })

  // === 添加新项目对话框 ===
  const addItemDialog = ref<AddItemDialogState>({
    isOpen: false,
    type: 'bookmark',
    parentFolder: null,
    title: '',
    url: ''
  })

  // === 通用对话框 Actions ===

  /**
   * 显示确认对话框
   */
  const showConfirmDialog = (options: {
    title: string
    content: string
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
  }) => {
    dialogState.value = {
      show: true,
      title: options.title,
      content: options.content,
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel
    }

    logger.info('Dialog', '显示确认对话框', { title: options.title })
  }

  /**
   * 隐藏通用对话框
   */
  const hideDialog = () => {
    dialogState.value.show = false
    dialogState.value.onConfirm = undefined
    dialogState.value.onCancel = undefined
    logger.info('Dialog', '隐藏通用对话框')
  }

  /**
   * 确认对话框
   */
  const confirmDialog = () => {
    if (dialogState.value.onConfirm) {
      dialogState.value.onConfirm()
    }
    hideDialog()
  }

  /**
   * 取消对话框
   */
  const cancelDialog = () => {
    if (dialogState.value.onCancel) {
      dialogState.value.onCancel()
    }
    hideDialog()
  }

  // === 编辑书签对话框 Actions ===

  /**
   * 打开编辑书签对话框
   */
  const openEditBookmarkDialog = (bookmark: BookmarkNode) => {
    editBookmarkDialog.value = {
      isOpen: true,
      bookmark,
      title: bookmark.title,
      url: bookmark.url || '',
      parentId: bookmark.parentId
    }

    logger.info('Dialog', '打开编辑书签对话框', {
      id: bookmark.id,
      title: bookmark.title
    })
  }

  /**
   * 关闭编辑书签对话框
   */
  const closeEditBookmarkDialog = () => {
    editBookmarkDialog.value = {
      isOpen: false,
      bookmark: null,
      title: '',
      url: '',
      parentId: undefined
    }

    logger.info('Dialog', '关闭编辑书签对话框')
  }

  /**
   * 更新编辑书签数据
   */
  const updateEditBookmarkData = (
    data: Partial<Pick<EditBookmarkDialogState, 'title' | 'url' | 'parentId'>>
  ) => {
    if (data.title !== undefined) editBookmarkDialog.value.title = data.title
    if (data.url !== undefined) editBookmarkDialog.value.url = data.url
    if (data.parentId !== undefined)
      editBookmarkDialog.value.parentId = data.parentId
  }

  // === 编辑文件夹对话框 Actions ===

  /**
   * 打开编辑文件夹对话框
   */
  const openEditFolderDialog = (folder: BookmarkNode) => {
    editFolderDialog.value = {
      isOpen: true,
      folder,
      title: folder.title
    }

    logger.info('Dialog', '打开编辑文件夹对话框', {
      id: folder.id,
      title: folder.title
    })
  }

  /**
   * 关闭编辑文件夹对话框
   */
  const closeEditFolderDialog = () => {
    editFolderDialog.value = {
      isOpen: false,
      folder: null,
      title: ''
    }

    logger.info('Dialog', '关闭编辑文件夹对话框')
  }

  /**
   * 更新编辑文件夹数据
   */
  const updateEditFolderData = (
    data: Partial<Pick<EditFolderDialogState, 'title'>>
  ) => {
    if (data.title !== undefined) editFolderDialog.value.title = data.title
  }

  // === 添加新项目对话框 Actions ===

  /**
   * 打开添加新项目对话框
   */
  const openAddItemDialog = (
    type: 'folder' | 'bookmark',
    parentFolder?: BookmarkNode
  ) => {
    addItemDialog.value = {
      isOpen: true,
      type,
      parentFolder: parentFolder || null,
      title: '',
      url: ''
    }

    logger.info('Dialog', '打开添加新项目对话框', {
      type,
      parentId: parentFolder?.id
    })
  }

  /**
   * 关闭添加新项目对话框
   */
  const closeAddItemDialog = () => {
    addItemDialog.value = {
      isOpen: false,
      type: 'bookmark',
      parentFolder: null,
      title: '',
      url: ''
    }

    logger.info('Dialog', '关闭添加新项目对话框')
  }

  /**
   * 更新添加新项目数据
   */
  const updateAddItemData = (
    data: Partial<
      Pick<AddItemDialogState, 'type' | 'title' | 'url' | 'parentFolder'>
    >
  ) => {
    if (data.type !== undefined) addItemDialog.value.type = data.type
    if (data.title !== undefined) addItemDialog.value.title = data.title
    if (data.url !== undefined) addItemDialog.value.url = data.url
    if (data.parentFolder !== undefined)
      addItemDialog.value.parentFolder = data.parentFolder
  }

  // === 批量操作 Actions ===

  /**
   * 关闭所有对话框
   */
  const closeAllDialogs = () => {
    hideDialog()
    closeEditBookmarkDialog()
    closeEditFolderDialog()
    closeAddItemDialog()
    logger.info('Dialog', '关闭所有对话框')
  }

  /**
   * 重置所有对话框状态
   */
  const resetAllDialogs = () => {
    dialogState.value = {
      show: false,
      title: '',
      content: '',
      confirmText: '确认',
      cancelText: '取消'
    }

    editBookmarkDialog.value = {
      isOpen: false,
      bookmark: null,
      title: '',
      url: '',
      parentId: undefined
    }

    editFolderDialog.value = {
      isOpen: false,
      folder: null,
      title: ''
    }

    addItemDialog.value = {
      isOpen: false,
      type: 'bookmark',
      parentFolder: null,
      title: '',
      url: ''
    }

    logger.info('Dialog', '重置所有对话框状态')
  }

  return {
    // State
    dialogState,
    editBookmarkDialog,
    editFolderDialog,
    addItemDialog,

    // General Dialog Actions
    showConfirmDialog,
    hideDialog,
    confirmDialog,
    cancelDialog,

    // Edit Bookmark Dialog Actions
    openEditBookmarkDialog,
    closeEditBookmarkDialog,
    updateEditBookmarkData,

    // Edit Folder Dialog Actions
    openEditFolderDialog,
    closeEditFolderDialog,
    updateEditFolderData,

    // Add Item Dialog Actions
    openAddItemDialog,
    closeAddItemDialog,
    updateAddItemData,

    // Batch Actions
    closeAllDialogs,
    resetAllDialogs
  }
})
