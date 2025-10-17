export interface BadgeProps {
  variant?: 'filled' | 'outlined' | 'soft'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md' | 'lg'
  count?: number
} // 徽章组件属性

export interface BadgeEmits {
  click: [event: MouseEvent]
} // 徽章组件事件
