export interface DropdownProps {
  // 下拉菜单组件属性
  modelValue: boolean // 是否显示
  trigger?: 'click' | 'hover' // 触发方式
  placement?: 'top' | 'bottom' | 'left' | 'right' // 对齐方式
  disabled?: boolean // 是否禁用
}

export interface DropdownEmits {
  (event: 'update:modelValue', value: boolean): void // 显隐变化
  (event: 'open'): void // 打开事件
  (event: 'close'): void // 关闭事件
}
