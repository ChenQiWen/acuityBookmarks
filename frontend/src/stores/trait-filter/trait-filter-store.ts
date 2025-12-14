/**
 * 特征筛选 Store
 *
 * 职责：
 * - 管理书签特征的筛选状态
 * - 维护特征检测结果和统计
 * - 提供筛选、重置等操作
 *
 * 设计原则：
 * - 只负责筛选，不负责删除/清理
 * - 用户自行决定如何处理筛选结果
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { modernStorage } from '@/infrastructure/storage/modern-storage'
import { traitDetectionService } from '@/services/trait-detection-service'
import type { TraitDetectionProgress } from '@/services/trait-detection-service'
import { bookmarkTraitQueryService } from '@/domain/bookmark/bookmark-trait-query-service'
import type { TraitTag } from '@/infrastructure/indexeddb/types/bookmark-record'

/**
 * Session Storage 键位常量
 */
const SESSION_KEYS = {
  IS_DETECTING: 'trait_is_detecting'
} as const

/**
 * Local Storage 键位常量（持久化用户设置）
 */
const LOCAL_KEYS = {
  ACTIVE_FILTERS: 'trait_active_filters'
} as const

/**
 * 特征筛选状态
 */
interface TraitFilterState {
  /** 当前激活的筛选器 */
  activeFilters: TraitTag[]
  /** 筛选结果（书签ID → 特征列表） */
  filterResults: Map<string, TraitTag[]>
  /** 是否正在检测 */
  isDetecting: boolean
  /** 特征统计 */
  statistics: {
    duplicate: number
    invalid: number
    internal: number
  }
}

