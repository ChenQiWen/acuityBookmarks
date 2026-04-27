export interface LucideIconProps {
  /** 图标名称 */
  name: string
  /** 图标大小 */
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 图标颜色 */
  color?: string
  /** 线条宽度 */
  strokeWidth?: number
  /** 是否旋转动画 */
  spin?: boolean
  /** 水平翻转 */
  flipH?: boolean
  /** 垂直翻转 */
  flipV?: boolean
  /** 旋转角度 */
  rotate?: number
}
