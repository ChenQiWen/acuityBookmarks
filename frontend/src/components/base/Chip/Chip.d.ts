export interface ChipProps {
  // 筛选标签组件属性
  label: string // 展示文案
  closable?: boolean // 是否可关闭
  active?: boolean // 是否激活
  disabled?: boolean // 是否禁用
}

export interface ChipEmits {
  (event: 'click', e: MouseEvent): void // 点击事件
  (event: 'close'): void // 关闭事件
}
