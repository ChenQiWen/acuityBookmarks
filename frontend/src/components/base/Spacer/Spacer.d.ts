export interface SpacerProps {
  // 间距占位组件属性
  x?: number | string // 水平方向间距
  y?: number | string // 垂直方向间距
  flex?: boolean // 是否占满剩余空间
  className?: string // 自定义类名
}

export interface SpacerEmits {} // 间距组件事件
