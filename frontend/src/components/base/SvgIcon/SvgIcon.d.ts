/** SVG 图标组件类型定义 */
export interface SvgIconProps {
  /** 图标名称 */ name: string
  /** 图标大小 */ size?: number | string
  /** 填充颜色 */ color?: string
  /** 自定义视窗 */ viewBox?: string
}

export interface SvgIconEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
