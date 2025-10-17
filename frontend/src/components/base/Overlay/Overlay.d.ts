export interface OverlayProps {
  // 遮罩层组件属性
  modelValue: boolean // 是否显示
  lockScroll?: boolean // 是否禁用滚动
  closable?: boolean // 是否可点击关闭
  opacity?: number // 自定义透明度
}

export interface OverlayEmits {
  (event: 'update:modelValue', value: boolean): void // 显隐变化
  (event: 'click', e: MouseEvent): void // 点击遮罩
}
