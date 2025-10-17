export interface ChipProps {
  text?: string
  variant?: 'filled' | 'outlined' | 'soft'
  color?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
  size?: 'sm' | 'md' | 'lg'
  closable?: boolean
  clickable?: boolean
  disabled?: boolean
} // 筛选标签组件属性

export interface ChipEmits {
  (event: 'click', e: MouseEvent): void
  (event: 'close', e: MouseEvent): void
} // 筛选标签组件事件
