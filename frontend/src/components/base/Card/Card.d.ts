export interface CardProps {
  // 卡片组件属性
  title?: string // 卡片标题
  subtitle?: string // 卡片副标题
  icon?: string // 图标名称
  iconColor?: string // 图标颜色
  variant?: 'default' | 'outlined' | 'elevated' // 卡片样式
  size?: 'sm' | 'md' | 'lg' // 卡片尺寸
  borderless?: boolean // 是否移除边框
  padding?: boolean // 是否保留内边距
  hover?: boolean // 是否开启悬停效果
  clickable?: boolean // 是否可点击
  footerTransition?: string // 页脚动画名称
  footerVisible?: boolean // 页脚是否可见
}

export interface CardEmits {
  click: [event: Event] // 点击事件
}
