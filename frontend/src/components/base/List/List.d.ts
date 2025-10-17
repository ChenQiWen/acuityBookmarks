export interface ListItem {
  label: string // 显示文本
  value?: string | number // 对应值
  icon?: string // 图标
  description?: string // 描述
  disabled?: boolean // 是否禁用
  active?: boolean // 是否激活
  expanded?: boolean // 是否展开
}

export interface ListProps {
  items?: ListItem[] // 列表数据
  title?: string // 标题
  bordered?: boolean // 是否带边框
  loading?: boolean // 是否加载中
  emptyText?: string // 空状态文案
  selectable?: boolean // 是否可选
  activeValue?: string | number // 当前选中值
  is?: 'list' | 'item' | 'group' // 渲染模式
  dense?: boolean // 紧凑模式
  variant?: 'default' | 'nav' | 'plain' // 风格
  disabled?: boolean // 禁用
  active?: boolean // 激活
  expanded?: boolean // 展开
  clickable?: boolean // 单项可点击
  tag?: string // 自定义容器标签
} // 列表组件属性

export interface ListEmits {
  (event: 'click', e: MouseEvent): void // 点击事件
  (event: 'toggle', expanded: boolean): void // 展开切换
  (event: 'update:activeValue', value: string | number | undefined): void // 更新选中
  (event: 'item-click', item: ListItem, index: number): void // 单项点击
} // 列表组件事件
