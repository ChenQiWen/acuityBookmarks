/** 提示气泡组件类型定义 */
export interface TooltipProps {
  /** 是否显示 */ modelValue: boolean
  /** 提示内容 */ content: string
  /** 触发方式 */ trigger?: 'hover' | 'click' | 'focus'
  /** 相对位置 */ placement?: 'top' | 'bottom' | 'left' | 'right'
}

export interface TooltipEmits {
  /** 显隐变化 */ (event: 'update:modelValue', value: boolean): void
}
