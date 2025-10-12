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

// 类型导出（从 @/types 导出）
export type {
  EditBookmarkData,
  AddItemData,
  CleanupState,
  BookmarkStats,
  SearchUIState,
  SearchProgress,
  SearchResultItem,
  SimpleToastState,
  SimpleLoadingState,
  SimpleThemeState,
  SimpleLayoutState
} from '@/types/ui/store'

export type { HealthOverview } from '@/types/application/health'
