export interface GridProps {
  is?: 'container' | 'row' | 'col' // 渲染类型
  columns?: number // 列数
  rowGap?: string // 行间距
  columnGap?: string // 列间距
  autoFit?: boolean // 自动适配
  fluid?: boolean // 容器是否流式
  gutter?: 'sm' | 'md' | 'lg' | 'xl' // 行内间距
  justify?:
    | 'start'
    | 'center'
    | 'end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly' // 主轴对齐
  align?: 'start' | 'center' | 'end' | 'stretch' // 交叉轴对齐
  cols?: number // 列跨越
  offset?: number // 偏移列数
} // 栅格布局组件属性

export interface GridEmits {} // 栅格布局事件
