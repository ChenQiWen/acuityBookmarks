export interface ChipProps {
  /** 标签的文本 */
  text?: string
  /** 标签的变体 */
  variant?: 'filled' | 'outlined' | 'soft'
  /** 标签的颜色 */
  color?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
  size?: 'sm' | 'md' | 'lg'
  /** 标签是否可关闭 */
  closable?: boolean
  /** 标签是否可点击 */
  clickable?: boolean
  /** 标签是否禁用 */
  disabled?: boolean
} // 筛选标签组件属性

export interface ChipEmits {
  (event: 'click', e: MouseEvent): void
  (event: 'close', e: MouseEvent): void
} // 筛选标签组件事件
