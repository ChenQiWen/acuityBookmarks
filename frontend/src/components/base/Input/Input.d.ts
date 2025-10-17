export interface InputProps {
  // 输入框组件属性
  modelValue: string // 双向绑定值
  type?: string // 输入类型
  placeholder?: string // 占位提示
  disabled?: boolean // 是否禁用
  readonly?: boolean // 是否只读
  required?: boolean // 是否必填
}

export interface InputEmits {
  (event: 'update:modelValue', value: string): void // 输入事件
  (event: 'focus', e: FocusEvent): void // 聚焦事件
  (event: 'blur', e: FocusEvent): void // 失焦事件
}
