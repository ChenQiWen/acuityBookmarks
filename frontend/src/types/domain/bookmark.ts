/**
 * 书签领域通用类型。
 */
import type { CleanupProblem } from './cleanup'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'

/**
 * Chrome API 原始书签结构（保持最小字段）。
 */
export interface ChromeBookmarkTreeNode {
  /** 节点 ID（Chrome 分配） */
  id: string
  /** 父节点 ID */
  parentId?: string
  /** 同父节点下的顺序索引 */
  index?: number
  /** 节点标题 */
  title: string
  /** 书签 URL，文件夹为空 */
  url?: string
  /** 创建时间 */
  dateAdded?: number
  /** 文件夹内容变更时间 */
  dateGroupModified?: number
  /** 最后修改时间 */
  dateModified?: number
  /** 子节点（仅文件夹存在） */
  children?: ChromeBookmarkTreeNode[]
  /** 受保护标记，如书签栏、其他书签等 */
  unmodifiable?: string
}

/**
 * 统一的书签树节点。
 *
 * 提供 UI 层常用的附加字段，并保持与 Chrome 数据兼容。
 */
export interface BookmarkNode
  extends Omit<ChromeBookmarkTreeNode, 'children' | 'unmodifiable'> {
  /** 子节点列表 */
  children?: BookmarkNode[]
  /** 子节点数量（已加载） */
  childrenCount?: number
  /** 实际书签数量（包含子孙） */
  bookmarksCount?: number
  /** 逐层路径（节点名数组） */
  path?: string[]
  /** 路径字符串形式（`/` 分隔） */
  pathString?: string
  /** 路径 ID 列表 */
  pathIds?: Array<string | number>
  /** 自定义标签 */
  tags?: string[]
  /** 节点层级，从 0 开始 */
  level?: number
  /** 提取的域名信息 */
  domain?: string
  /** Favicon 地址 */
  favicon?: string
  /** 访问次数 */
  visits?: number
  /** 最后访问时间戳 */
  lastVisit?: number
  /** 评分或检索相关度 */
  score?: number
  /** 是否是文件夹（兼容旧逻辑） */
  isFolder?: boolean
  /** UI 展开状态 */
  expanded?: boolean
  /** UI 选中状态 */
  selected?: boolean
  /** 是否被修改过 */
  modified?: boolean
  /** 子节点是否已加载完成 */
  _childrenLoaded?: boolean
  /** 清理问题列表（若存在） */
  _cleanupProblems?: CleanupProblem[]
  /** 健康标签，例如 404/duplicate 等 */
  healthTags?: string[]
  [key: string]: unknown
}

/** IndexedDB 中缓存的书签记录。 */
export type { BookmarkRecord }

/** 父节点到其子节点数组的索引。 */
export type BookmarkChildrenIndex = Map<string, BookmarkNode[]>
/** 根据节点 ID 建立的映射。 */
export type BookmarkNodeMap = Map<string, BookmarkNode>

/** 提案树节点（右侧编辑面板/AI 提案）。 */
export interface ProposalNode {
  /** 节点 ID */
  id: string
  /** 节点标题 */
  title: string
  /** 书签 URL */
  url?: string
  /** 子节点列表 */
  children?: ProposalNode[]
  /** 父节点 ID */
  parentId?: string
  /** 排序索引 */
  index?: number
  /** 创建时间 */
  dateAdded?: number
}

/** 书签编辑弹窗所需的数据。 */
export interface BookmarkEditData {
  /** 节点 ID */
  id: string
  /** 标题 */
  title: string
  /** URL */
  url: string
  /** 父节点 ID */
  parentId?: string
}

/** 新增书签/文件夹时的表单数据。 */
export interface AddItemData {
  /** 节点类型 */
  type: 'folder' | 'bookmark'
  /** 标题 */
  title: string
  /** URL，文件夹置空 */
  url?: string
  /** 父节点 ID */
  parentId?: string
}

/** 鼠标悬停事件载荷。 */
export interface BookmarkHoverPayload {
  /** 节点 ID */
  id?: string | null
  /** 对应节点数据 */
  node?: BookmarkNode
  /** 是否来自原始树 */
  isOriginal?: boolean
  [key: string]: unknown
}

/** 文件夹展开/折叠事件载荷。 */
export interface FolderToggleData {
  /** 文件夹 ID */
  nodeId: string
  /** 是否来自原始树 */
  isOriginal?: boolean
}

/** 删除操作事件载荷。 */
export interface BookmarkDeletePayload {
  /** 目标节点 */
  node: BookmarkNode
  /** 是否来自原始树 */
  isOriginal?: boolean
}

/** 编辑操作事件载荷。 */
export interface BookmarkEditPayload {
  /** 目标节点 */
  node: BookmarkNode
  /** 是否来自原始树 */
  isOriginal?: boolean
}

/** BookmarkTree 组件的最小 Props。 */
export interface BookmarkTreeProps {
  /** 节点列表 */
  nodes: BookmarkNode[]
  /** 已展开文件夹 */
  expandedFolders: Set<string>
  /** 当前悬停节点 ID */
  hoveredBookmarkId: string | null
  /** 是否展示原始树 */
  isOriginal: boolean
  /** 是否处于顶层 */
  isTopLevel?: boolean
}

/** 单个书签项组件用到的 Props。 */
export interface BookmarkItemProps {
  /** 节点数据 */
  node: BookmarkNode
  /** 悬停节点 ID */
  hoveredBookmarkId?: string | null
  /** 是否来自原始树 */
  isOriginal?: boolean
  /** 已展开文件夹列表 */
  expandedFolders?: Set<string>
}

/** 文件夹项组件 Props。 */
export interface FolderItemProps {
  /** 节点数据 */
  node: BookmarkNode
  /** 是否处于提案模式 */
  isProposal?: boolean
  /** 是否来自原始树 */
  isOriginal?: boolean
  /** 已展开文件夹列表 */
  expandedFolders: Set<string>
  /** 悬停节点 ID */
  hoveredBookmarkId?: string | null
}

/** 类型守卫：检查对象是否为 BookmarkNode。 */
export function isBookmarkNode(obj: unknown): obj is BookmarkNode {
  if (!obj || typeof obj !== 'object') return false
  const candidate = obj as BookmarkNode
  return typeof candidate.id === 'string' && typeof candidate.title === 'string'
}

/** 类型守卫：检查数组是否为 BookmarkNode[]。 */
export function isBookmarkArray(arr: unknown): arr is BookmarkNode[] {
  return Array.isArray(arr) && arr.every(isBookmarkNode)
}

/** 类型守卫：检查对象是否为 ChromeBookmarkTreeNode。 */
export function isChromeBookmarkTreeNode(
  obj: unknown
): obj is ChromeBookmarkTreeNode {
  if (!obj || typeof obj !== 'object') return false
  const candidate = obj as ChromeBookmarkTreeNode
  return typeof candidate.id === 'string' && typeof candidate.title === 'string'
}
