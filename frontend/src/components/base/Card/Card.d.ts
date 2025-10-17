/** 卡片组件类型定义 */
export interface CardProps {
  /** 卡片标题 */ title?: string
  /** 卡片副标题 */ subtitle?: string
  /** 图标名称 */ icon?: string
  /** 图标颜色 */ iconColor?: string
  /** 卡片样式 */ variant?: 'default' | 'outlined' | 'elevated'
  /** 卡片尺寸 */ size?: 'sm' | 'md' | 'lg'
  /** 是否移除边框 */ borderless?: boolean
  /** 是否保留内边距 */ padding?: boolean
  /** 是否开启悬停效果 */ hover?: boolean
  /** 是否可点击 */ clickable?: boolean
  /** 页脚动画名称 */ footerTransition?: string
  /** 页脚是否可见 */ footerVisible?: boolean
}

export interface CardEmits {
  /** 点击事件 */ click: [event: Event]
}
