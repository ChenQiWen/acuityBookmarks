export interface AppBarProps {
  flat?: boolean
  app?: boolean
  color?: 'primary' | 'secondary' | 'surface' | 'transparent'
  height?: number | string
  elevation?: 'none' | 'low' | 'medium' | 'high'
} // 顶栏组件属性

export interface AppBarEmits {} // 顶栏组件事件
