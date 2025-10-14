/**
 * Input 组件类型定义
 * Input 组件 - 基础UI组件
 */

export interface InputProps {
  /** 输入值 */
  modelValue?: string | number

  /** 标签文本 */
  label?: string

  /** 占位符文本 */
  placeholder?: string

  /** 输入类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'search' | 'url'

  /** 输入框变体 */
  variant?: 'outlined' | 'filled' | 'underlined'

  /** 输入框尺寸 */
  size?: 'sm' | 'md' | 'lg'

  /** 是否禁用 */
  disabled?: boolean

  /** 是否只读 */
  readonly?: boolean

  /** 是否显示加载状态 */
  loading?: boolean

  /** 是否可清除 */
  clearable?: boolean

  /** 是否有错误 */
  error?: boolean

  /** 错误信息 */
  errorMessage?: string

  /** 提示信息 */
  hint?: string

  /** 密度 */
  density?: 'comfortable' | 'compact' | 'default'
}

export interface InputEmits {
  /** 更新值事件 */
  'update:modelValue': [value: string | number]

  /** 获得焦点事件 */
  focus: [event: FocusEvent]

  /** 失去焦点事件 */
  blur: [event: FocusEvent]

  /** 输入事件 */
  input: [event: Event]

  /** 按键事件 */
  keydown: [event: KeyboardEvent]
}
