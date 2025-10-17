export interface ListItem {
  label: string
  value?: string | number
  icon?: string
  description?: string
  disabled?: boolean
} // 列表项类型

export interface ListProps {
  items?: ListItem[]
  title?: string
  bordered?: boolean
  loading?: boolean
  emptyText?: string
  selectable?: boolean
  activeValue?: string | number
} // 列表组件属性

export interface ListEmits {
  (event: 'item-click', item: ListItem, index: number): void
  (event: 'update:activeValue', value: string | number | undefined): void
} // 列表组件事件
