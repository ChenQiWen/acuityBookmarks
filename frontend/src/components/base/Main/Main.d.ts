export interface MainProps {
  centered?: boolean // 是否居中
  maxWidth?: string // 最大宽度
  background?: string // 背景色
  fullHeight?: boolean // 是否占满高度
  withAppBar?: boolean // 是否与顶栏对齐
  appBarHeight?: number // 顶栏高度
  padding?: boolean // 是否添加内边距
} // 主内容区域属性

export interface MainEmits {} // 主内容区域事件
