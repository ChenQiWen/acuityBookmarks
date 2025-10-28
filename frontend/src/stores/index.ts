// 汇总导出 Pinia store，请仅暴露 presentation 层允许访问的 store
export { useBookmarkManagementStore } from './bookmark/bookmark-management-store'
export { useBookmarkStore } from './bookmarkStore'
export { useCleanupStore } from './cleanup/cleanup-store'
export { usePopupStoreIndexedDB } from './popup-store-indexeddb'
export {
  useQueryStore,
  useSearchStore,
  useFilterStore
} from './query-store/query-store'
export { useDialogStore } from './ui/dialog-store'
export { useUIStore } from './ui-store'

// === 类型导出 ===
export type {
  BookmarkNode,
  ChromeBookmarkTreeNode,
  ProposalNode
} from '@/types'

export type { CleanupState, CleanupSettings } from '@/types/domain/cleanup'

export type { BookmarkStats } from './popup-store-indexeddb'

export type { SnackbarState, LoadingState } from './ui-store'
