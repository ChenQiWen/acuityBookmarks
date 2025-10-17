// 新增类型定义文件
import type { BookmarkNode } from '@/types'

export type SimpleBookmarkTreeSource = 'sidePanel' | 'management'

// ✅ 选择模式支持布尔或显式 'single'/'multiple'
export type SimpleBookmarkTreeSelectable = boolean | 'single' | 'multiple'

export interface SimpleBookmarkTreeVirtualOptions {
  enabled: boolean
  itemHeight?: number
  threshold?: number
}

// ✅ defineExpose 暴露给父组件的能力集合
export interface SimpleBookmarkTreeExpose {
  expandAll(): void
  collapseAll(): void
  clearSelection(): void
  expandedFolders: Set<string>
  selectedNodes: Set<string>
  focusNodeById(
    id: string,
    options?: {
      scrollIntoView?: boolean
      collapseOthers?: boolean
      scrollIntoViewCenter?: boolean
      pathIds?: string[]
    }
  ): Promise<void>
  activeNodeId: string | undefined
  hoveredNodeId: string | undefined
  clearHoverAndActive(): void
  expandFolderById(id: string): void
  collapseFolderById(id: string): void
  toggleFolderById(id: string): void
  selectNodeById(id: string, opts?: { append?: boolean }): void
  getFirstVisibleBookmarkId(): string | undefined
  searchQuery: string
  setSearchQuery(query: string): void
  isScrolling: boolean
}

// ✅ 组件 Props：中文注释解释业务语义
export interface SimpleBookmarkTreeProps {
  nodes?: BookmarkNode[]
  loading?: boolean
  height?: string | number
  searchable?: boolean
  selectable?: SimpleBookmarkTreeSelectable
  editable?: boolean
  strictChromeOrder?: boolean
  virtual?: boolean | SimpleBookmarkTreeVirtualOptions
  size?: 'compact' | 'comfortable' | 'spacious'
  showToolbar?: boolean
  toolbarExpandCollapse?: boolean
  initialExpanded?: string[]
  initialSelected?: string[]
  source?: SimpleBookmarkTreeSource
  highlightMatches?: boolean
  showSelectionCheckbox?: boolean
  loadingChildren?: Set<string>
  selectedDescCounts?: Map<string, number>
}

// ✅ 组件 Emits：列出所有事件供 TS 推断
export interface SimpleBookmarkTreeEmits {
  (event: 'node-click', node: BookmarkNode, e: MouseEvent): void
  (
    event: 'folder-toggle',
    folderId: string,
    node: BookmarkNode,
    expanded: boolean
  ): void
  (
    event: 'node-select',
    nodeId: string,
    node: BookmarkNode,
    selected: boolean
  ): void
  (event: 'selection-change', ids: string[], nodes: BookmarkNode[]): void
  (event: 'search', query: string): void
  (event: 'ready'): void
  (event: 'node-edit', node: BookmarkNode): void
  (event: 'node-delete', node: BookmarkNode): void
  (event: 'folder-add', parent: BookmarkNode): void
  (event: 'bookmark-open-new-tab', node: BookmarkNode): void
  (event: 'bookmark-copy-url', node: BookmarkNode): void
  (event: 'node-hover', node: BookmarkNode): void
  (event: 'node-hover-leave', node: BookmarkNode): void
  (event: 'expand-state-change', expanded: boolean): void
  (
    event: 'request-children',
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      offset: number
    }
  ): void
  (
    event: 'request-more-children',
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      loaded: number
    }
  ): void
}
