/**
 * 🧩 组件库统一导出
 *
 * 使用示例：
 * import { Button, Input, BookmarkTree } from '@/components'
 */

// ===== 基础 UI 组件 (从 ui/ 目录导出，待迁移到 base/) =====
export {
  App,
  AppBar,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Divider,
  Dropdown,
  Grid,
  Icon,
  Input,
  List,
  Main,
  Overlay,
  ProgressBar,
  Spacer,
  Spinner,
  Switch,
  Tabs,
  Toast,
  Tooltip,
  UrlInput
} from './ui'

// ===== 复合组件 (已迁移到 composite/) =====
export { default as SimpleBookmarkTree } from './composite/SimpleBookmarkTree/SimpleBookmarkTree.vue'
export { default as SimpleTreeNode } from './composite/SimpleTreeNode/SimpleTreeNode.vue'
export { default as SmartBookmarkRecommendations } from './composite/SmartBookmarkRecommendations/SmartBookmarkRecommendations.vue'
export { default as PanelInlineSearch } from './composite/PanelInlineSearch/PanelInlineSearch.vue'

// ===== 新规范化组件 (base/) =====
export { default as ButtonNew } from './base/Button/Button.vue'
export { default as IconNew } from './base/Icon/Icon.vue'
export { default as SvgIcon } from './base/SvgIcon/SvgIcon.vue'
export { default as EmojiIcon } from './base/EmojiIcon/EmojiIcon.vue'

// ===== 类型导出 =====
// 基础组件类型
export type * from './base/Button/Button.types'
export type * from './base/Icon/Icon.types'
export type * from './base/SvgIcon/SvgIcon.types'
export type * from './base/EmojiIcon/EmojiIcon.types'

// 复合组件类型
export type * from './composite/SimpleBookmarkTree/SimpleBookmarkTree.types'
export type * from './composite/SimpleTreeNode/SimpleTreeNode.types'
export type * from './composite/SmartBookmarkRecommendations/SmartBookmarkRecommendations.types'
export type * from './composite/PanelInlineSearch/PanelInlineSearch.types'

// ===== 性能优化工具 =====
export * from '@/composables/useSimplePerformance'
