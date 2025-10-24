import type { CleanupProblem } from './cleanup'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'

/** Chrome API 原始书签结构（保持最小字段） */
export interface ChromeBookmarkTreeNode {
  id: string
  parentId?: string
  index?: number
  title: string
  url?: string
  dateAdded?: number
  dateGroupModified?: number
  children?: ChromeBookmarkTreeNode[]
  unmodifiable?: string
}

/** 核心书签节点：UI / 应用层统一使用 */
export interface BookmarkNode
  extends Omit<ChromeBookmarkTreeNode, 'children' | 'unmodifiable'> {
  children?: BookmarkNode[]
  childrenCount?: number
  bookmarksCount?: number
  path?: string[]
  pathString?: string
  pathIds?: Array<string | number>
  tags?: string[]
  level?: number
  domain?: string
  favicon?: string
  visits?: number
  lastVisit?: number
  score?: number
  isFolder?: boolean
  expanded?: boolean
  selected?: boolean
  modified?: boolean
  _childrenLoaded?: boolean
  _cleanupProblems?: CleanupProblem[]
  [key: string]: unknown
}

/** IndexedDB 扁平记录（扩展字段较多） */
export type { BookmarkRecord }

export type BookmarkChildrenIndex = Map<string, BookmarkNode[]>
export type BookmarkNodeMap = Map<string, BookmarkNode>

export interface ProposalNode {
  id: string
  title: string
  url?: string
  children?: ProposalNode[]
  parentId?: string
  index?: number
  dateAdded?: number
}

export interface BookmarkEditData {
  id: string
  title: string
  url: string
  parentId?: string
}

export interface AddItemData {
  type: 'folder' | 'bookmark'
  title: string
  url?: string
  parentId?: string
}

export interface BookmarkHoverPayload {
  id?: string | null
  node?: BookmarkNode
  isOriginal?: boolean
  [key: string]: unknown
}

export interface FolderToggleData {
  nodeId: string
  isOriginal?: boolean
}

export interface BookmarkDeletePayload {
  node: BookmarkNode
  isOriginal?: boolean
}

export interface BookmarkEditPayload {
  node: BookmarkNode
  isOriginal?: boolean
}

export interface BookmarkTreeProps {
  nodes: BookmarkNode[]
  expandedFolders: Set<string>
  hoveredBookmarkId: string | null
  isOriginal: boolean
  isTopLevel?: boolean
}

export interface BookmarkItemProps {
  node: BookmarkNode
  hoveredBookmarkId?: string | null
  isOriginal?: boolean
  expandedFolders?: Set<string>
}

export interface FolderItemProps {
  node: BookmarkNode
  isProposal?: boolean
  isOriginal?: boolean
  expandedFolders: Set<string>
  hoveredBookmarkId?: string | null
}

export function isBookmarkNode(obj: unknown): obj is BookmarkNode {
  if (!obj || typeof obj !== 'object') return false
  const candidate = obj as BookmarkNode
  return typeof candidate.id === 'string' && typeof candidate.title === 'string'
}

export function isBookmarkArray(arr: unknown): arr is BookmarkNode[] {
  return Array.isArray(arr) && arr.every(isBookmarkNode)
}

export function isChromeBookmarkTreeNode(
  obj: unknown
): obj is ChromeBookmarkTreeNode {
  if (!obj || typeof obj !== 'object') return false
  const candidate = obj as ChromeBookmarkTreeNode
  return typeof candidate.id === 'string' && typeof candidate.title === 'string'
}
