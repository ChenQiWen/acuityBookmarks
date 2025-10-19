/**
 * 书签领域模型
 *
 * 定义书签的核心业务概念和规则
 *
 * 注意：类型定义已迁移至 @/types/domain/bookmark
 * 本文件保留类型定义是为了向后兼容和业务逻辑函数的使用
 */

/**
 * 书签节点接口
 *
 * 表示书签树中的单个节点，可以是文件夹或书签
 */
export interface BookmarkNode {
  /** 书签唯一标识符 */
  id: string
  /** 书签标题 */
  title: string
  /** 书签URL（文件夹时为 undefined） */
  url?: string
  /** 父节点ID */
  parentId?: string
  /** 在父节点中的位置索引 */
  index?: number
  /** 子节点列表（仅文件夹） */
  children?: BookmarkNode[]
  /** 子节点数量 */
  childrenCount?: number
  /** 创建时间戳 */
  dateAdded?: number
  /** 文件夹修改时间戳 */
  dateGroupModified?: number
  /** 从根到当前节点的路径ID数组 */
  pathIds?: Array<string | number>
  /** 子节点是否已加载的内部标记 */
  _childrenLoaded?: boolean
  /** 允许额外属性以兼容扩展字段 */
  [key: string]: unknown
}

/**
 * 书签文件夹接口
 *
 * 继承自 BookmarkNode，明确约束文件夹特有属性
 */
export interface BookmarkFolder extends BookmarkNode {
  /** 文件夹没有URL */
  url: undefined
  /** 文件夹必须有子节点列表 */
  children: BookmarkNode[]
  /** 文件夹必须有子节点计数 */
  childrenCount: number
}

/**
 * 书签项接口
 *
 * 继承自 BookmarkNode，明确约束书签特有属性
 */
export interface BookmarkItem extends BookmarkNode {
  /** 书签必须有URL */
  url: string
  /** 书签没有子节点 */
  children: undefined
  /** 书签没有子节点计数 */
  childrenCount: undefined
}

/**
 * 书签类型枚举
 */
export type BookmarkType = 'folder' | 'bookmark'

/**
 * 判断节点是否为文件夹
 *
 * @param node - 待检查的书签节点
 * @returns 如果是文件夹返回 true，否则返回 false
 */
export function isBookmarkFolder(node: BookmarkNode): node is BookmarkFolder {
  return !node.url && Array.isArray(node.children)
}

/**
 * 判断节点是否为书签项
 *
 * @param node - 待检查的书签节点
 * @returns 如果是书签项返回 true，否则返回 false
 */
export function isBookmarkItem(node: BookmarkNode): node is BookmarkItem {
  return typeof node.url === 'string'
}

/**
 * 获取书签节点的类型
 *
 * @param node - 书签节点
 * @returns 返回 'folder' 或 'bookmark'
 */
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
