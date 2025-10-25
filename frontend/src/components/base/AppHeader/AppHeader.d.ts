export interface AppHeaderAction {
  /** 唯一标识 */
  id: string
  /** 图标名称（当使用默认按钮时） */
  icon?: string
  /** 按钮文本描述 */
  label?: string
  /** 悬停提示语 */
  tooltip?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义组件（如 ThemeToggle） */
  component?: unknown
  /** 传递给自定义组件的 props */
  props?: Record<string, unknown>
}

export interface AppHeaderProps {
  showSidePanelToggle?: boolean
  showLogo?: boolean
  showTheme?: boolean
  showSettings?: boolean
}

export interface AppHeaderEmits {
  (event: 'open-settings'): void
}

export interface AppHeaderSlots {
  icon?: () => unknown
  actions?: () => unknown
}
