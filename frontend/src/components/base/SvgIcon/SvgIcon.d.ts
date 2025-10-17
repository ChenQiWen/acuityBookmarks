export interface SvgIconProps {
  // SVG 图标组件属性
  name: string // 图标名称
  size?: number | string // 图标大小
  color?: string // 填充颜色
  viewBox?: string // 自定义视窗
  path?: string // 自定义路径
  spin?: boolean // 是否旋转动画
  flipH?: boolean // 水平翻转
  flipV?: boolean // 垂直翻转
  rotate?: number // 旋转角度
}

export interface SvgIconEmits {
  click: [event: MouseEvent] // 点击事件
}
