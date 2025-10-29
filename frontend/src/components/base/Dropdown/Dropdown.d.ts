export interface DropdownProps {
  /** 是否显示 */
  modelValue?: boolean
  /** 下拉菜单位置 */
  placement?:
    | 'bottom'
    | 'top'
    | 'left'
    | 'right'
    | 'bottom-start'
    | 'bottom-end'
  /** 下拉菜单偏移量 */
  offset?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  /** 点击外部关闭 */
  closeOnClickOutside?: boolean
  /** 点击内容关闭 */
  closeOnContentClick?: boolean
}

export interface DropdownEmits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'open'): void
  (event: 'close'): void
}
