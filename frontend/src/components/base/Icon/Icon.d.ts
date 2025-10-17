/** 基础图标组件类型定义 */
export interface IconProps {
  /** 图标名称 */ name: string
  /** 图标尺寸 */ size?: number | string
  /** 图标颜色 */ color?: string
  /** 是否旋转 */ spin?: boolean
  /** 是否垂直翻转 */ flipV?: boolean
  /** 是否水平翻转 */ flipH?: boolean
}

export interface IconEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
