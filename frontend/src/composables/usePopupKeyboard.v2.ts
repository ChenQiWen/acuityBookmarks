/**
 * Popup 页面键盘快捷键管理（Vue 风格版本）
 *
 * 使用 useKeyboardModifier 提供更简洁的 API
 */
import { useKeyboardModifier } from './useKeyboardModifier'

/**
 * Popup 页面快捷键处理器
 */
export interface PopupKeyboardHandlers {
  /** 切换侧边栏 */
  toggleSidePanel: () => void
  /** 打开管理页面 */
  openManagement: () => void
  /** 打开设置页面 */
  openSettings?: () => void
  /** 刷新数据 */
  refresh?: () => void
}

/**
 * Popup 页面键盘快捷键（Vue 风格版本）
 *
 * 对比原版本：
 *
 * 原版本：
 * ```typescript
 * register({
 *   key: 't',
 *   alt: true,
 *   handler: handlers.toggleSidePanel,
 *   description: '切换侧边栏'
 * })
 * ```
 *
 * 新版本：
 * ```typescript
 * on('alt.t', handlers.toggleSidePanel, '切换侧边栏')
 * ```
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { usePopupKeyboardV2 } from '@/composables/usePopupKeyboard.v2'
 *
 * usePopupKeyboardV2({
 *   toggleSidePanel: () => { ... },
 *   openManagement: () => { ... }
 * })
 * </script>
 * ```
 */
export function usePopupKeyboardV2(handlers: PopupKeyboardHandlers) {
  const { on } = useKeyboardModifier()

  // Alt + T - 切换侧边栏
  on('alt.t', handlers.toggleSidePanel, '切换侧边栏')

  // Alt + M - 打开管理页面
  on('alt.m', handlers.openManagement, '打开书签管理页面')

  // Alt + S - 打开设置页面（可选）
  if (handlers.openSettings) {
    on('alt.s', handlers.openSettings, '打开设置页面')
  }

  // Ctrl/Cmd + R - 刷新数据（可选）
  if (handlers.refresh) {
    on('ctrl.r', handlers.refresh, '刷新书签数据')
  }

  // F5 - 刷新数据（可选）
  if (handlers.refresh) {
    on('f5', handlers.refresh, '刷新书签数据')
  }
}
