/**
 * 重构后的 Store 统一导出
 *
 * 提供精简、职责清晰的 Store 接口
 */

// 重构后的 Store
export { useManagementStore } from './management-store-refactored'
export { useBookmarkStore } from './bookmark-store-refactored'
export { usePopupStore } from './popup-store-refactored'
export { useUIStore } from './ui-store-refactored'

// 类型导出
export type {
  EditBookmarkData,
  AddItemData,
  CleanupState
} from './management-store-refactored'

export type {
  BookmarkStats,
  SearchUIState,
  SearchProgress,
  SearchResult,
  HealthOverview
} from './popup-store-refactored'

export type {
  ToastState,
  LoadingState,
  ThemeState,
  LayoutState
} from './ui-store-refactored'
