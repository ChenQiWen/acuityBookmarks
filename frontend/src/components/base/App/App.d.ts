export interface AppProps {
  /** 应用的主题 */
  theme?: 'light' | 'dark' | 'auto'
  /** 应用是否全高度 */
  fullHeight?: boolean
  /** 应用是否显示骨架屏 */
  showSkeleton?: boolean
} // 根级应用容器属性

export interface AppEmits {} // 根级应用容器事件
