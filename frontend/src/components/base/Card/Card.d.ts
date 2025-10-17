export interface CardProps {
  title?: string
  subtitle?: string
  icon?: string
  iconColor?: string
  variant?: 'default' | 'outlined' | 'elevated'
  size?: 'sm' | 'md' | 'lg'
  borderless?: boolean
  padding?: boolean
  hover?: boolean
  clickable?: boolean
  footerTransition?: string
  footerVisible?: boolean
} // 卡片组件属性

export interface CardEmits {
  click: [event: Event]
} // 卡片组件事件
