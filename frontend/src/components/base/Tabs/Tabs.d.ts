export interface TabItem {
  text?: string
  label?: string
  value?: string | number
  icon?: string
  disabled?: boolean
} // 标签页条目

export interface TabsProps {
  modelValue?: string | number
  tabs?: TabItem[]
  grow?: boolean
  variant?: 'default' | 'pills' | 'underline'
  color?: 'primary' | 'secondary'
  ariaLabel?: string
  orientation?: 'horizontal' | 'vertical'
} // 标签页组件属性

export interface TabsEmits {
  (event: 'update:modelValue', value: string | number): void
  (event: 'change', value: string | number): void
} // 标签页组件事件
