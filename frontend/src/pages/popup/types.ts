/**
 * 📄 Popup - 弹出窗口页面类型定义
 */

/**
 * 页面状态
 */
export interface PopupState {
  isSearching: boolean
  searchQuery: string
  // 其他状态
}

/**
 * 书签项（从 IndexedDB 读取）
 */
export interface PopupBookmarkItem {
  id: string
  title: string
  url?: string
  favicon?: string
  dateAdded?: number
  dateLastUsed?: number
  [key: string]: unknown
}
