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

// 迁移管理器
export { MigrationManager } from '../migration-manager'
export type {
    MigrationStatus,
    MigrationOptions
} from '../migration-manager'

// 应用初始化器
export { AppInitializer, getAppInitializer } from '../app-initializer'
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
    autoMigrate?: boolean
    onProgress?: (step: string, progress: number) => void
}) {
    const { getAppInitializer } = await import('../app-initializer')
    const initializer = getAppInitializer()

    return await initializer.initialize({
        autoMigrate: options?.autoMigrate ?? true,
        onInitProgress: options?.onProgress
    })
}
