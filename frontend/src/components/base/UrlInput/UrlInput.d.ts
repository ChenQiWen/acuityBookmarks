/** URL 输入框组件类型定义 */
export interface UrlInputProps {
  /** 双向绑定值 */ modelValue: string
  /** 占位文本 */ placeholder?: string
  /** 是否禁用 */ disabled?: boolean
}

export interface UrlInputEmits {
  /** 内容变化 */ (event: 'update:modelValue', value: string): void
  /** 触发解析 */ (event: 'analyze', value: string): void
}
