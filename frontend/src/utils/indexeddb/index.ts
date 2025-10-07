/**
 * 统一IndexedDB架构模块导出
 * 新的统一架构导出
 */

// 统一数据架构
export type {
  BookmarkRecord,
  GlobalStats,
  AppSettings,
  SearchHistoryRecord,
  FaviconCacheRecord,
  DatabaseHealth,
  DatabaseStats,
  SearchOptions,
  SearchResult,
  BatchOptions
} from '../indexeddb-schema'

// 核心管理器
export { IndexedDBManager } from '../indexeddb-manager'

// 数据预处理器
export { BookmarkPreprocessor } from '../bookmark-preprocessor'

// 统一API（已逐步下线，改用应用服务与 Store）

// 应用初始化器
export { AppInitializer, appInitializer } from '../app-initializer'
export type {
  InitializationResult,
  InitializationOptions
} from '../app-initializer'

// Pinia Store - IndexedDB版本
export { usePopupStoreIndexedDB } from '../../stores/popup-store-indexeddb'

/**
 * 便捷的初始化函数
 * 用于快速设置新的统一架构
 */
export async function initializeUnifiedArchitecture(options?: {
  onProgress?: (step: string, progress: number) => void
}) {
  const { appInitializer } = await import('../app-initializer')

  return await appInitializer.initialize({
    onInitProgress: options?.onProgress
  })
}
