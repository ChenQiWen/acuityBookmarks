export interface TooltipProps {
  // 提示气泡组件属性
  modelValue: boolean // 是否显示
  content: string // 提示内容
  trigger?: 'hover' | 'click' | 'focus' // 触发方式
  placement?: 'top' | 'bottom' | 'left' | 'right' // 相对位置
}

export interface TooltipEmits {
  (event: 'update:modelValue', value: boolean): void // 显隐变化
}
