/**
 * UI 状态管理 Store（精简版）
 *
 * 职责：
 * - 仅管理UI相关状态
 * - 提供UI状态控制方法
 * - 统一错误处理
 *
 * 移除的职责：
 * - 业务逻辑（迁移到Application层）
 * - 数据管理（由专门的Data Store处理）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import {
  useErrorHandling,
  withErrorHandling
} from '@/infrastructure/error-handling'
import type {
  SimpleToastState as ToastState,
  SimpleLoadingState as LoadingState,
  SimpleThemeState as ThemeState,
  SimpleLayoutState as LayoutState
} from '@/types/ui/store'

// === 类型定义 (已从 @/types 导入) ===

// === Store 定义 ===

export const useUIStore = defineStore('ui', () => {
  // === 错误处理 ===
  const { handleError, clearErrors, hasError, userErrorMessage } =
    useErrorHandling()

  // === UI 状态 ===

  // Toast 状态
  const toast = ref<ToastState>({
    show: false,
    message: '',
    type: 'info',
    duration: 3000
  })

  // 加载状态
  const loading = ref<LoadingState>({
    isGlobalLoading: false,
    loadingMessage: '',
    loadingProgress: 0
  })

  // 主题状态
  const theme = ref<ThemeState>({
    isDark: false,
    primaryColor: '#1976d2',
    accentColor: '#ff4081'
  })

  // 布局状态
  const layout = ref<LayoutState>({
    sidebarCollapsed: false,
    sidebarWidth: 280,
    mainContentWidth: 0
  })

  // 对话框状态
  const dialogs = ref({
    settings: false,
    about: false,
    help: false,
    confirm: false
  })

  // 确认对话框状态
  const confirmDialog = ref({
    show: false,
    title: '',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
    onConfirm: null as (() => void) | null,
    onCancel: null as (() => void) | null
  })

  // === 计算属性 ===

  const isAnyDialogOpen = computed(() => {
    return (
      Object.values(dialogs.value).some(open => open) ||
      confirmDialog.value.show
    )
  })

  const isAnyLoading = computed(() => {
    return loading.value.isGlobalLoading
  })

  const sidebarWidth = computed(() => {
    return layout.value.sidebarCollapsed ? 0 : layout.value.sidebarWidth
  })

  // === 核心方法 ===

  /**
   * 初始化UI Store
   */
  const initialize = withErrorHandling(
    async () => {
      logger.info('UIStore', '🚀 初始化UI状态...')

      // 从本地存储恢复状态
      await restoreStateFromStorage()

      // 设置主题
      applyTheme()

      logger.info('UIStore', '✅ UI状态初始化完成')
    },
    { operation: 'initialize' }
  )

  /**
   * 从本地存储恢复状态
   */
  const restoreStateFromStorage = withErrorHandling(
    async () => {
      try {
        const savedTheme = localStorage.getItem('ui-theme')
        if (savedTheme) {
          theme.value = { ...theme.value, ...JSON.parse(savedTheme) }
        }

        const savedLayout = localStorage.getItem('ui-layout')
        if (savedLayout) {
          layout.value = { ...layout.value, ...JSON.parse(savedLayout) }
        }
      } catch (error) {
        logger.warn('UIStore', '恢复状态失败', error)
      }
    },
    { operation: 'restoreStateFromStorage' }
  )

  /**
   * 保存状态到本地存储
   */
  const saveStateToStorage = withErrorHandling(
    async () => {
      try {
        localStorage.setItem('ui-theme', JSON.stringify(theme.value))
        localStorage.setItem('ui-layout', JSON.stringify(layout.value))
      } catch (error) {
        logger.warn('UIStore', '保存状态失败', error)
      }
    },
    { operation: 'saveStateToStorage' }
  )

  // === Toast 控制 ===

  const showToast = (
    message: string,
    type: ToastState['type'] = 'info',
    duration = 3000
  ) => {
    toast.value = {
      show: true,
      message,
      type,
      duration
    }

    // 自动隐藏
    setTimeout(() => {
      hideToast()
    }, duration)
  }

  const hideToast = () => {
    toast.value.show = false
  }

  const showSuccessToast = (message: string, duration = 3000) => {
    showToast(message, 'success', duration)
  }

  const showErrorToast = (message: string, duration = 5000) => {
    showToast(message, 'error', duration)
  }

  const showWarningToast = (message: string, duration = 4000) => {
    showToast(message, 'warning', duration)
  }

  const showInfoToast = (message: string, duration = 3000) => {
    showToast(message, 'info', duration)
  }

  // === 加载状态控制 ===

  const showLoading = (message: string = '加载中...', progress = 0) => {
    loading.value = {
      isGlobalLoading: true,
      loadingMessage: message,
      loadingProgress: progress
    }
  }

  const hideLoading = () => {
    loading.value.isGlobalLoading = false
    loading.value.loadingMessage = ''
    loading.value.loadingProgress = 0
  }

  const updateLoadingProgress = (progress: number, message?: string) => {
    loading.value.loadingProgress = Math.min(100, Math.max(0, progress))
    if (message) {
      loading.value.loadingMessage = message
    }
  }

  // === 主题控制 ===

  const toggleTheme = () => {
    theme.value.isDark = !theme.value.isDark
    applyTheme()
    saveStateToStorage()
  }

  const setTheme = (isDark: boolean) => {
    theme.value.isDark = isDark
    applyTheme()
    saveStateToStorage()
  }

  const setPrimaryColor = (color: string) => {
    theme.value.primaryColor = color
    applyTheme()
    saveStateToStorage()
  }

  const setAccentColor = (color: string) => {
    theme.value.accentColor = color
    applyTheme()
    saveStateToStorage()
  }

  const applyTheme = () => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme.value.isDark ? 'dark' : 'light')
    root.style.setProperty('--primary-color', theme.value.primaryColor)
    root.style.setProperty('--accent-color', theme.value.accentColor)
  }

  // === 布局控制 ===

  const toggleSidebar = () => {
    layout.value.sidebarCollapsed = !layout.value.sidebarCollapsed
    saveStateToStorage()
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    layout.value.sidebarCollapsed = collapsed
    saveStateToStorage()
  }

  const setSidebarWidth = (width: number) => {
    layout.value.sidebarWidth = Math.max(200, Math.min(400, width))
    saveStateToStorage()
  }

  const updateMainContentWidth = (width: number) => {
    layout.value.mainContentWidth = width
  }

  // === 对话框控制 ===

  const openDialog = (dialogName: keyof typeof dialogs.value) => {
    dialogs.value[dialogName] = true
  }

  const closeDialog = (dialogName: keyof typeof dialogs.value) => {
    dialogs.value[dialogName] = false
  }

  const closeAllDialogs = () => {
    Object.keys(dialogs.value).forEach(key => {
      dialogs.value[key as keyof typeof dialogs.value] = false
    })
    confirmDialog.value.show = false
  }

  // === 确认对话框控制 ===

  const showConfirmDialog = (options: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
  }) => {
    confirmDialog.value = {
      show: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      onConfirm: options.onConfirm || null,
      onCancel: options.onCancel || null
    }
  }

  const hideConfirmDialog = () => {
    confirmDialog.value.show = false
    confirmDialog.value.onConfirm = null
    confirmDialog.value.onCancel = null
  }

  const confirmAction = () => {
    if (confirmDialog.value.onConfirm) {
      confirmDialog.value.onConfirm()
    }
    hideConfirmDialog()
  }

  const cancelAction = () => {
    if (confirmDialog.value.onCancel) {
      confirmDialog.value.onCancel()
    }
    hideConfirmDialog()
  }

  // === 错误处理 ===

  const handleStoreError = async (error: Error) => {
    await handleError(error, { store: 'ui' })
  }

  const clearStoreErrors = () => {
    clearErrors()
  }

  // === 返回公共接口 ===

  return {
    // 错误状态
    hasError,
    userErrorMessage,

    // 状态
    toast,
    loading,
    theme,
    layout,
    dialogs,
    confirmDialog,

    // 计算属性
    isAnyDialogOpen,
    isAnyLoading,
    sidebarWidth,

    // 核心方法
    initialize,
    restoreStateFromStorage,
    saveStateToStorage,

    // Toast 控制
    showToast,
    hideToast,
    showSuccessToast,
    showErrorToast,
    showWarningToast,
    showInfoToast,

    // 加载状态控制
    showLoading,
    hideLoading,
    updateLoadingProgress,

    // 主题控制
    toggleTheme,
    setTheme,
    setPrimaryColor,
    setAccentColor,
    applyTheme,

    // 布局控制
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
    updateMainContentWidth,

    // 对话框控制
    openDialog,
    closeDialog,
    closeAllDialogs,

    // 确认对话框控制
    showConfirmDialog,
    hideConfirmDialog,
    confirmAction,
    cancelAction,

    // 错误处理
    handleStoreError,
    clearStoreErrors
  }
})
