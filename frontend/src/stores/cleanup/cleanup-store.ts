/**
 * 清理功能 Store
 *
 * 职责：
 * - 管理书签健康标签的筛选状态
 * - 维护健康扫描结果和统计
 * - 提供筛选、重置等操作给管理页面使用
 *
 * 不再包含"一键清理"执行流程。
 *
 * 🔴 Session Storage Migration:
 * - `isScanning` 已迁移到 chrome.storage.session（防止页面刷新丢失状态）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import type {
  CleanupState,
  CleanupSettings,
  CleanupProblem
} from '@/types/domain/cleanup'
import type { BookmarkNode } from '@/types/domain/bookmark'
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
import { modernStorage } from '@/infrastructure/storage/modern-storage'
import { healthScanWorkerService } from '@/services/health-scan-worker-service'
import type { HealthScanProgress } from '@/services/health-scan-worker-service'

const HEALTH_TAGS = ['404', 'duplicate', 'empty', 'invalid'] as const
export type HealthTag = (typeof HEALTH_TAGS)[number]

/**
 * Session Storage 键位常量
 */
const SESSION_KEYS = {
  IS_SCANNING: 'cleanup_is_scanning' // 🔴 迁移：健康扫描状态（会话级别）
} as const

/**
 * Local Storage 键位常量（持久化用户设置）
 */
const LOCAL_KEYS = {
  ACTIVE_FILTERS: 'cleanup_active_filters' // 🟢 迁移：活动过滤器（用户偏好）
} as const

function createLegendVisibility(): Record<'all' | HealthTag, boolean> {
  return HEALTH_TAGS.reduce(
    (acc, tag) => {
      acc[tag] = true
      return acc
    },
    { all: true } as Record<'all' | HealthTag, boolean>
  )
}

function computeDefaultDescription(tag: HealthTag, url?: string): string {
  switch (tag) {
    case '404':
      return '网络访问失败 (404/超时/证书异常)'
    case 'duplicate':
      return '该 URL 在书签中出现多次'
    case 'empty':
      return '文件夹及其子级中没有任何书签'
    case 'invalid':
      return url ? `无效的 URL：${url}` : '无效的 URL'
    default:
      return '检测到潜在健康问题'
  }
}

