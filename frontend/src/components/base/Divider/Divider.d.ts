export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  variant?: 'solid' | 'dashed' | 'dotted'
  spacing?: 'sm' | 'md' | 'lg'
  color?: 'default' | 'muted' | 'subtle'
  inset?: boolean
  length?: string | number
} // 分割线组件属性

export interface DividerEmits {} // 分割线组件事件
