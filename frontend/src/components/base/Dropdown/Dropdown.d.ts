/** 下拉菜单组件类型定义 */
export interface DropdownProps {
  /** 是否显示 */ modelValue: boolean
  /** 触发方式 */ trigger?: 'click' | 'hover'
  /** 对齐方式 */ placement?: 'top' | 'bottom' | 'left' | 'right'
  /** 是否禁用 */ disabled?: boolean
}

export interface DropdownEmits {
  /** 显隐变化 */ (event: 'update:modelValue', value: boolean): void
  /** 打开事件 */ (event: 'open'): void
  /** 关闭事件 */ (event: 'close'): void
}
