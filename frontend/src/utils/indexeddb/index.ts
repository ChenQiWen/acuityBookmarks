/**
 * IndexedDB架构模块导出
 * 统一导出所有IndexedDB相关的类和接口
 */

// 核心IndexedDB操作
export { IndexedDBCore } from '../indexeddb-core'
export type {
    BookmarkRecord,
    SearchIndex,
    GlobalStats,
    AppSettings
} from '../indexeddb-core'

// 数据转换器
export { BookmarkDataTransformer } from '../bookmark-data-transformer'
export type {
    TransformOptions,
    TransformResult
} from '../bookmark-data-transformer'

// 书签管理器
export { IndexedDBBookmarkManager } from '../indexeddb-bookmark-manager'
export type {
    BookmarkManagerOptions,
    SearchOptions,
    BookmarkQuery
} from '../indexeddb-bookmark-manager'

// 应用初始化器（迁移功能已移除）
export { AppInitializer, appInitializer } from '../app-initializer'
export type {
    InitializationResult,
    InitializationOptions
} from '../app-initializer'

// Pinia Store - IndexedDB版本
export { usePopupStoreIndexedDB } from '../../stores/popup-store-indexeddb'

/**
 * 便捷的初始化函数
 * 用于快速设置IndexedDB架构
 */
export async function initializeIndexedDBArchitecture(options?: {
    onProgress?: (step: string, progress: number) => void
}) {
    const { appInitializer } = await import('../app-initializer')

    return await appInitializer.initialize({
        onInitProgress: options?.onProgress
    })
}
