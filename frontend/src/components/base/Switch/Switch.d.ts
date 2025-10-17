export interface SwitchProps {
  modelValue: boolean
  disabled?: boolean
  label?: string
  inline?: boolean
  color?: 'primary' | 'secondary' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
} // 开关组件属性

export interface SwitchEmits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'change', value: boolean): void
} // 开关组件事件
