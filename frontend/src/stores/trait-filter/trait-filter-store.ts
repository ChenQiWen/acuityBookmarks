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
import { scheduleFullTraitRebuild } from '@/services/bookmark-trait-service'
import { bookmarkTraitQueryService } from '@/domain/bookmark/bookmark-trait-query-service'
import { useTraitDataStore } from '@/stores/trait-data-store'
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
    isDetecting: initialIsDetecting.value
  })
  
  // ✅ 使用 TraitDataStore 获取统计数据（单一数据源）
  const traitDataStore = useTraitDataStore()
  
  // 确保 TraitDataStore 已初始化
  if (!traitDataStore.isInitialized) {
    traitDataStore.initialize()
  }
  
  // 统计数据从 TraitDataStore 获取
  const statistics = computed(() => traitDataStore.statistics)

  const isDetecting = computed(() => state.value.isDetecting)
  const activeFilters = computed(() => state.value.activeFilters)
  const hasActiveFilter = computed(() => state.value.activeFilters.length > 0)
  const filterResultIds = computed(() => Array.from(state.value.filterResults.keys()))
  
  // ✅ 导出统计数据（从 TraitDataStore 获取）
  const statisticsExport = computed(() => statistics.value)

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
   * 
   * @deprecated 使用 TraitDataStore.refresh() 替代
   * 保留此方法仅为向后兼容
   */
  async function refreshStatistics(): Promise<void> {
    await traitDataStore.refresh(true)
  }

  /**
   * 启动特征检测
   * 
   * ✅ 使用新的特征检测服务（bookmark-trait-service）
   * ✅ 特征检测在后台异步执行，不阻塞 UI
   * ✅ 统计数据由 TraitDataStore 自动刷新
   */
  async function startTraitDetection(): Promise<void> {
    try {
      // 触发全量特征重建（异步，不阻塞）
      scheduleFullTraitRebuild('user-manual-trigger')

      logger.info('TraitFilterStore', '特征检测已触发（后台执行）')

      // 如果有激活的筛选器，重新应用
      if (state.value.activeFilters.length > 0) {
        // 等待一小段时间，让特征检测开始执行
        await new Promise(resolve => setTimeout(resolve, 500))
        await applyFilters()
      }
    } catch (error) {
      logger.error('TraitFilterStore', '特征检测失败', error)
      throw error
    }
  }

  /**
   * 取消正在进行的特征检测
   * 
   * ✅ 新的特征检测服务使用调度队列，无需手动取消
   */
  function cancelTraitDetection(): void {
    logger.info('TraitFilterStore', '特征检测使用调度队列，无需手动取消')
  }

  /**
   * 初始化（加载统计）
   */
  async function initialize(): Promise<void> {
    // ✅ 统计数据由 TraitDataStore 自动管理，无需手动刷新
    if (state.value.activeFilters.length > 0) {
      await applyFilters()
    }
    
    // ✅ 设置自动刷新监听器
    setupAutoRefreshListener()
  }
  
  /**
   * 设置自动刷新监听器
   * 
   * 监听特征更新消息，自动刷新筛选结果
   * 
   * 注意：统计数据由 TraitDataStore 自动刷新，无需在此处理
   */
  function setupAutoRefreshListener(): void {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'acuity-bookmarks-trait-updated') {
        logger.info('TraitFilterStore', '🏷️ 收到特征更新消息，重新应用筛选')
        
        // 如果有激活的筛选器，重新应用
        if (state.value.activeFilters.length > 0) {
          applyFilters().catch(err => {
            logger.error('TraitFilterStore', '重新应用筛选失败', err)
          })
        }
      }
    })
    
    logger.info('TraitFilterStore', '✅ 自动刷新监听器已设置')
  }

  return {
    // 状态
    state,
    isDetecting,
    activeFilters,
    hasActiveFilter,
    filterResultIds,
    statistics: statisticsExport, // ✅ 从 TraitDataStore 获取

    // 方法
    toggleTrait,
    setActiveFilters,
    clearFilters,
    applyFilters,
    refreshStatistics, // @deprecated 保留向后兼容
    startTraitDetection,
    cancelTraitDetection,
    initialize
  }
})
