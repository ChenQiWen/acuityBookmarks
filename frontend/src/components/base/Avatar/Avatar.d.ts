/** 头像组件类型定义 */
export interface AvatarProps {
  src?: string
  alt?: string
  icon?: string
  text?: string
  size?: number | string
  variant?: 'circle' | 'rounded' | 'square'
} // 头像组件属性

export interface AvatarEmits {} // 头像组件事件
