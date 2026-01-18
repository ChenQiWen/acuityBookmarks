/**
 * 🧩 组件库统一导出
 *
 * 使用示例：
 * import { Button, Input, BookmarkTree } from '@/components'
 */

// ===== 基础 UI 组件 (从 base/ 目录导出) =====
// 原子级组件：单一功能的最小 UI 单元
export { default as Accordion } from './base/Accordion/Accordion.vue'
export { default as AccordionItem } from './base/Accordion/AccordionItem.vue'
export { default as App } from './base/App/App.vue'
export { default as Badge } from './base/Badge/Badge.vue'
export { default as Button } from './base/Button/Button.vue'
export { default as CountIndicator } from './base/CountIndicator/CountIndicator.vue'
export { default as Divider } from './base/Divider/Divider.vue'
export { default as Dropdown } from './base/Dropdown/Dropdown.vue'
export { default as EmojiIcon } from './base/EmojiIcon/EmojiIcon.vue'
export { default as Grid } from './base/Grid/Grid.vue'
export { default as Icon } from './base/Icon/Icon.vue'
export { default as Input } from './base/Input/Input.vue'
export { default as List } from './base/List/List.vue'
export { default as ListItem } from './base/ListItem/ListItem.vue'
export { default as Main } from './base/Main/Main.vue'
export { default as Overlay } from './base/Overlay/Overlay.vue'
export { default as ProgressBar } from './base/ProgressBar/ProgressBar.vue'
export { default as Spacer } from './base/Spacer/Spacer.vue'
export { default as Spinner } from './base/Spinner/Spinner.vue'
export { default as SvgIcon } from './base/SvgIcon/SvgIcon.vue'
export { default as Switch } from './base/Switch/Switch.vue'
export { default as Tooltip } from './base/Tooltip/Tooltip.vue'
export { default as AnimatedNumber } from './base/AnimatedNumber/AnimatedNumber.vue'

// ===== 复合组件 (从 composite/ 目录导出) =====
// 通用复合组件：多个基础组件组合，但无业务逻辑
export { default as Alert } from './composite/Alert/Alert.vue'
export { default as AppHeader } from './composite/AppHeader/AppHeader.vue'
export { default as Avatar } from './composite/Avatar/Avatar.vue'
export { default as Card } from './composite/Card/Card.vue'
export { default as Checkbox } from './composite/Checkbox/Checkbox.vue'
export { default as Chip } from './composite/Chip/Chip.vue'
export { default as ConfirmableDialog } from './composite/ConfirmableDialog/ConfirmableDialog.vue'
export { default as Dialog } from './composite/Dialog/Dialog.vue'
export { default as EmptyState } from './composite/EmptyState/EmptyState.vue'

/**
 * ✨ Ant Design 风格的 Notification 组件（推荐使用）
 * 
 * 使用方式：
 * ```typescript
 * import { useNotification } from '@/composables/useNotification'
 * const notification = useNotification()
 * notification.success({ message: '成功', key: 'my-key' })
 * ```
 * 
 * 或使用全局服务（兼容旧代码）：
 * ```typescript
 * notificationService.notify('成功', { level: 'success', key: 'my-key' })
 * ```
 */
export { default as Notification } from './composite/Notification/Notification.vue'

export { default as PerformanceMonitor } from './composite/PerformanceMonitor/PerformanceMonitor.vue'
export { default as SyncProgressDialog } from './composite/SyncProgressDialog/SyncProgressDialog.vue'
export { default as Tabs } from './composite/Tabs/Tabs.vue'
export { default as ThemeToggle } from './composite/ThemeToggle/ThemeToggle.vue'
export { default as UrlInput } from './composite/UrlInput/UrlInput.vue'

// ===== 业务组件 (从 business/ 目录导出) =====
// 包含业务逻辑的项目专属组件
export { default as BookmarkTree } from './business/BookmarkTree/BookmarkTree.vue'
// TreeNode 是 BookmarkTree 的内部组件，不对外导出
export { default as BookmarkRecommendations } from './business/BookmarkRecommendations/BookmarkRecommendations.vue'
export { default as BookmarkSearchInput } from './business/BookmarkSearchInput/BookmarkSearchInput.vue'
export { default as QuickAddBookmarkDialog } from './business/QuickAddBookmarkDialog/QuickAddBookmarkDialog.vue'
export { default as ShareDialog } from './business/ShareDialog/ShareDialog.vue'

// ===== 类型导出 =====
// 基础组件类型
export type * from './base/Accordion/Accordion.d'
export type * from './base/App/App.d'
export type * from './base/Badge/Badge.d'
export type * from './base/Button/Button.d'
export type * from './base/CountIndicator/CountIndicator.d'
export type * from './base/Divider/Divider.d'
export type * from './base/Dropdown/Dropdown.d'
export type * from './base/EmojiIcon/EmojiIcon.d'
export type * from './base/Grid/Grid.d'
export type * from './base/Icon/Icon'
export type * from './base/Input/Input.d'
export type * from './base/List/List.d'
export type * from './base/Main/Main.d'
export type * from './base/Overlay/Overlay.d'
export type * from './base/ProgressBar/ProgressBar.d'
export type * from './base/Spacer/Spacer.d'
export type * from './base/Spinner/Spinner.d'
export type * from './base/SvgIcon/SvgIcon.d'
export type * from './base/Switch/Switch.d'
export type * from './base/Tooltip/Tooltip.d'
export type * from './base/AnimatedNumber/AnimatedNumber.d'

// 复合组件类型
export type * from './composite/Alert/Alert.d'
export type * from './composite/AppHeader/AppHeader.d'
export type * from './composite/Avatar/Avatar.d'
export type * from './composite/Card/Card.d'
export type * from './composite/Checkbox/Checkbox.d'
export type * from './composite/Chip/Chip.d'
export type * from './composite/ConfirmableDialog/ConfirmableDialog.d'
export type * from './composite/Dialog/Dialog.d'
export type * from './composite/EmptyState/EmptyState.d'
export type * from './composite/Tabs/Tabs.d'
export type * from './composite/ThemeToggle/ThemeToggle.d'
export type * from './composite/UrlInput/UrlInput.d'

// 业务组件类型
export type * from './business/BookmarkTree/BookmarkTree.d'
// TreeNode 类型不对外导出（内部组件）
export type * from './business/BookmarkRecommendations/BookmarkRecommendations.d'
export type * from './business/BookmarkSearchInput/BookmarkSearchInput.d'
export type * from './business/QuickAddBookmarkDialog/QuickAddBookmarkDialog.d'
export type * from './business/ShareDialog/ShareDialog.d'

// ===== 性能优化工具 =====
export * from '@/composables/useSimplePerformance'
