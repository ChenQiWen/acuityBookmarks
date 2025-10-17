export interface DropdownProps {
  modelValue?: boolean
  placement?:
    | 'bottom'
    | 'top'
    | 'left'
    | 'right'
    | 'bottom-start'
    | 'bottom-end'
  offset?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  closeOnClickOutside?: boolean
  closeOnContentClick?: boolean
} // 下拉菜单组件属性

export interface DropdownEmits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'open'): void
  (event: 'close'): void
} // 下拉菜单组件事件
