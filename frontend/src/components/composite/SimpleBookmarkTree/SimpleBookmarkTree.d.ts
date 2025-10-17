import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'

export interface SimpleBookmarkTreeProps {
  // 简化书签树组件属性
  nodes?: BookmarkNode[] // 书签节点数据
  searchable?: boolean // 是否可搜索
  virtualEnabled?: boolean // 是否启用虚拟滚动
  height?: string | number // 容器高度
  strictChromeOrder?: boolean // 是否严格按 Chrome 顺序
  highlightMatches?: boolean // 是否高亮匹配项
  treeConfig?: {
    // 树配置
    showFavicons?: boolean // 显示网站图标
    showUrls?: boolean // 显示 URL
    expandLevel?: number // 默认展开层级
    maxDepth?: number // 最大递归深度
  }
}

export interface SimpleBookmarkTreeEmits {
  'node-click': [node: BookmarkNode, event: MouseEvent] // 节点点击事件
  'node-select': [node: BookmarkNode] // 节点选择事件
  'node-toggle': [node: BookmarkNode, expanded: boolean] // 节点展开/折叠事件
  search: [query: string] // 搜索事件
  'node-hover': [node: BookmarkNode | null] // 节点悬停事件
}
