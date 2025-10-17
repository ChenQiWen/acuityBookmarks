/** 主题切换按钮类型定义 */
export interface ThemeToggleProps {
  /** 当前主题 */ theme: 'light' | 'dark' | 'auto'
  /** 是否禁用 */ disabled?: boolean
}

export interface ThemeToggleEmits {
  /** 主题变化 */ (event: 'change', value: 'light' | 'dark' | 'auto'): void
}
