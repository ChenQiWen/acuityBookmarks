export interface OverlayProps {
  modelValue?: boolean // 绑定显隐
  lockScroll?: boolean // 是否锁定滚动
  closable?: boolean // 是否可关闭
  opacity?: number // 背景透明度
  target?: string | HTMLElement // Teleport 目标
  persistent?: boolean // 是否点击蒙层不关闭
  blur?: boolean // 是否启用模糊
  zIndex?: number // 层级
  show?: boolean // 兼容 show 控制
} // 遮罩层组件属性

export interface OverlayEmits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'update:show', value: boolean): void
  (event: 'close'): void
  (event: 'click', e: MouseEvent): void
} // 遮罩层组件事件
