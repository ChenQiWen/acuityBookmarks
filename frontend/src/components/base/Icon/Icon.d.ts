export interface IconProps {
  // 基础图标组件属性
  name: string // 图标名称
  size?: number | string // 图标尺寸
  color?: string // 图标颜色
  spin?: boolean // 是否旋转
  flipV?: boolean // 是否垂直翻转
  flipH?: boolean // 是否水平翻转
}

export interface IconEmits {
  click: [event: MouseEvent] // 点击事件
}
