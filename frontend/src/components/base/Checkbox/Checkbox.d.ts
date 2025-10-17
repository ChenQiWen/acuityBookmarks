export interface CheckboxProps {
  // 复选框组件属性
  modelValue: boolean // 双向绑定值
  label?: string // 标签文字
  disabled?: boolean // 是否禁用
  readonly?: boolean // 是否只读
}

export interface CheckboxEmits {
  (event: 'update:modelValue', value: boolean): void // 值变化事件
  (event: 'click', e: MouseEvent): void // 点击事件
}
