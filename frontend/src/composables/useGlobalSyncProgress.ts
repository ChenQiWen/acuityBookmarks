/**
 * 全局同步进度管理 Composable
 *
 * 特点：
 * - 单例模式，所有页面共享同一个状态
 * - 自动订阅 BookmarkSyncService
 * - 错误处理和兜底方案
 * - 支持重试和强制关闭
 */

import { ref, computed } from 'vue'
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
import type { SyncProgress } from '@/types/sync-progress'
import { createInitialProgress } from '@/types/sync-progress'
import { logger } from '@/infrastructure/logging/logger'

// 🌐 全局单例状态
const globalProgress = ref<SyncProgress>(createInitialProgress())
const isVisible = ref(false)
let unsubscribe: (() => void) | null = null
let isInitialized = false

/**
 * 全局同步进度管理
 */
export function useGlobalSyncProgress() {
  /**
   * 初始化订阅（只执行一次）
   */
  function initialize() {
    if (isInitialized) {
      logger.info('GlobalSyncProgress', '已初始化，跳过')
      return
    }

    logger.info('GlobalSyncProgress', '初始化全局进度订阅')

    unsubscribe = bookmarkSyncService.onProgress(progress => {
      globalProgress.value = progress

      // 根据阶段决定是否显示
      const shouldShow =
        progress.phase !== 'completed' &&
        progress.phase !== 'failed' &&
        progress.phase !== 'timeout'

      isVisible.value = shouldShow

      // 如果进入错误或超时状态，显示对话框（用户需要手动处理）
      if (progress.phase === 'failed' || progress.phase === 'timeout') {
        isVisible.value = true
      }
    })

    isInitialized = true
  }

  /**
   * 是否处于错误状态
   */
  const isError = computed(() => {
    return (
      globalProgress.value.phase === 'failed' ||
      globalProgress.value.phase === 'timeout'
    )
  })

  /**
   * 是否可以重试
   */
  const canRetry = computed(() => {
    return isError.value && globalProgress.value.error?.canRetry === true
  })

  /**
   * 是否已完成
   */
  const isCompleted = computed(() => {
    return globalProgress.value.phase === 'completed'
  })

  /**
   * 手动关闭（仅在完成时允许）
   */
  function dismiss() {
    if (isCompleted.value) {
      isVisible.value = false
      logger.info('GlobalSyncProgress', '用户关闭了进度对话框')
    }
  }

  /**
   * 重试同步
   */
  async function retry() {
    if (!canRetry.value) {
      logger.warn('GlobalSyncProgress', '当前状态不允许重试')
      return
    }

    logger.info('GlobalSyncProgress', '用户请求重试同步')

    // 重置进度
    globalProgress.value = createInitialProgress()
    isVisible.value = true

    // 触发重新同步
    try {
      await bookmarkSyncService.syncAllBookmarks()
    } catch (error) {
      logger.error('GlobalSyncProgress', '重试同步失败', error)
    }
  }

  /**
   * 强制关闭（兜底方案，不推荐）
   *
   * 用户确认后才会关闭，因为这可能导致数据不完整
   */
  function forceClose() {
    logger.warn(
      'GlobalSyncProgress',
      '用户强制关闭了同步进度条，数据可能不完整'
    )
    isVisible.value = false
  }

  /**
   * 清理订阅
   */
  function cleanup() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
      isInitialized = false
      logger.info('GlobalSyncProgress', '清理全局进度订阅')
    }
  }

  return {
    // 状态
    progress: globalProgress,
    isVisible,
    isError,
    canRetry,
    isCompleted,

    // 方法
    initialize,
    dismiss,
    retry,
    forceClose,
    cleanup
  }
}
