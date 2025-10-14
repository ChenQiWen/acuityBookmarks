/**
 * Store 统一导出
 * 提供清晰、职责分离的 Store 接口
 */

// === 书签管理 Store ===
export { useBookmarkManagementStore } from './bookmark/bookmark-management-store'
export type {
  EditBookmarkData,
  AddItemData
} from './bookmark/bookmark-management-store'

// === 清理功能 Store ===
export { useCleanupStore } from './cleanup/cleanup-store'

// === 搜索功能 Store ===
export { useSearchStore } from './search/search-store'
export type {
  SearchResult,
  SearchHistoryItem,
  SearchStatistics
} from './search/search-store'

// === UI 状态 Store ===
export { useDialogStore } from './ui/dialog-store'
export type {
  DialogState,
  EditBookmarkDialogState,
  EditFolderDialogState,
  AddItemDialogState
} from './ui/dialog-store'

// === 现有 Store (保持兼容性) ===
export { useBookmarkStore } from './bookmarkStore'
export { useUIStore } from './ui-store'
export { usePopupStoreIndexedDB as usePopupStore } from './popup-store-indexeddb'

// === 类型导出 ===
export type {
  BookmarkNode,
  ChromeBookmarkTreeNode,
  ProposalNode
} from '@/types'

export type { CleanupState, CleanupSettings } from '@/types/cleanup'

export type {
  BookmarkStats,
  SearchUIState,
  SearchProgress
} from './popup-store-indexeddb'

export type { SnackbarState, LoadingState } from './ui-store'
