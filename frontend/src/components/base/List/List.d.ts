export interface ListProps {
  // 列表组件属性
  title?: string // 列表标题
  bordered?: boolean // 是否展示分割线
  loading?: boolean // 是否正在加载
  emptyText?: string // 空状态提示
}

export interface ListEmits {
  (event: 'item-click', index: number): void // 列表项点击
}
