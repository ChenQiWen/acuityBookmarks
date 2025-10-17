/** 筛选标签组件类型定义 */
export interface ChipProps {
  /** 展示文案 */ label: string
  /** 是否可关闭 */ closable?: boolean
  /** 是否激活 */ active?: boolean
  /** 是否禁用 */ disabled?: boolean
}

export interface ChipEmits {
  /** 点击事件 */ (event: 'click', e: MouseEvent): void
  /** 关闭事件 */ (event: 'close'): void
}
