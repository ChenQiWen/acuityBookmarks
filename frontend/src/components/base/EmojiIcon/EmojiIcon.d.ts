export interface EmojiIconProps {
  /** 图标字符 */
  char?: string
  /** 图标大小 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  /** 图标颜色 */
  color?: string
  /** 图标旋转角度 */
  rotate?: number
  /** 图标是否水平翻转 */
  flipH?: boolean
  /** 图标是否垂直翻转 */
  flipV?: boolean
  /** 图标是否旋转 */
  spin?: boolean
}

export interface EmojiIconEmits {
  click: [event: MouseEvent]
}
