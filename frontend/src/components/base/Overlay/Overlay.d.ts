/** 遮罩层组件类型定义 */
export interface OverlayProps {
  /** 是否显示 */ modelValue: boolean
  /** 是否禁用滚动 */ lockScroll?: boolean
  /** 是否可点击关闭 */ closable?: boolean
  /** 自定义透明度 */ opacity?: number
}

export interface OverlayEmits {
  /** 显隐变化 */ (event: 'update:modelValue', value: boolean): void
  /** 点击遮罩 */ (event: 'click', e: MouseEvent): void
}
