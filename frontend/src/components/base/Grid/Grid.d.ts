/** 栅格布局组件类型定义 */
export interface GridProps {
  /** 列数 */ columns?: number
  /** 行间距 */ rowGap?: string
  /** 列间距 */ columnGap?: string
  /** 是否自适应列宽 */ autoFit?: boolean
}

export interface GridEmits {}