export const useCleanupStore = defineStore('cleanup', () => {
  // 🔴 isScanning 从 session storage 加载初始值
  const initialIsScanning = ref(false)

  // 初始化时从 session storage 读取
  modernStorage
    .getSession<boolean>(SESSION_KEYS.IS_SCANNING, false)
    .then(value => {
      initialIsScanning.value = value ?? false
      if (cleanupState.value) {
        cleanupState.value.isScanning = initialIsScanning.value
      }
    })
    .catch(err => {
      logger.warn('CleanupStore', '读取 isScanning 失败', err)
    })

  // 🟢 activeFilters 从 chrome.storage.local 加载初始值
  const initialActiveFilters = ref<HealthTag[]>([])

  // 初始化时从 local storage 读取
  modernStorage
    .getLocal<HealthTag[]>(LOCAL_KEYS.ACTIVE_FILTERS, [])
    .then(value => {
      initialActiveFilters.value = value ?? []
      if (cleanupState.value) {
        cleanupState.value.activeFilters = initialActiveFilters.value
        cleanupState.value.isFiltering = initialActiveFilters.value.length > 0
      }
      logger.debug('CleanupStore', '✅ activeFilters 已从 local storage 恢复', {
        filters: initialActiveFilters.value
      })
    })
    .catch(err => {
      logger.warn('CleanupStore', '读取 activeFilters 失败', err)
    })

  const cleanupState = ref<CleanupState>({
    isFiltering: false,
    activeFilters: initialActiveFilters.value, // 从 local storage 初始化
    isScanning: initialIsScanning.value, // 从 session storage 初始化
    tasks: [],
    filterResults: new Map(),
    legendVisibility: createLegendVisibility(),
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
        ignoreBookmarksBar: false,
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

  const isScanning = computed(() => cleanupState.value.isScanning)
  const activeFilters = computed(() => cleanupState.value.activeFilters)

  const totalIssuesFound = computed(() => {
    let total = 0
    cleanupState.value.filterResults.forEach((problems: CleanupProblem[]) => {
      total += problems.length
    })
    return total
  })

  const hasActiveFilter = computed(
    () => cleanupState.value.activeFilters.length > 0
  )

  const problemNodeIds = computed(() =>
    Array.from(cleanupState.value.filterResults.keys())
  )

  function initializeCleanupState(): void {
    cleanupState.value.filterResults.clear()
    cleanupState.value.tasks = []
    cleanupState.value.isScanning = false
    cleanupState.value.activeFilters = []
    logger.info('CleanupStore', '已重置清理状态')
    // 🟢 保存空的过滤器状态
    saveActiveFilters().catch(err => {
      logger.warn('CleanupStore', '保存空过滤器失败', err)
    })
  }

  /**
   * 🔴 设置扫描状态（同步到 session storage）
   */
  async function setIsScanning(scanning: boolean): Promise<void> {
    cleanupState.value.isScanning = scanning
    try {
      await modernStorage.setSession(SESSION_KEYS.IS_SCANNING, scanning)
      logger.debug('CleanupStore', `isScanning 已更新: ${scanning}`)
    } catch (error) {
      logger.error('CleanupStore', '设置 isScanning 失败', error)
    }
  }

  /**
   * 🟢 保存活动过滤器到 chrome.storage.local（用户偏好）
   */
  async function saveActiveFilters(): Promise<void> {
    try {
      await modernStorage.setLocal(
        LOCAL_KEYS.ACTIVE_FILTERS,
        cleanupState.value.activeFilters
      )
      logger.debug(
        'CleanupStore',
        `activeFilters 已保存: ${cleanupState.value.activeFilters.join(', ')}`
      )
    } catch (error) {
      logger.warn('CleanupStore', '保存 activeFilters 失败', error)
    }
  }

  async function refreshHealthFromIndexedDB(options?: {
    /**
     * 是否静默刷新，静默模式不会展示前端扫描提示
     */
    silent?: boolean
  }): Promise<void> {
    const enableIndicator = !options?.silent
    if (enableIndicator) {
      await setIsScanning(true) // 🔴 使用新方法
    }
    try {
      const bookmarks = await bookmarkSyncService.getAllBookmarks()
      const results = new Map<string, CleanupProblem[]>()

      bookmarks.forEach(record => {
        if (!record.healthTags || record.healthTags.length === 0) return

        const problems: CleanupProblem[] = record.healthTags.map(tag => {
          const metadataEntry = record.healthMetadata?.find(
            entry => entry?.tag === tag
          )

          return {
            type: tag as CleanupProblem['type'],
            severity: tag === '404' ? 'high' : 'medium',
            description:
              metadataEntry?.notes ??
              computeDefaultDescription(tag as HealthTag, record.url),
            canAutoFix: false,
            bookmarkId: record.id,
            relatedNodeIds: undefined
          }
        })

        results.set(record.id, problems)
      })

      cleanupState.value.filterResults = results
      logger.info('CleanupStore', '已从 IndexedDB 同步健康标签', {
        nodes: results.size
      })
    } catch (error) {
      logger.error('CleanupStore', '同步健康标签失败', error)
    } finally {
      if (enableIndicator) {
        await setIsScanning(false) // 🔴 使用新方法
      }
    }
  }

  function replaceFilterResults(results: Map<string, CleanupProblem[]>): void {
    cleanupState.value.filterResults = results
  }

  function setActiveFilters(tags: HealthTag[]): void {
    cleanupState.value.activeFilters = [...tags]
    cleanupState.value.isFiltering = tags.length > 0
    // 🟢 保存到 local storage
    saveActiveFilters().catch(err => {
      logger.warn('CleanupStore', '保存过滤器失败', err)
    })
  }

  function toggleHealthTag(tag: HealthTag): void {
    const filters = new Set(cleanupState.value.activeFilters)
    if (filters.has(tag)) {
      filters.delete(tag)
    } else {
      filters.add(tag)
    }
    cleanupState.value.activeFilters = Array.from(filters)
    cleanupState.value.isFiltering = filters.size > 0
    // 🟢 保存到 local storage
    saveActiveFilters().catch(err => {
      logger.warn('CleanupStore', '保存过滤器失败', err)
    })
  }

  function clearFilters(): void {
    cleanupState.value.activeFilters = []
    cleanupState.value.isFiltering = false
    // 🟢 保存到 local storage
    saveActiveFilters().catch(err => {
      logger.warn('CleanupStore', '清除过滤器失败', err)
    })
  }

  /**
   * 标记扫描状态
   * ⚠️ 已废弃，使用 setIsScanning()
   */
  async function markScanning(state: boolean): Promise<void> {
    await setIsScanning(state)
  }

  /**
   * 使用 Worker 启动健康度扫描（推荐）
   *
   * 优势：
   * - 不阻塞主线程，用户可以继续操作
   * - 支持进度反馈
   * - 支持取消操作
   *
   * @param options - 配置选项
   * @param options.onProgress - 进度回调函数（可选）
   * @returns Promise，扫描完成时 resolve
   */
  async function startHealthScanWorker(options?: {
    onProgress?: (progress: HealthScanProgress) => void
  }): Promise<void> {
    // 检查是否已在扫描
    if (healthScanWorkerService.isRunning()) {
      logger.warn('CleanupStore', '健康扫描已在进行中')
      return
    }

    // 设置扫描状态
    await setIsScanning(true)

    // 订阅进度更新（如果提供了回调）
    let unsubscribe: (() => void) | undefined
    if (options?.onProgress) {
      unsubscribe = healthScanWorkerService.onProgress(options.onProgress)
    }

    try {
      // 启动 Worker 扫描
      await healthScanWorkerService.startScan()

      // 扫描完成后，刷新 UI 中的数据
      await refreshHealthFromIndexedDB({ silent: true })

      logger.info('CleanupStore', '健康度扫描完成')
    } catch (error) {
      logger.error('CleanupStore', '健康度扫描失败', error)
      throw error
    } finally {
      // 清理
      await setIsScanning(false)
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }

  /**
   * 取消正在进行的健康度扫描
   */
  function cancelHealthScan(): void {
    if (healthScanWorkerService.isRunning()) {
      healthScanWorkerService.cancel()
      logger.info('CleanupStore', '已取消健康度扫描')
    }
  }

  function ensureLegendDefaults(): void {
    cleanupState.value.legendVisibility = createLegendVisibility()
  }

  function findProblemNodesByTags(tags: HealthTag[]): string[] {
    const tagSet = new Set(tags)
    const ids: string[] = []
    cleanupState.value.filterResults.forEach(
      (problems: CleanupProblem[], nodeId: string) => {
        if (
          problems.some((problem: CleanupProblem) =>
            tagSet.has(problem.type as HealthTag)
          )
        ) {
          ids.push(String(nodeId))
        }
      }
    )
    return ids
  }

  function attachNodeProblems(
    node: BookmarkNode,
    problems: CleanupProblem[]
  ): BookmarkNode {
    return {
      ...node,
      _cleanupProblems: problems
    }
  }

  function updateCleanupSettings(settings: Partial<CleanupSettings>): void {
    cleanupState.value.settings = {
      ...cleanupState.value.settings,
      ...settings
    }
  }

  function getCleanupStatistics() {
    return {
      totalIssues: totalIssuesFound.value,
      isScanning: cleanupState.value.isScanning,
      activeFilters: cleanupState.value.activeFilters
    }
  }

  return {
    cleanupState,
    isScanning,
    activeFilters,
    totalIssuesFound,
    hasActiveFilter,
    problemNodeIds,
    initializeCleanupState,
    refreshHealthFromIndexedDB,
    replaceFilterResults,
    setActiveFilters,
    toggleHealthTag,
    clearFilters,
    markScanning,
    setIsScanning, // 🔴 新增：推荐使用此方法
    startHealthScanWorker, // 🟢 新增：Worker 版本的健康扫描
    cancelHealthScan, // 🟢 新增：取消健康扫描
    ensureLegendDefaults,
    findProblemNodesByTags,
    attachNodeProblems,
    updateCleanupSettings,
    getCleanupStatistics
  }
})
