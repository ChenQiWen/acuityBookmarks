export interface OverlayProps {
  modelValue: boolean
  lockScroll?: boolean
  closable?: boolean
  opacity?: number
  target?: string | HTMLElement
} // 遮罩层组件属性

export interface OverlayEmits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'click', e: MouseEvent): void
} // 遮罩层组件事件
