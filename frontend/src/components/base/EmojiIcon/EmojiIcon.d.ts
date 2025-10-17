/** Emoji 图标组件类型定义 */
export interface EmojiIconProps {
  /** Emoji 字符 */ symbol: string
  /** 图标标题 */ label?: string
  /** 字体大小 */ size?: string | number
}

export interface EmojiIconEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
