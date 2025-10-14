/**
 * SvgIcon 组件类型定义
 * SVG 图标组件 - 渲染 Material Design Icons
 */

export interface SvgIconProps {
  /** SVG 路径 */
  path: string

  /** 尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number

  /** 颜色 */
  color?:
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'error'
    | 'warning'
    | 'success'
    | 'info'
    | 'muted'
    | string

  /** 旋转动画 */
  spin?: boolean

  /** 旋转角度 */
  rotate?: number

  /** 水平翻转 */
  flipH?: boolean

  /** 垂直翻转 */
  flipV?: boolean
}

export interface SvgIconEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
