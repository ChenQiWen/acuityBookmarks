export interface InputProps {
  /** 输入框的值 */
  modelValue?: string | number
  /** 输入框的模型修饰符 */
  modelModifiers?: {
    number?: boolean
    trim?: boolean
  }
  /** 输入框的标签 */
  label?: string
  /** 输入框的样式 */
  variant?: 'outlined' | 'filled' | 'underlined'
  /** 输入框的密度 */
  density?: 'default' | 'comfortable' | 'compact'
  /** 输入框的类型 */
  type?: string
  /** 输入框的占位符 */
  placeholder?: string
  disabled?: boolean
  /** 输入框是否只读 */
  readonly?: boolean
  /** 输入框是否可清除 */
  clearable?: boolean
  /** 输入框的清除值 */
  clearValue?: string | number
  /** 输入框的自动完成 */
  autocomplete?: string
  /** 输入框的 name 属性（用于表单提交和自动填充） */
  name?: string
  /** 输入框的最大长度 */
  maxlength?: number
  /** 输入框的提示 */
  hint?: string
  /** 输入框是否错误 */
  error?: boolean
  /** 输入框的错误消息 */
  errorMessage?: string
  /** 输入框的前缀图标 */
  prefixIcon?: string
  /** 输入框的后缀图标 */
  suffixIcon?: string
  /** 输入框的类名 */
  inputClass?: string
  /** 输入框的大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 输入框是否加载中 */
  loading?: boolean
  /** 输入框是否无边框 */
  borderless?: boolean
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
