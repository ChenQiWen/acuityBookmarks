export interface EmojiIconProps {
  // Emoji 图标组件属性
  symbol: string // Emoji 字符
  label?: string // 图标标题
  size?: string | number // 字体大小
}

export interface EmojiIconEmits {
  click: [event: MouseEvent] // 点击事件
}
