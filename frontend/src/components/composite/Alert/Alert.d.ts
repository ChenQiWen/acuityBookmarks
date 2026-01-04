export interface AlertProps {
  /** 提示消息 */
  message?: string
  /** 提示的样式变体 */
  variant?: 'filled' | 'outlined' | 'soft'
  /** 提示的颜色/类型 */
  color?: 'info' | 'success' | 'warning' | 'error'
  /** 提示的大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 自定义图标 */
  icon?: string
} // Alert 组件属性

export interface AlertEmits {} // Alert 组件事件
