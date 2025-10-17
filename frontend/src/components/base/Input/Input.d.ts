export interface InputProps {
  modelValue?: string
  label?: string
  variant?: 'outlined' | 'filled' | 'underlined'
  density?: 'default' | 'comfortable' | 'compact'
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  autocomplete?: string
  maxlength?: number
  hint?: string
  error?: boolean
  errorMessage?: string
  prefixIcon?: string
  suffixIcon?: string
  inputClass?: string
  size?: 'sm' | 'md' | 'lg' // 输入框尺寸
  loading?: boolean // 是否加载中
} // 输入框组件属性

export interface InputEmits {
  (event: 'update:modelValue', value: string): void
  (event: 'focus', e: FocusEvent): void
  (event: 'blur', e: FocusEvent): void
  (event: 'clear'): void
  (event: 'prefix-click', e: MouseEvent): void
  (event: 'suffix-click', e: MouseEvent): void
  (event: 'input', value: string): void // 输入事件
  (event: 'keydown', e: KeyboardEvent): void // 按键事件
} // 输入框组件事件
