export interface TabItem {
  /** 文本 */
  text?: string
  /** 标签 */
  label?: string
  /** 值 */
  value?: string | number
  /** 图标 */
  icon?: string
  disabled?: boolean
}

export interface TabsProps {
  modelValue?: string | number
  /** 标签页条目 */
  tabs?: TabItem[]
  /** 是否填充 */
  grow?: boolean
  /** 变体 */
  variant?: 'default' | 'pills' | 'underline'
  /** 颜色 */
  color?: 'primary' | 'secondary'
  /** 辅助标签 */
  ariaLabel?: string
  /** 方向 */
  orientation?: 'horizontal' | 'vertical'
}

export interface TabsEmits {
  (event: 'update:modelValue', value: string | number): void
  (event: 'change', value: string | number): void
} // 标签页组件事件
