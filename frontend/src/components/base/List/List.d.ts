export interface ListItem {
  /** 显示文本 */
  label: string
  /** 对应值 */
  value?: string | number
  /** 图标 */
  icon?: string
  /** 描述 */
  description?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否激活 */
  active?: boolean
  /** 是否展开 */
  expanded?: boolean
}

export interface ListProps {
  /** 列表数据 */
  items?: ListItem[]
  /** 标题 */
  title?: string
  /** 是否带边框 */
  bordered?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 空状态文案 */
  emptyText?: string
  /** 是否可选 */
  selectable?: boolean
  /** 当前选中值 */
  activeValue?: string | number
  /** 渲染模式 */
  is?: 'list' | 'item' | 'group'
  /** 紧凑模式 */
  dense?: boolean
  /** 风格 */
  variant?: 'default' | 'nav' | 'plain'
  /** 是否禁用 */
  disabled?: boolean
  /** 是否激活 */
  active?: boolean
  /** 是否展开 */
  expanded?: boolean
  /** 是否单项可点击 */
  clickable?: boolean
  /** 自定义容器标签 */
  tag?: string
}

export interface ListEmits {
  (event: 'click', e: MouseEvent): void
  /** 点击事件 */
  (event: 'toggle', expanded: boolean): void
  /** 展开切换 */
  (event: 'update:activeValue', value: string | number | undefined): void
  /** 更新选中 */
  /** 单项点击 */
  (event: 'item-click', item: ListItem, index: number): void
}
