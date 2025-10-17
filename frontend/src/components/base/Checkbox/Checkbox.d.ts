/** 复选框组件类型定义 */
export interface CheckboxProps {
  /** 双向绑定值 */ modelValue: boolean
  /** 标签文字 */ label?: string
  /** 是否禁用 */ disabled?: boolean
  /** 是否只读 */ readonly?: boolean
}

export interface CheckboxEmits {
  /** 值变化事件 */ (event: 'update:modelValue', value: boolean): void
  /** 点击事件 */ (event: 'click', e: MouseEvent): void
}
