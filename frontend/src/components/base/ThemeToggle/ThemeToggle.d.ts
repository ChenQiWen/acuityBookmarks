export interface ThemeToggleProps {
  // 主题切换按钮属性
  theme: 'light' | 'dark' | 'auto' // 当前主题
  disabled?: boolean // 是否禁用
}

export interface ThemeToggleEmits {
  (event: 'change', value: 'light' | 'dark' | 'auto'): void // 主题变化
}
