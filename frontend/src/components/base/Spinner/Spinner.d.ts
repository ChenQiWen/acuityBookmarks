export interface SpinnerProps {
  /** 大小 */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** 颜色 */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  /** 是否不确定 */
  indeterminate?: boolean
}

export interface SpinnerEmits {}
