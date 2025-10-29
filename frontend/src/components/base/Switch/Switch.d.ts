export interface SwitchProps {
  /** 绑定显隐 */
  modelValue: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 标签 */
  label?: string
  /** 是否内联 */
  inline?: boolean
  /** 颜色 */
  color?: 'primary' | 'secondary' | 'success' | 'warning'
  /** 大小 */
  size?: 'sm' | 'md' | 'lg'
}

export interface SwitchEmits {
  /** 更新显隐 */
  (event: 'update:modelValue', value: boolean): void
  /** 变化事件 */
  (event: 'change', value: boolean): void
}
