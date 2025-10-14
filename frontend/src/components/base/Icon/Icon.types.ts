/**
 * Icon 组件类型定义
 * 图标组件 - 支持 Material Design Icons 和 Emoji
 */

export interface IconProps {
  /** Icon name (MDI format: mdi-icon-name) */
  name: string

  /** Size variants */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number

  /** Color (CSS color value or semantic color) */
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

  /** Rotation */
  rotate?: number

  /** Flip */
  flipH?: boolean
  flipV?: boolean

  /** Spin animation */
  spin?: boolean
}

export interface IconEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
