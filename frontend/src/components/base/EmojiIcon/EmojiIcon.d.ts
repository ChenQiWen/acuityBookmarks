export interface EmojiIconProps {
  char?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  color?: string
  rotate?: number
  flipH?: boolean
  flipV?: boolean
  spin?: boolean
} // Emoji 图标组件属性

export interface EmojiIconEmits {
  click: [event: MouseEvent]
} // Emoji 图标组件事件
