/** 标签页组件类型定义 */
export interface TabsProps {
  /** 当前选中值 */ modelValue?: string | number
  /** 是否采用紧凑样式 */ dense?: boolean
  /** 是否居中对齐 */ centered?: boolean
}

export interface TabsEmits {
  /** 更新选中值 */ (event: 'update:modelValue', value: string | number): void
  /** 选项切换 */ (event: 'change', value: string | number): void
}
