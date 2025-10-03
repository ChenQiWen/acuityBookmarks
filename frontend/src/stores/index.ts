/**
 * Pinia Store 索引文件
 * 导出所有可用的 stores
 */

// 导出所有 stores
export { useUIStore } from './ui-store';
export { usePopupStoreIndexedDB as usePopupStore } from './popup-store-indexeddb';
export { useManagementStore } from './management-store';

// export type { 
//   Bookmark, 
//   BookmarkCategory, 
//   AIAnalysisResult, 
//   BookmarkStats as BookmarkStoreStats 
// } from './bookmark-store'; // 已迁移到IndexedDB架构

/**
 * Store 使用说明
 * 
 * 1. UI Store (useUIStore):
 *    - 全局UI状态管理
 *    - Snackbar、对话框、加载状态
 *    - 错误处理和用户反馈
 * 
 * 2. Popup Store (usePopupStore) - IndexedDB版本:
 *    - 弹窗页面状态管理
 *    - 基于IndexedDB的高性能搜索
 *    - Chrome标签页信息、书签统计
 * 
 * 3. Management Store (useManagementStore):
 *    - 管理页面状态管理
 *    - 基于IndexedDB的书签树管理
 *    - 编辑、删除、添加操作
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
