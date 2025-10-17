/**
 * SimpleBookmarkTree 组件类型定义
 * 简化版统一书签目录树组件
 */

import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'

export interface SimpleBookmarkTreeProps {
  /** 书签节点数据 */
  nodes?: BookmarkNode[]

  /** 是否可搜索 */
  searchable?: boolean

  /** 是否启用虚拟滚动 */
  virtualEnabled?: boolean

  /** 容器高度 */
  height?: string | number

  /** 是否严格按Chrome顺序 */
  strictChromeOrder?: boolean

  /** 高亮匹配项 */
  highlightMatches?: boolean

  /** 树配置 */
  treeConfig?: {
    showFavicons?: boolean
    showUrls?: boolean
    expandLevel?: number
    maxDepth?: number
  }
}

export interface SimpleBookmarkTreeEmits {
  /** 节点点击事件 */
  'node-click': [node: BookmarkNode, event: MouseEvent]

  /** 节点选择事件 */
  'node-select': [node: BookmarkNode]

  /** 节点展开/折叠事件 */
  'node-toggle': [node: BookmarkNode, expanded: boolean]

  /** 搜索事件 */
  search: [query: string]

  /** 节点悬停事件 */
  'node-hover': [node: BookmarkNode | null]
}
