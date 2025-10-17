export interface DialogProps {
  modelValue: boolean
  title?: string
  width?: string | number
  persistent?: boolean
  dense?: boolean
  hideClose?: boolean
  teleportTarget?: string
  closeOnOverlay?: boolean
} // 通用弹窗组件属性

export interface DialogEmits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'open'): void
  (event: 'close'): void
} // 通用弹窗组件事件
