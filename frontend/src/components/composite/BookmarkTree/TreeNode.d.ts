// 新增类型定义文件
import type { BookmarkNode } from '@/types'

// ✅ 树节点渲染配置项
export interface SimpleTreeNodeConfig {
  size?: 'compact' | 'comfortable' | 'spacious'
  searchable?: boolean
  selectable?: boolean | 'single' | 'multiple'
  editable?: boolean
  showSelectionCheckbox?: boolean
}

// ✅ Props：描述节点展示所需的输入
export interface SimpleTreeNodeProps {
  node: BookmarkNode
  level?: number
  expandedFolders: Set<string>
  selectedNodes: Set<string>
  loadingChildren: Set<string>
  searchQuery?: string
  highlightMatches?: boolean
  config: SimpleTreeNodeConfig
  isVirtualMode?: boolean
  strictOrder?: boolean
  activeId?: string
  hoveredId?: string
  loadingMoreFolders?: Set<string>
  selectedDescCounts?: Map<string, number>
}

// ✅ Emits：列出节点交互向外发送的事件
export interface SimpleTreeNodeEmits {
  (event: 'node-click', node: BookmarkNode, e: MouseEvent): void
  (event: 'folder-toggle', folderId: string, node: BookmarkNode): void
  (event: 'node-select', nodeId: string, node: BookmarkNode): void
  (event: 'node-edit', node: BookmarkNode): void
  (event: 'node-delete', node: BookmarkNode): void
  (event: 'folder-add', parent: BookmarkNode): void
  (event: 'bookmark-open-new-tab', node: BookmarkNode): void
  (event: 'bookmark-copy-url', node: BookmarkNode): void
  (event: 'node-hover', node: BookmarkNode): void
  (event: 'node-hover-leave', node: BookmarkNode): void
  (event: 'node-mounted', id: string, el: HTMLElement): void
  (event: 'node-unmounted', id: string): void
}
