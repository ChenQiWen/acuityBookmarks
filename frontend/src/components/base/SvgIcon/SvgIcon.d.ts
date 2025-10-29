export interface SvgIconProps {
  /** 图标名称 */
  name: string
  /** 图标大小 */
  size?: number | string
  /** 填充颜色 */
  color?: string
  /** 自定义视窗 */
  viewBox?: string
  /** 自定义路径 */
  path?: string
  /** 是否旋转动画 */
  spin?: boolean
  /** 水平翻转 */
  flipH?: boolean
  /** 垂直翻转 */
  flipV?: boolean
  /** 旋转角度 */
  rotate?: number
}

export interface SvgIconEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
