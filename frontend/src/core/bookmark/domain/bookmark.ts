/**
 * 书签领域模型
 *
 * 定义书签的核心业务概念和规则
 *
 * 注意：类型定义已迁移至 @/types/domain/bookmark
 * 本文件保留类型定义是为了向后兼容和业务逻辑函数的使用
 */

export interface BookmarkNode {
  id: string
  title: string
  url?: string
  parentId?: string
  index?: number
  children?: BookmarkNode[]
  childrenCount?: number
  dateAdded?: number
  dateGroupModified?: number
  pathIds?: Array<string | number>
  _childrenLoaded?: boolean
}

export interface BookmarkFolder extends BookmarkNode {
  url: undefined
  children: BookmarkNode[]
  childrenCount: number
}

export interface BookmarkItem extends BookmarkNode {
  url: string
  children: undefined
  childrenCount: undefined
}

export type BookmarkType = 'folder' | 'bookmark'

export function isBookmarkFolder(node: BookmarkNode): node is BookmarkFolder {
  return !node.url && Array.isArray(node.children)
}

export function isBookmarkItem(node: BookmarkNode): node is BookmarkItem {
  return typeof node.url === 'string'
}

export function getBookmarkType(node: BookmarkNode): BookmarkType {
  return isBookmarkFolder(node) ? 'folder' : 'bookmark'
}

/**
 * 书签操作类型
 */
export type BookmarkOperation =
  | 'create'
  | 'update'
  | 'delete'
  | 'move'
  | 'reorder'

/**
 * 书签变更事件
 */
export interface BookmarkChangeEvent {
  type: BookmarkOperation
  node: BookmarkNode
  oldParentId?: string
  newParentId?: string
  oldIndex?: number
  newIndex?: number
  timestamp: number
}

/**
 * 书签搜索选项
 */
export interface BookmarkSearchOptions {
  query: string
  includeFolders?: boolean
  includeUrls?: boolean
  caseSensitive?: boolean
  maxResults?: number
}

/**
 * 书签搜索结果
 */
export interface BookmarkSearchResult {
  node: BookmarkNode
  score: number
  matchedFields: string[]
  path: string[]
}
