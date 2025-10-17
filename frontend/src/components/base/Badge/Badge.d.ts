/** 徽章组件类型定义 */
export interface BadgeProps {
  /** 徽章风格 */ variant?: 'filled' | 'outlined' | 'soft'
  /** 主题颜色 */ color?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
  /** 尺寸规格 */ size?: 'sm' | 'md' | 'lg'
  /** 数量展示（通知场景） */ count?: number
}

export interface BadgeEmits {
  /** 点击事件 */ click: [event: MouseEvent]
}
