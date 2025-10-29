export interface TooltipProps {
  /** 文本 */
  text?: string
  /** 位置 */
  placement?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-start'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-end'
  /** 延迟 */
  delay?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 触发器 */
  activator?: string
  /** 偏移量 */
  offset?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export interface TooltipEmits {}
