/**
 * Pinia Store 索引文件
 * 导出所有可用的 stores
 */

// 导出所有 stores
export { useUIStore } from './ui-store'
export { usePopupStore } from './popup-store'
export { useManagementStore } from './management-store'
export { useBookmarkStore } from './bookmark-store'

// 导出类型定义
export type { SnackbarState, DialogState, LoadingState } from './ui-store'
export type { BookmarkStats, SearchUIState, SearchProgress } from './popup-store'
export type { ProposalNode, CacheStatus, EditBookmarkData, AddItemData } from './management-store'
export type { 
  Bookmark, 
  BookmarkCategory, 
  AIAnalysisResult, 
  BookmarkStats as BookmarkStoreStats 
} from './bookmark-store'

/**
 * Store 使用说明
 * 
 * 1. UI Store (useUIStore):
 *    - 全局UI状态管理
 *    - Snackbar、对话框、加载状态
 *    - 错误处理和用户反馈
 * 
 * 2. Popup Store (usePopupStore):
 *    - 弹窗页面状态管理
 *    - 搜索功能、书签统计
 *    - Chrome标签页信息
 * 
 * 3. Management Store (useManagementStore):
 *    - 管理页面状态管理
 *    - 书签树、AI提案、变更追踪
 *    - 编辑、删除、添加操作
 * 
 * 4. Bookmark Store (useBookmarkStore):
 *    - 核心书签数据管理
 *    - AI分析缓存、分类管理
 *    - 搜索和性能监控
 * 
 * 使用示例:
 * ```typescript
 * import { useUIStore, usePopupStore } from '@/stores'
 * 
 * export default {
 *   setup() {
 *     const uiStore = useUIStore()
 *     const popupStore = usePopupStore()
 *     
 *     // 显示成功消息
 *     uiStore.showSuccess('操作成功')
 *     
 *     // 执行搜索
 *     await popupStore.performSearch('Vue.js')
 *     
 *     return {
 *       uiStore,
 *       popupStore
 *     }
 *   }
 * }
 * ```
 */
