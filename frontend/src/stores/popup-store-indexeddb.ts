/**
 * Popup Store - IndexedDB版本
 * 完全基于IndexedDB，移除chrome.storage.local依赖
 * 支持十万条书签的高性能搜索
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import { healthAppService } from '@/application/health/health-app-service'
// import { getPerformanceOptimizer } from '../services/realtime-performance-optimizer'

// const performanceOptimizer = getPerformanceOptimizer()

/**
 * 书签数量统计，用于展示总书签条目。
 */
export interface BookmarkStats {
  /** 书签总数 */
  bookmarks: number
}

/**
 * 书签健康概览数据结构。
 */
export interface HealthOverview {
  /** 已扫描书签数量 */
  totalScanned: number
  /** 失效书签数量 */
  dead: number
  /** 重复书签 URL 数量 */
  duplicateCount: number
}

/**
 * 弹窗状态管理存储 - IndexedDB版本
 */
/**
 * 弹窗状态管理存储 - IndexedDB版本
 */
export const usePopupStoreIndexedDB = defineStore('popup-indexeddb', () => {
  // ==================== 状态 ====================

  // 统一书签API
  // const bookmarkAPI = popupAPI - 已通过导入可用

  // 加载状态
  /** 当前是否处于加载数据状态 */
  const isLoading = ref(false)
  /** 最近一次操作的错误消息 */
  const lastError = ref<string | null>(null)

  // 当前标签页信息
  /** 当前激活标签页 URL */
  const currentTabUrl = ref('')
  /** 当前激活标签页标题 */
  const currentTabTitle = ref('')
  /** 当前激活标签页 ID */
  const currentTabId = ref<number | null>(null)

  // 书签统计
  /** 书签统计信息 */
  const stats = ref<BookmarkStats>({
    bookmarks: 0
  })

  // 书签健康度概览
  /** 书签健康概览信息 */
  const healthOverview = ref<HealthOverview>({
    totalScanned: 0,
    dead: 0,
    duplicateCount: 0
  })

  // ==================== 计算属性 ====================

  /** 当前是否存在可用的激活标签页 */
  const hasCurrentTab = computed(() => {
    return currentTabId.value !== null && currentTabUrl.value.length > 0
  })

  /** 统计总条目数 */
  const totalItems = computed(() => stats.value.bookmarks)

  // ==================== 方法 ====================

  /**
   * 初始化弹窗
   *
   * @description
   * 加载当前标签页信息、统计数据，并记录性能耗时。
   */
  async function initialize(): Promise<void> {
    const startTime = performance.now()
    isLoading.value = true
    lastError.value = null

    try {
      logger.info('PopupStore', '初始化 Popup Store (IndexedDB版本) ...')

      // 1. 初始化统一API (自动完成)
      // 统一API自动初始化

      // 2. 获取当前标签页信息
      await getCurrentTab()

      // 3. 加载书签统计
      await loadBookmarkStats()

      // 5. 数据更新监听 (新架构中由Service Worker处理)

      logger.info('PopupStore', '初始化完成')
    } catch (error) {
      lastError.value = `初始化失败: ${(error as Error).message}`
      logger.error('PopupStore', '初始化失败', error)
      throw error
    } finally {
      isLoading.value = false
      const endTime = performance.now()
      logger.info(
        'PopupStore',
        `初始化耗时: ${(endTime - startTime).toFixed(2)}ms`
      )
    }
  }

  /**
   * 获取当前标签页信息
   *
   * @description
   * 尝试读取正在活动的标签页 ID、URL、标题，用于后续跳转。
   */
  async function getCurrentTab(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tabs.length > 0) {
          const tab = tabs[0]
          if (tab) {
            currentTabId.value = tab.id || null
            currentTabUrl.value = tab.url || ''
            currentTabTitle.value = tab.title || ''
          }
        }
      }
    } catch (error) {
      logger.warn('PopupStore', '获取当前标签页失败', error)
    }
  }

  /**
   * 加载书签统计
   *
   * @description
   * 调用应用服务获取总书签数量，并写入响应式状态。
   * 数据更新由 background service worker 的广播机制自动触发，无需手动检查过期。
   */
  async function loadBookmarkStats(): Promise<void> {
    try {
      const globalStats = await indexedDBManager.getGlobalStats()
      if (globalStats.totalBookmarks && globalStats.totalBookmarks > 0) {
        stats.value = {
          bookmarks: globalStats.totalBookmarks
        }
        return
      }

      const res = await bookmarkAppService.getGlobalStats()
      if (res.ok && res.value) {
        const statsValue = res.value as {
          totalBookmarks: number
        }
        stats.value = {
          bookmarks: statsValue.totalBookmarks || 0
        }
      }
    } catch (error) {
      logger.warn('PopupStore', '加载书签统计失败', error)
    }
  }

  /** 健康度概览是否正在加载 */
  const isLoadingHealthOverview = ref(false)

  /**
   * 加载健康度概览
   *
   * @description
   * 调用健康服务获取 HTTP 状态统计与重复 URL 数量。
   */
  async function loadBookmarkHealthOverview(): Promise<void> {
    isLoadingHealthOverview.value = true
    try {
      const res = await healthAppService.getHealthOverview()
      if (res.ok) {
        healthOverview.value = { ...res.value }
      }
    } catch (error) {
      logger.warn('PopupStore', '加载健康度概览失败', error)
    } finally {
      isLoadingHealthOverview.value = false
    }
  }

  /**
   * 自动刷新统计数据和健康度概览
   *
   * @description
   * 当书签数据更新时自动触发，确保 UI 显示最新数据
   */
  async function autoRefreshData(): Promise<void> {
    try {
      logger.info('PopupStore', '🔄 自动刷新数据...')

      // 并行刷新统计数据和健康度概览，提高性能
      await Promise.all([loadBookmarkStats(), loadBookmarkHealthOverview()])

      logger.info('PopupStore', '✅ 自动刷新完成')
    } catch (error) {
      logger.error('PopupStore', '❌ 自动刷新失败:', error)
    }
  }

  /**
   * 监听书签数据同步消息，自动刷新统计数据
   *
   * @description
   * 监听 background service worker 广播的书签同步完成消息，
   * 自动刷新 UI 数据，无需用户手动操作
   */
  function setupAutoRefreshListener(): void {
    chrome.runtime.onMessage.addListener(message => {
      if (message.type === 'acuity-bookmarks-db-synced') {
        logger.info(
          'PopupStore',
          `📡 收到书签同步消息 (${message.eventType})，自动刷新数据`
        )

        // 使用 queueMicrotask 避免阻塞消息处理
        queueMicrotask(() => {
          void autoRefreshData()
        })
      }
    })

    logger.info('PopupStore', '✅ 自动刷新监听器已设置')
  }

  // 初始化时设置自动刷新监听器
  setupAutoRefreshListener()

  /**
   * 打开书签
   *
   * @param bookmark 需要打开的书签信息
   * @param inNewTab 是否在新标签页中打开
   */
  async function openBookmark(
    bookmark: { url?: string; domain?: string },
    inNewTab: boolean = false
  ): Promise<void> {
    if (!bookmark.url) return

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        if (inNewTab) {
          await chrome.tabs.create({ url: bookmark.url })
        } else {
          await chrome.tabs.update({ url: bookmark.url })
        }
      } else {
        // 开发环境或不支持Chrome API时
        window.open(bookmark.url, inNewTab ? '_blank' : '_self')
      }

      logger.info('PopupStore', '📊 书签已打开', {
        inNewTab,
        fromSearch: true,
        domain: bookmark.domain
      })
    } catch (error) {
      logger.error('PopupStore', '打开书签失败:', error)
    }
  }

  /**
   * 获取数据库信息（用于调试）
   *
   * @returns 书签数量等调试数据
   */
  async function getDatabaseInfo(): Promise<{
    bookmarkCount: number
    searchHistoryCount: number
    settingsCount: number
    estimatedSize: number
  }> {
    // 数据库信息现在通过统一API获取
    const res = await bookmarkAppService.getAllBookmarks()
    return {
      bookmarkCount: res.ok ? res.value?.filter(b => !!b.url).length || 0 : 0,
      searchHistoryCount: 0, // 暂时设为0
      settingsCount: 0, // 暂时设为0
      estimatedSize: 0 // 暂时设为0，可以后续实现
    }
  }

  // ==================== 监听器设置 ====================

  // ==================== 返回公共接口 ====================

  return {
    // 状态
    isLoading,
    lastError,
    currentTabUrl,
    currentTabTitle,
    currentTabId,
    stats,
    healthOverview,
    isLoadingHealthOverview,

    // 计算属性
    hasCurrentTab,
    totalItems,

    // 方法
    initialize,
    getCurrentTab,
    loadBookmarkStats,
    loadBookmarkHealthOverview,
    openBookmark,
    getDatabaseInfo
  }
})
