/** 提示条组件类型定义 */
export interface ToastProps {
  /** 是否显示 */ modelValue: boolean
  /** 提示类型 */ type?: 'info' | 'success' | 'warning' | 'error'
  /** 自动关闭毫秒数 */ duration?: number
  /** 是否可关闭 */ closable?: boolean
  /** 是否展示进度条 */ showProgress?: boolean
}

export interface ToastEmits {
  /** 显隐变化 */ (event: 'update:modelValue', value: boolean): void
  /** 关闭回调 */ (event: 'close'): void
}
