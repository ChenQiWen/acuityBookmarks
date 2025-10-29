export interface DividerProps {
  /** 分割线方向 */
  orientation?: 'horizontal' | 'vertical'
  /** 分割线变体 */
  variant?: 'solid' | 'dashed' | 'dotted'
  /** 分割线间距 */
  spacing?: 'sm' | 'md' | 'lg'
  /** 分割线颜色 */
  color?: 'default' | 'muted' | 'subtle'
  /** 分割线是否内联 */
  inset?: boolean
  /** 分割线长度 */
  length?: string | number
}

export interface DividerEmits {}
