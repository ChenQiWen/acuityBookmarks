export interface GridProps {
  // 栅格布局组件属性
  columns?: number // 列数
  rowGap?: string // 行间距
  columnGap?: string // 列间距
  autoFit?: boolean // 是否自适应列宽
}

export interface GridEmits {} // 栅格组件事件
