export interface InputProps {
  modelValue?: string | number
  modelModifiers?: {
    number?: boolean
    trim?: boolean
  }
  label?: string
  variant?: 'outlined' | 'filled' | 'underlined'
  density?: 'default' | 'comfortable' | 'compact'
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  clearValue?: string | number
  autocomplete?: string
  maxlength?: number
  hint?: string
  error?: boolean
  errorMessage?: string
  prefixIcon?: string
  suffixIcon?: string
  inputClass?: string
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
} // 输入框组件属性

export interface InputEmits {
  (event: 'update:modelValue', value: string | number): void
  (event: 'focus', e: FocusEvent): void
  (event: 'blur', e: FocusEvent): void
  (event: 'clear'): void
  (event: 'prefix-click', e: MouseEvent): void
  (event: 'suffix-click', e: MouseEvent): void
  (event: 'input', value: string | number): void
  (event: 'keydown', e: KeyboardEvent): void
} // 输入框组件事件
