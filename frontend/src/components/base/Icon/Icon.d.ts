export interface IconProps {
  /** 图标名称 */
  name: string
  /** 图标尺寸 */
  size?: number | string
  /** 图标颜色 */
  color?: string
  /** 是否旋转 */
  spin?: boolean
  /** 是否垂直翻转 */
  flipV?: boolean
  /** 是否水平翻转 */
  flipH?: boolean
  /** 旋转角度 */
  rotate?: number
  /** 自定义路径 */
  path?: string
}

export interface IconEmits {
  click: [event: MouseEvent]
}
