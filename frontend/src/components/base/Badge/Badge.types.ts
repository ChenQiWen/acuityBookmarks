/**
 * Badge 组件类型定义
 * Badge 组件 - 基础UI组件
 */

export interface BadgeProps {
  /** 徽章变体 */
  variant?: 'filled' | 'outlined' | 'soft'

  /** 徽章颜色 */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'

  /** 徽章尺寸 */
  size?: 'sm' | 'md' | 'lg'

  /** 徽章数量（用于通知徽章） */
  count?: number
}

export interface BadgeEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
