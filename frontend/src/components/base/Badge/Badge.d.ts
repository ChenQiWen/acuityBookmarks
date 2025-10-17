/** 徽章组件类型定义 */
export interface BadgeProps {
  // 徽章组件属性
  variant?: 'filled' | 'outlined' | 'soft' // 徽章风格
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' // 主题颜色
  size?: 'sm' | 'md' | 'lg' // 尺寸规格
  count?: number // 数量展示（通知场景）
}

export interface BadgeEmits {
  click: [event: MouseEvent] // 点击事件
}
