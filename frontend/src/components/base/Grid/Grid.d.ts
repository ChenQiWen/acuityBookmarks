export interface GridProps {
  /** 渲染类型 */
  is?: 'container' | 'row' | 'col'
  /** 列数 */
  columns?: number
  /** 行间距 */
  rowGap?: string
  /** 列间距 */
  columnGap?: string
  /** 自动适配 */
  autoFit?: boolean
  /** 容器是否流式 */
  fluid?: boolean
  /** 行内间距 */
  gutter?: 'sm' | 'md' | 'lg' | 'xl'
  /** 主轴对齐 */
  justify?:
    | 'start'
    | 'center'
    | 'end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
  /** 交叉轴对齐 */
  align?: 'start' | 'center' | 'end' | 'stretch'
  /** 列跨越 */
  cols?: number
  /** 偏移列数 */
  offset?: number
}

export interface GridEmits {}
