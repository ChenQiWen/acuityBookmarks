/** 列表组件类型定义 */
export interface ListProps {
  /** 列表标题 */ title?: string
  /** 是否展示分割线 */ bordered?: boolean
  /** 是否正在加载 */ loading?: boolean
  /** 空状态提示 */ emptyText?: string
}

export interface ListEmits {
  /** 列表项点击 */ (event: 'item-click', index: number): void
}
