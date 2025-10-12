/**
 * 错误处理 Hooks
 *
 * 提供 Vue 3 Composition API 的错误处理功能
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { StoreErrorHandler } from './store-error-handler'
import {
  StoreError,
  type StoreErrorState,
  createErrorState
} from '@/core/common/store-error'

/**
 * Store 错误处理 Hook
 */
export function useStoreErrorHandling() {
  const errorHandler = StoreErrorHandler.getInstance()
  const errorState = ref<StoreErrorState>(createErrorState())

  /**
   * 处理错误
   */
  const handleError = async (
    error: Error | StoreError,
    context?: Record<string, unknown>
  ) => {
    const storeError = await errorHandler.handleError(error, context)

    // 更新错误状态
    errorState.value.lastError = storeError
    errorState.value.errorHistory.push(storeError)

    // 限制历史记录大小
    if (errorState.value.errorHistory.length > 100) {
      errorState.value.errorHistory.shift()
    }

    return storeError
  }

  /**
   * 清除错误
   */
  const clearErrors = () => {
    errorState.value.lastError = null
    errorState.value.errorHistory = []
    errorHandler.clearErrorHistory()
  }

  /**
   * 清除最后一个错误
   */
  const clearLastError = () => {
    errorState.value.lastError = null
  }

  /**
   * 获取错误历史
   */
  const getErrorHistory = () => {
    return errorState.value.errorHistory
  }

  /**
   * 获取错误统计
   */
  const getErrorStats = () => {
    return errorHandler.getErrorStats()
  }

  /**
   * 检查是否有错误
   */
  const hasError = computed(() => {
    return errorState.value.lastError !== null
  })

  /**
   * 检查是否有严重错误
   */
  const hasCriticalError = computed(() => {
    return errorState.value.lastError?.severity === 'CRITICAL'
  })

  /**
   * 获取用户友好的错误消息
   */
  const userErrorMessage = computed(() => {
    return errorState.value.lastError?.userMessage || ''
  })

  /**
   * 获取技术错误消息
   */
  const technicalErrorMessage = computed(() => {
    return errorState.value.lastError?.technicalMessage || ''
  })

  return {
    // 状态
    errorState: errorState.value,
    hasError,
    hasCriticalError,
    userErrorMessage,
    technicalErrorMessage,

    // 方法
    handleError,
    clearErrors,
    clearLastError,
    getErrorHistory,
    getErrorStats
  }
}

/**
 * 错误恢复 Hook
 */
export function useErrorRecovery() {
  const isRecovering = ref(false)
  const recoveryProgress = ref(0)
  const recoveryStrategy = ref<string | null>(null)

  /**
   * 开始恢复
   */
  const startRecovery = (strategy: string) => {
    isRecovering.value = true
    recoveryProgress.value = 0
    recoveryStrategy.value = strategy
  }

  /**
   * 更新恢复进度
   */
  const updateRecoveryProgress = (progress: number) => {
    recoveryProgress.value = Math.min(100, Math.max(0, progress))
  }

  /**
   * 完成恢复
   */
  const completeRecovery = () => {
    isRecovering.value = false
    recoveryProgress.value = 100
    recoveryStrategy.value = null
  }

  /**
   * 取消恢复
   */
  const cancelRecovery = () => {
    isRecovering.value = false
    recoveryProgress.value = 0
    recoveryStrategy.value = null
  }

  return {
    // 状态
    isRecovering,
    recoveryProgress,
    recoveryStrategy,

    // 方法
    startRecovery,
    updateRecoveryProgress,
    completeRecovery,
    cancelRecovery
  }
}

/**
 * 错误监控 Hook
 */
export function useErrorMonitoring() {
  const errorHandler = StoreErrorHandler.getInstance()
  const errorCount = ref(0)
  const lastErrorTime = ref<Date | null>(null)

  /**
   * 监控错误
   */
  const monitorError = (error: StoreError) => {
    errorCount.value++
    lastErrorTime.value = new Date()
  }

  /**
   * 获取错误趋势
   */
  const getErrorTrend = () => {
    const history = errorHandler.getErrorHistory()
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const recentErrors = history.filter(error => {
      // 这里需要根据实际的错误时间戳来过滤
      return true // 简化实现
    })

    return {
      total: history.length,
      recent: recentErrors.length,
      trend: recentErrors.length > history.length / 2 ? 'increasing' : 'stable'
    }
  }

  /**
   * 重置监控
   */
  const resetMonitoring = () => {
    errorCount.value = 0
    lastErrorTime.value = null
  }

  return {
    // 状态
    errorCount,
    lastErrorTime,

    // 方法
    monitorError,
    getErrorTrend,
    resetMonitoring
  }
}

/**
 * 组合错误处理 Hook
 * 结合错误处理、恢复和监控功能
 */
export function useErrorHandling() {
  const errorHandling = useStoreErrorHandling()
  const errorRecovery = useErrorRecovery()
  const errorMonitoring = useErrorMonitoring()

  /**
   * 增强的错误处理
   */
  const handleErrorWithRecovery = async (
    error: Error | StoreError,
    context?: Record<string, unknown>
  ) => {
    const storeError = await errorHandling.handleError(error, context)

    // 监控错误
    errorMonitoring.monitorError(storeError)

    // 根据恢复策略开始恢复
    if (storeError.recoveryStrategy === 'RETRY') {
      errorRecovery.startRecovery('retry')
    } else if (storeError.recoveryStrategy === 'FALLBACK') {
      errorRecovery.startRecovery('fallback')
    }

    return storeError
  }

  return {
    // 错误处理
    ...errorHandling,

    // 错误恢复
    ...errorRecovery,

    // 错误监控
    ...errorMonitoring,

    // 增强方法
    handleErrorWithRecovery
  }
}
