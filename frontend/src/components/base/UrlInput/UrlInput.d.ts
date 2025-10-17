export interface UrlInputProps {
  // URL 输入框组件属性
  modelValue: string // 双向绑定值
  placeholder?: string // 占位文本
  disabled?: boolean // 是否禁用
}

export interface UrlInputEmits {
  (event: 'update:modelValue', value: string): void // 内容变化
  (event: 'analyze', value: string): void // 触发解析
}
