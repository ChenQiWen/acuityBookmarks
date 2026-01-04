export interface CheckboxProps {
  /** 复选框的值 */
  modelValue: boolean
  /** 复选框的标签 */
  label?: string
  /** 复选框是否禁用 */
  disabled?: boolean
  /** 复选框是否只读 */
  readonly?: boolean
  /** 复选框的大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 复选框是否半选中 */
  indeterminate?: boolean
  /** 复选框的变体 */
  variant?: 'default' | 'icon'
}

export interface CheckboxEmits {
  (event: 'update:modelValue', value: boolean): void // 值变化事件
  (event: 'click', e: MouseEvent): void // 点击事件
}
