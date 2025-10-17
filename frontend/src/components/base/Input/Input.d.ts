/** 输入框组件类型定义 */
export interface InputProps {
  /** 双向绑定值 */ modelValue: string
  /** 输入类型 */ type?: string
  /** 占位提示 */ placeholder?: string
  /** 是否禁用 */ disabled?: boolean
  /** 是否只读 */ readonly?: boolean
  /** 是否必填 */ required?: boolean
}

export interface InputEmits {
  /** 输入事件 */ (event: 'update:modelValue', value: string): void
  /** 聚焦事件 */ (event: 'focus', e: FocusEvent): void
  /** 失焦事件 */ (event: 'blur', e: FocusEvent): void
}
