export interface OverlayProps {
  /** 绑定显隐 */
  modelValue?: boolean
  /** 是否锁定滚动 */
  lockScroll?: boolean
  /** 是否可关闭 */
  closable?: boolean
  /** 背景透明度 */
  opacity?: number
  /** Teleport 目标 */
  target?: string | HTMLElement
  /** Teleport 目标 */
  persistent?: boolean
  /** 是否点击蒙层不关闭 */
  blur?: boolean
  /** 层级 */
  zIndex?: number
  /** 是否显示 */
  show?: boolean
  /** 兼容 show 控制 */
}

export interface OverlayEmits {
  /** 更新显隐 */
  (event: 'update:modelValue', value: boolean): void
  /** 更新显隐 */
  (event: 'update:show', value: boolean): void
  /** 关闭事件 */
  (event: 'close'): void
  /** 点击事件 */
  (event: 'click', e: MouseEvent): void
}
