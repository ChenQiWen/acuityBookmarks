export interface SvgIconProps {
  // SVG 图标组件属性
  name: string // 图标名称
  size?: number | string // 图标大小
  color?: string // 填充颜色
  viewBox?: string // 自定义视窗
}

export interface SvgIconEmits {
  click: [event: MouseEvent] // 点击事件
}