export const useTraitFilterStore = defineStore('traitFilter', () => {
  // 初始化状态
  const initialIsDetecting = ref(false)
  const initialActiveFilters = ref<TraitTag[]>([])

  // 页面刷新后自动重置检测状态
  modernStorage
    .setSession(SESSION_KEYS.IS_DETECTING, false)
    .then(() => {
      initialIsDetecting.value = false
      if (state.value) {
        state.value.isDetecting = false
      }
      logger.debug('TraitFilterStore', '已重置 isDetecting 状态')
    })
    .catch(err => {
      logger.warn('TraitFilterStore', '重置 isDetecting 失败', err)
    })

  // 从 local storage 读取活动筛选器
  modernStorage
    .getLocal<TraitTag[]>(LOCAL_KEYS.ACTIVE_FILTERS, [])
    .then(value => {
      initialActiveFilters.value = value ?? []
      if (state.value) {
        state.value.activeFilters = initialActiveFilters.value
      }
      logger.debug('TraitFilterStore', '✅ activeFilters 已从 local storage 恢复', {
        filters: initialActiveFilters.value
      })
    })
    .catch(err => {
      logger.warn('TraitFilterStore', '读取 activeFilters 失败', err)
    })

  const state = ref<TraitFilterState>({
    activeFilters: initialActiveFilters.value,
    filterResults: new Map(),
    isDetecting: initialIsDetecting.value,
    statistics: {
      duplicate: 0,
      invalid: 0,
      internal: 0
    }
  })

  const isDetecting = computed(() => state.value.isDetecting)
  const activeFilters = computed(() => state.value.activeFilters)
  const hasActiveFilter = computed(() => state.value.activeFilters.length > 0)
  const filterResultIds = computed(() => Array.from(state.value.filterResults.keys()))

  /**
   * 设置检测状态（同步到 session storage）
   */
  async function setIsDetecting(detecting: boolean): Promise<void> {
    state.value.isDetecting = detecting
    try {
      await modernStorage.setSession(SESSION_KEYS.IS_DETECTING, detecting)
      logger.debug('TraitFilterStore', `isDetecting 已更新: ${detecting}`)
    } catch (error) {
      logger.error('TraitFilterStore', '设置 isDetecting 失败', error)
    }
  }

  /**
   * 保存活动筛选器到 chrome.storage.local（用户偏好）
   */
  async function saveActiveFilters(): Promise<void> {
    try {
      await modernStorage.setLocal(
        LOCAL_KEYS.ACTIVE_FILTERS,
        state.value.activeFilters
      )
      logger.debug(
        'TraitFilterStore',
        `activeFilters 已保存: ${state.value.activeFilters.join(', ')}`
      )
    } catch (error) {
      logger.warn('TraitFilterStore', '保存 activeFilters 失败', error)
    }
  }

  /**
   * 切换特征筛选
   */
  function toggleTrait(trait: TraitTag): void {
    const index = state.value.activeFilters.indexOf(trait)
    if (index > -1) {
      state.value.activeFilters.splice(index, 1)
    } else {
      state.value.activeFilters.push(trait)
    }

    // 保存到 local storage
    saveActiveFilters().catch(err => {
      logger.warn('TraitFilterStore', '保存筛选器失败', err)
    })

    // 重新应用筛选
    applyFilters().catch(err => {
      logger.error('TraitFilterStore', '应用筛选失败', err)
    })
  }

  /**
   * 设置活动筛选器
   */
  function setActiveFilters(traits: TraitTag[]): void {
    state.value.activeFilters = [...traits]

    // 保存到 local storage
    saveActiveFilters().catch(err => {
      logger.warn('TraitFilterStore', '保存筛选器失败', err)
    })

    // 重新应用筛选
    applyFilters().catch(err => {
      logger.error('TraitFilterStore', '应用筛选失败', err)
    })
  }

  /**
   * 清除所有筛选器
   */
  function clearFilters(): void {
    state.value.activeFilters = []
    state.value.filterResults.clear()

    // 保存到 local storage
    saveActiveFilters().catch(err => {
      logger.warn('TraitFilterStore', '清除筛选器失败', err)
    })
  }

  /**
   * 应用筛选（不删除，只筛选）
   */
  async function applyFilters(): Promise<void> {
    if (state.value.activeFilters.length === 0) {
      state.value.filterResults.clear()
      return
    }

    try {
      // 使用 bookmarkTraitQueryService 查询
      const result = await bookmarkTraitQueryService.queryByTraits(
        state.value.activeFilters,
        { includeFullRecord: true }
      )

      // 更新筛选结果
      const newResults = new Map<string, TraitTag[]>()
      result.records?.forEach(record => {
        newResults.set(record.id, (record.traitTags || []) as TraitTag[])
      })
      state.value.filterResults = newResults

      logger.debug('TraitFilterStore', '筛选完成', {
        filters: state.value.activeFilters,
        results: newResults.size
      })
    } catch (error) {
      logger.error('TraitFilterStore', '筛选失败', error)
    }
  }

  /**
   * 刷新特征统计
   */
  async function refreshStatistics(): Promise<void> {
    try {
      const stats = await bookmarkTraitQueryService.getTraitStatistics()
      state.value.statistics = stats
      logger.debug('TraitFilterStore', '统计已更新', stats)
    } catch (error) {
      logger.error('TraitFilterStore', '刷新统计失败', error)
    }
  }

  /**
   * 使用 Worker 启动特征检测
   *
   * @param options - 配置选项
   * @param options.onProgress - 进度回调函数（可选）
   * @returns Promise，检测完成时 resolve
   */
  async function startTraitDetection(options?: {
    onProgress?: (progress: TraitDetectionProgress) => void
  }): Promise<void> {
    // 检查是否已在检测
    if (traitDetectionService.isRunning()) {
      logger.warn('TraitFilterStore', '特征检测已在进行中')
      return
    }

    // 设置检测状态
    await setIsDetecting(true)

    // 订阅进度更新（如果提供了回调）
    let unsubscribe: (() => void) | undefined
    if (options?.onProgress) {
      unsubscribe = traitDetectionService.onProgress(options.onProgress)
    }

    try {
      // 启动 Worker 检测
      await traitDetectionService.startDetection()

      // 检测完成后，刷新统计和筛选结果
      await refreshStatistics()
      if (state.value.activeFilters.length > 0) {
        await applyFilters()
      }

      logger.info('TraitFilterStore', '特征检测完成')
    } catch (error) {
      logger.error('TraitFilterStore', '特征检测失败', error)
      throw error
    } finally {
      // 清理
      await setIsDetecting(false)
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }

  /**
   * 取消正在进行的特征检测
   */
  function cancelTraitDetection(): void {
    if (traitDetectionService.isRunning()) {
      traitDetectionService.cancel()
      logger.info('TraitFilterStore', '已取消特征检测')
    }
  }

  /**
   * 初始化（加载统计）
   */
  async function initialize(): Promise<void> {
    await refreshStatistics()
    if (state.value.activeFilters.length > 0) {
      await applyFilters()
    }
  }

  return {
    // 状态
    state,
    isDetecting,
    activeFilters,
    hasActiveFilter,
    filterResultIds,

    // 方法
    toggleTrait,
    setActiveFilters,
    clearFilters,
    applyFilters,
    refreshStatistics,
    startTraitDetection,
    cancelTraitDetection,
    initialize
  }
})
