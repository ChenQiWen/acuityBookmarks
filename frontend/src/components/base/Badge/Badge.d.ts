export interface BadgeProps {
  /** 徽章的样式 */
  variant?: 'filled' | 'outlined' | 'soft'
  /** 徽章的颜色 */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  /** 徽章的大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 徽章的计数 */
  count?: number
} // 徽章组件属性

export interface BadgeEmits {
  /** 徽章点击事件 */
  click: [event: MouseEvent]
} // 徽章组件事件
