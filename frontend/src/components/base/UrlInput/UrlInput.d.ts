export interface UrlInputProps {
  modelValue?: string
  label?: string
  variant?: 'outlined' | 'filled' | 'underlined'
  density?: 'default' | 'comfortable' | 'compact'
  error?: boolean
  errorMessage?: string
  hint?: string
  disabled?: boolean
  protocols?: string[]
  inputClass?: string
} // URL 输入框组件属性

export interface UrlInputEmits {
  (event: 'update:modelValue', value: string): void
} // URL 输入框组件事件
