export interface UrlInputProps {
  /** 绑定值 */
  modelValue?: string
  /** 标签 */
  label?: string
  /** 变体 */
  variant?: 'outlined' | 'filled' | 'underlined'
  /** 密度 */
  density?: 'default' | 'comfortable' | 'compact'
  /** 是否错误 */
  error?: boolean
  /** 错误消息 */
  errorMessage?: string
  /** 提示 */
  hint?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 协议 */
  protocols?: string[]
  /** 输入框类名 */
  inputClass?: string
}

export interface UrlInputEmits {
  (event: 'update:modelValue', value: string): void
}
