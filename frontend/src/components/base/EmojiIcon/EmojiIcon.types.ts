/**
 * EmojiIcon 组件类型定义
 * Emoji 图标组件 - 渲染 Emoji 字符
 */

export interface EmojiIconProps {
  /** Emoji 字符 */
  char: string

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

  /** 旋转角度 */
  rotate?: number

  /** 水平翻转 */
  flipH?: boolean

  /** 垂直翻转 */
  flipV?: boolean

  /** 旋转动画 */
  spin?: boolean
}

export interface EmojiIconEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
