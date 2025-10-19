/**
 * 清理功能 Store
 *
 * 职责：
 * - 管理书签清理功能的全局状态
 * - 处理重复检测、死链检测、空文件夹检测等
 * - 管理清理任务的执行和进度
 * - 维护清理设置和过滤器配置
 *
 * 功能：
 * - 404 链接检测
 * - 重复书签检测
 * - 空文件夹检测
 * - 无效 URL 格式检测
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import type { CleanupState, CleanupSettings } from '@/types/cleanup'

/**
 * 定义清理 Store
 */
export const useCleanupStore = defineStore('cleanup', () => {
  // === 清理状态 ===
  /** 清理功能的主状态对象 */
  const cleanupState = ref<CleanupState>({
    isFiltering: false,
    activeFilters: [],
    isScanning: false,
    tasks: [],
    filterResults: new Map(),
    legendVisibility: {
      all: true,
      '404': true,
      duplicate: true,
      empty: true,
      invalid: true
    },
    showSettings: false,
    settingsTab: 'general',
    settings: {
      '404': {
        timeout: 5000,
        skipHttps: false,
        followRedirects: true,
        userAgent: 'Mozilla/5.0 (compatible; AcuityBookmarks/1.0)',
        ignoreCors: false
      },
      duplicate: {
        compareUrl: true,
        compareTitle: true,
        titleSimilarity: 0.8,
        ignoreDomain: false,
        keepNewest: 'newest'
      },
      empty: {
        recursive: true,
        preserveStructure: false,
        minDepth: 1
      },
      invalid: {
        checkProtocol: true,
        checkDomain: true,
        allowLocalhost: true,
        customPatterns: ''
      }
    }
  })

  // === 执行状态 ===
  const isExecutingPlan = ref(false)
  const executionProgress = ref(0)
  const executionResults = ref({
    removed: 0,
    bookmarks: 0,
    folders: 0,
    notFound: 0
  })

  // === 计算属性 ===

  /**
   * 是否有清理结果
   */
  const hasCleanupResults = computed(() => {
    return cleanupState.value.filterResults.size > 0
  })

  /**
   * 发现的问题总数
   */
  const totalIssuesFound = computed(() => {
    let total = 0
    cleanupState.value.filterResults.forEach(problems => {
      total += problems.length
    })
    return total
  })

  /**
   * 清理进度百分比
   */
  const cleanupProgress = computed(() => {
    if (cleanupState.value.isScanning) {
      return executionProgress.value
    }
    return 0
  })

  // === Actions ===

  /**
   * 初始化清理状态
   *
   * 重置所有清理相关的状态到初始值
   */
  const initializeCleanupState = async () => {
    try {
      cleanupState.value.filterResults.clear()
      cleanupState.value.isScanning = false
      cleanupState.value.tasks = []

      logger.info('Cleanup', '清理状态初始化完成')
    } catch (error) {
      logger.error('Cleanup', '初始化清理状态失败', error)
      throw error
    }
  }

  /**
   * 开始清理扫描
   */
  const startCleanupScan = async () => {
    try {
      cleanupState.value.isScanning = true
      executionProgress.value = 0

      // 模拟扫描过程

      // 这里应该调用实际的扫描服务
      // const results = await cleanupAppService.scanForIssues(cleanupState.value.settings, progressCallback)

      cleanupState.value.isScanning = false
      executionProgress.value = 100

      logger.info('Cleanup', '清理扫描完成')
    } catch (error) {
      cleanupState.value.isScanning = false
      logger.error('Cleanup', '清理扫描失败', error)
      throw error
    }
  }

  /**
   * 执行清理计划
   */
  const executeCleanupPlan = async () => {
    try {
      isExecutingPlan.value = true
      executionProgress.value = 0
      executionResults.value = {
        removed: 0,
        bookmarks: 0,
        folders: 0,
        notFound: 0
      }

      // 模拟执行过程

      // 这里应该调用实际的清理执行服务
      // await cleanupAppService.executeCleanupPlan(cleanupState.value.filterResults, cleanupState.value.settings, progressCallback)

      isExecutingPlan.value = false
      executionProgress.value = 100

      logger.info('Cleanup', '清理计划执行完成', executionResults.value)
    } catch (error) {
      isExecutingPlan.value = false
      logger.error('Cleanup', '执行清理计划失败', error)
      throw error
    }
  }

  /**
   * 更新清理设置
   */
  const updateCleanupSettings = (settings: Partial<CleanupSettings>) => {
    cleanupState.value.settings = {
      ...cleanupState.value.settings,
      ...settings
    }
    logger.info('Cleanup', '清理设置已更新', settings)
  }

  /**
   * 重置清理状态
   */
  const resetCleanupState = () => {
    cleanupState.value.filterResults.clear()
    cleanupState.value.isScanning = false
    cleanupState.value.tasks = []

    isExecutingPlan.value = false
    executionProgress.value = 0
    executionResults.value = {
      removed: 0,
      bookmarks: 0,
      folders: 0,
      notFound: 0
    }

    logger.info('Cleanup', '清理状态已重置')
  }

  /**
   * 获取清理统计信息
   */
  const getCleanupStatistics = () => {
    return {
      totalIssues: totalIssuesFound.value,
      isScanning: cleanupState.value.isScanning,
      hasResults: hasCleanupResults.value
    }
  }

  return {
    // State
    cleanupState,
    isExecutingPlan,
    executionProgress,
    executionResults,

    // Computed
    hasCleanupResults,
    totalIssuesFound,
    cleanupProgress,

    // Actions
    initializeCleanupState,
    startCleanupScan,
    executeCleanupPlan,
    updateCleanupSettings,
    resetCleanupState,
    getCleanupStatistics
  }
})
