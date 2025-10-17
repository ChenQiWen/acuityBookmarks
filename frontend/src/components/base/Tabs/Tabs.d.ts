export interface TabsProps {
  // 标签页组件属性
  modelValue?: string | number // 当前选中值
  dense?: boolean // 是否采用紧凑样式
  centered?: boolean // 是否居中对齐
}

export interface TabsEmits {
  (event: 'update:modelValue', value: string | number): void // 更新选中值
  (event: 'change', value: string | number): void // 选项切换
}
