export interface ToastProps {
  show: boolean
  text: string
  color?: 'info' | 'success' | 'warning' | 'error'
  timeout?: number
  hideCloseButton?: boolean
  location?:
    | 'top'
    | 'bottom'
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
} // 提示条组件属性

export interface ToastEmits {
  (event: 'update:show', value: boolean): void
  (event: 'close'): void
} // 提示条组件事件
