/**
 * Chip 组件类型定义
 * Chip 组件 - 基础UI组件
 */

export interface ChipProps {
  /** 标签文本 */
  text?: string

  /** 标签变体 */
  variant?: 'filled' | 'outlined' | 'soft'

  /** 标签颜色 */
  color?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'default'

  /** 标签尺寸 */
  size?: 'sm' | 'md' | 'lg'

  /** 是否可关闭 */
  closable?: boolean

  /** 是否可点击 */
  clickable?: boolean

  /** 是否禁用 */
  disabled?: boolean
}

export interface ChipEmits {
  /** 点击事件 */
  click: [event: MouseEvent]

  /** 关闭事件 */
  close: [event: MouseEvent]
}
