/**
 * 🧩 组件库统一导出
 *
 * 使用示例：
 * import { Button, Input, BookmarkTree } from '@/components'
 */

// ===== 基础 UI 组件 (从 base/ 目录导出) =====
export { default as App } from './base/App/App.vue'
export { default as Avatar } from './base/Avatar/Avatar.vue'
export { default as Badge } from './base/Badge/Badge.vue'
export { default as Button } from './base/Button/Button.vue'
export { default as Card } from './base/Card/Card.vue'
export { default as Checkbox } from './base/Checkbox/Checkbox.vue'
export { default as Chip } from './base/Chip/Chip.vue'
export { default as ConfirmableDialog } from './base/ConfirmableDialog/ConfirmableDialog.vue'
export { default as Dialog } from './base/Dialog/Dialog.vue'
export { default as Divider } from './base/Divider/Divider.vue'
export { default as Dropdown } from './base/Dropdown/Dropdown.vue'
export { default as EmojiIcon } from './base/EmojiIcon/EmojiIcon.vue'
export { default as EmptyState } from './base/EmptyState/EmptyState.vue'
export { default as Grid } from './base/Grid/Grid.vue'
export { default as Icon } from './base/Icon/Icon.vue'
export { default as Input } from './base/Input/Input.vue'
export { default as List } from './base/List/List.vue'
export { default as Main } from './base/Main/Main.vue'
export { default as Overlay } from './base/Overlay/Overlay.vue'
export { default as ProgressBar } from './base/ProgressBar/ProgressBar.vue'
export { default as Spacer } from './base/Spacer/Spacer.vue'
export { default as Spinner } from './base/Spinner/Spinner.vue'
export { default as SvgIcon } from './base/SvgIcon/SvgIcon.vue'
export { default as Switch } from './base/Switch/Switch.vue'
export { default as Tabs } from './base/Tabs/Tabs.vue'
export { default as ThemeToggle } from './base/ThemeToggle/ThemeToggle.vue'
export { default as Toast } from './base/Toast/Toast.vue'
export { default as ToastBar } from './base/ToastBar/ToastBar.vue'
export { default as Tooltip } from './base/Tooltip/Tooltip.vue'
export { default as UrlInput } from './base/UrlInput/UrlInput.vue'
export { default as AppHeader } from './base/AppHeader/AppHeader.vue'
export { default as AnimatedNumber } from './base/AnimatedNumber/AnimatedNumber.vue'

// ===== 复合组件 (从 composite/ 目录导出) =====
export { default as BookmarkTree } from './composite/BookmarkTree/BookmarkTree.vue'
// TreeNode 是 BookmarkTree 的内部组件，不对外导出
export { default as BookmarkRecommendations } from './composite/BookmarkRecommendations/BookmarkRecommendations.vue'
export { default as BookmarkFilter } from './composite/BookmarkFilter/BookmarkFilter.vue'

// ===== 类型导出 =====
// 基础组件类型
export type * from './base/App/App.d'
export type * from './base/Avatar/Avatar.d'
export type * from './base/Badge/Badge.d'
export type * from './base/Button/Button.d'
export type * from './base/Card/Card.d'
export type * from './base/Checkbox/Checkbox.d'
export type * from './base/Chip/Chip.d'
export type * from './base/ConfirmableDialog/ConfirmableDialog.d'
export type * from './base/Dialog/Dialog.d'
export type * from './base/Divider/Divider.d'
export type * from './base/Dropdown/Dropdown.d'
export type * from './base/EmojiIcon/EmojiIcon.d'
export type * from './base/EmptyState/EmptyState.d'
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
export type * from './base/Tabs/Tabs.d'
export type * from './base/ThemeToggle/ThemeToggle.d'
export type * from './base/Toast/Toast.d'
export type * from './base/Tooltip/Tooltip.d'
export type * from './base/UrlInput/UrlInput.d'
export type * from './base/AppHeader/AppHeader.d'
export type * from './base/AnimatedNumber/AnimatedNumber.d'

// 复合组件类型
export type * from './composite/BookmarkTree/BookmarkTree.d'
// TreeNode 类型不对外导出（内部组件）
export type * from './composite/BookmarkRecommendations/BookmarkRecommendations.d'
export type * from './composite/BookmarkFilter/BookmarkFilter.d'

// ===== 性能优化工具 =====
export * from '@/composables/useSimplePerformance'
