export interface ListItem {
  label: string
  value?: string | number
  icon?: string
  description?: string
  disabled?: boolean
} // 列表项类型

export interface ListProps {
  is?: 'list' | 'item' | 'group' // 渲染类型
  dense?: boolean // 紧凑模式
  variant?: 'default' | 'nav' | 'plain' // 风格
  disabled?: boolean // 禁用
  active?: boolean // 激活态
  expanded?: boolean // 展开态
  clickable?: boolean // 是否可点击
  tag?: string // 自定义标签
} // 列表组件属性

export interface ListEmits {
  (event: 'click', e: MouseEvent): void // 点击事件
  (event: 'toggle', expanded: boolean): void // 切换展开
} // 列表组件事件
