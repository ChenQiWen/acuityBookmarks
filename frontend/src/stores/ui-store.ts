/**
 * 通用UI状态管理Store
 * 管理全局UI状态，如Snackbar、对话框、加载状态等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { notify } from '@/utils/notifications'

// 类型定义
export interface SnackbarState {
  show: boolean
  text: string
  color: 'success' | 'error' | 'warning' | 'info'
  timeout: number
}

export interface DialogState {
  show: boolean
  title: string
  content: string
  confirmText: string
  cancelText: string
  onConfirm?: () => void
  onCancel?: () => void
}

export interface LoadingState {
  isLoading: boolean
  message: string
  progress: number
  total: number
}

/**
 * UI状态管理Store
 */
export const useUIStore = defineStore('ui', () => {
  // === 状态 ===

  // Snackbar状态
  const snackbar = ref<SnackbarState>({
    show: false,
    text: '',
    color: 'info',
    timeout: 2000
  })

  // 确认对话框状态
  const confirmDialog = ref<DialogState>({
    show: false,
    title: '',
    content: '',
    confirmText: '确认',
    cancelText: '取消',
    onConfirm: undefined,
    onCancel: undefined
  })

  // 全局加载状态
  const loading = ref<LoadingState>({
    isLoading: false,
    message: '加载中...',
    progress: 0,
    total: 0
  })

  // 当前页面状态
  const currentPage = ref<string>('') // 'popup', 'management', 'search', 'debug'
  const pageTitle = ref<string>('')

  // 错误状态
  const lastError = ref<string | null>(null)
  const errorCount = ref<number>(0)

  // === 计算属性 ===

  // 加载进度百分比
  const loadingPercent = computed(() => {
    if (loading.value.total === 0) return 0
    return Math.round((loading.value.progress / loading.value.total) * 100)
  })

  // 是否有活动的对话框
  const hasActiveDialog = computed(() => {
    return confirmDialog.value.show
  })

  // 是否有错误
  const hasError = computed(() => {
    return lastError.value !== null
  })

  // === 动作 ===

  /**
   * 显示Snackbar消息
   */
  function showSnackbar(
    text: string,
    color: SnackbarState['color'] = 'info',
    timeout: number = 2000
  ) {
    // 统一路由到系统通知队列
    notify(text, { level: color, timeoutMs: timeout })
    // 保持状态但不触发页面内 Toast 显示，减少DOM抖动
    snackbar.value = {
      show: false,
      text,
      color,
      timeout
    }
  }

  /**
   * 隐藏Snackbar
   */
  function hideSnackbar() {
    snackbar.value.show = false
  }

  /**
   * 显示成功消息
   */
  function showSuccess(text: string, timeout: number = 2000) {
    showSnackbar(text, 'success', timeout)
  }

  /**
   * 显示错误消息
   */
  function showError(text: string, timeout: number = 5000) {
    showSnackbar(text, 'error', timeout)
    lastError.value = text
    errorCount.value++
  }

  /**
   * 显示警告消息
   */
  function showWarning(text: string, timeout: number = 4000) {
    showSnackbar(text, 'warning', timeout)
  }

  /**
   * 显示信息消息
   */
  function showInfo(text: string, timeout: number = 2000) {
    showSnackbar(text, 'info', timeout)
  }

  /**
   * 显示确认对话框
   */
  function showConfirm(
    title: string,
    content: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText: string = '确认',
    cancelText: string = '取消'
  ) {
    confirmDialog.value = {
      show: true,
      title,
      content,
      confirmText,
      cancelText,
      onConfirm,
      onCancel
    }
  }

  /**
   * 隐藏确认对话框
   */
  function hideConfirm() {
    confirmDialog.value.show = false
    confirmDialog.value.onConfirm = undefined
    confirmDialog.value.onCancel = undefined
  }

  /**
   * 确认对话框 - 确认按钮
   */
  function confirmAction() {
    if (confirmDialog.value.onConfirm) {
      confirmDialog.value.onConfirm()
    }
    hideConfirm()
  }

  /**
   * 确认对话框 - 取消按钮
   */
  function cancelAction() {
    if (confirmDialog.value.onCancel) {
      confirmDialog.value.onCancel()
    }
    hideConfirm()
  }

  /**
   * 设置加载状态
   */
  function setLoading(
    isLoading: boolean,
    message: string = '加载中...',
    progress: number = 0,
    total: number = 0
  ) {
    loading.value = {
      isLoading,
      message,
      progress,
      total
    }
  }

  /**
   * 开始加载
   */
  function startLoading(message: string = '加载中...') {
    setLoading(true, message)
  }

  /**
   * 结束加载
   */
  function stopLoading() {
    setLoading(false)
  }

  /**
   * 更新加载进度
   */
  function updateProgress(progress: number, total: number, message?: string) {
    loading.value.progress = progress
    loading.value.total = total
    if (message) {
      loading.value.message = message
    }
  }

  /**
   * 设置当前页面
   */
  function setCurrentPage(page: string, title: string = '') {
    currentPage.value = page
    pageTitle.value = title
  }

  /**
   * 清除错误状态
   */
  function clearError() {
    lastError.value = null
  }

  /**
   * 清除所有状态
   */
  function reset() {
    hideSnackbar()
    hideConfirm()
    stopLoading()
    clearError()
  }

  // 返回公共API
  return {
    // 状态
    snackbar,
    confirmDialog,
    loading,
    currentPage,
    pageTitle,
    lastError,
    errorCount,

    // 计算属性
    loadingPercent,
    hasActiveDialog,
    hasError,

    // 动作
    showSnackbar,
    hideSnackbar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    hideConfirm,
    confirmAction,
    cancelAction,
    setLoading,
    startLoading,
    stopLoading,
    updateProgress,
    setCurrentPage,
    clearError,
    reset
  }
})
