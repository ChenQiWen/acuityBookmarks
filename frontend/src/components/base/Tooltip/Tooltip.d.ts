export interface TooltipProps {
  text?: string
  placement?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-start'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-end'
  delay?: number
  disabled?: boolean
  activator?: string
  offset?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
} // 提示气泡组件属性

export interface TooltipEmits {} // 提示气泡组件事件
