export interface CountIndicatorProps {
  /** 显示的数量 */
  count?: number | string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 变体样式 */
  variant?: 'default' | 'primary' | 'muted'
  /** 动画时长（毫秒），默认 600ms */
  duration?: number
  /** 是否禁用动画 */
  disableAnimation?: boolean
}
