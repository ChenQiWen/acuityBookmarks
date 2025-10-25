export interface MainProps {
  centered?: boolean // 是否居中
  maxWidth?: string // 最大宽度
  background?: string // 背景色
  fullHeight?: boolean // 是否占满高度
  padding?: boolean // 是否包含默认边距
  scrollable?: boolean // 是否允许滚动
} // 主内容区域属性

export interface MainEmits {} // 主内容区域事件
