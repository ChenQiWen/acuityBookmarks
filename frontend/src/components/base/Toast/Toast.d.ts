export interface ToastProps {
  // 提示条组件属性
  modelValue: boolean // 是否显示
  type?: 'info' | 'success' | 'warning' | 'error' // 提示类型
  duration?: number // 自动关闭毫秒数
  closable?: boolean // 是否可关闭
  showProgress?: boolean // 是否展示进度条
}

export interface ToastEmits {
  (event: 'update:modelValue', value: boolean): void // 显隐变化
  (event: 'close'): void // 关闭回调
}
