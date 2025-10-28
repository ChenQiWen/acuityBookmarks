export interface CheckboxProps {
  // 复选框组件属性
  modelValue: boolean // 双向绑定值
  label?: string // 标签文字
  disabled?: boolean // 是否禁用
  readonly?: boolean // 是否只读
  size?: 'sm' | 'md' | 'lg' // 尺寸
  indeterminate?: boolean // 半选中状态
  variant?: 'default' | 'icon' // 变体：default=传统复选框，icon=图标样式
}

export interface CheckboxEmits {
  (event: 'update:modelValue', value: boolean): void // 值变化事件
  (event: 'click', e: MouseEvent): void // 点击事件
}
