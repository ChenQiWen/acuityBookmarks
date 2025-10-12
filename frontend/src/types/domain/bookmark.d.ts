/**
 * 书签领域类型定义
 *
 * 包含书签相关的所有类型定义
 */

import type { ID, Timestamp } from '../core/common'

/**
 * 书签节点接口
 *
 * 表示书签树中的一个节点，可以是书签或文件夹
 *
 * @example
 * ```typescript
 * const bookmark: BookmarkNode = {
 *   id: '1',
 *   title: '示例书签',
 *   url: 'https://example.com',
 *   parentId: '0',
 *   index: 0,
 *   dateAdded: Date.now()
 * }
 * ```
 */
export interface BookmarkNode {
  /** 唯一标识符 */
  id: ID

  /** 显示标题 */
  title: string

  /** 书签URL（文件夹为空） */
  url?: string

  /** 父节点ID */
  parentId?: ID

  /** 节点索引（在父节点中的位置） */
  index?: number

  /** 创建时间戳 */
  dateAdded?: Timestamp

  /** 最后修改时间戳 */
  dateModified?: Timestamp

  /** 子节点列表 */
  children?: BookmarkNode[]

  /** 子节点数量 */
  childrenCount?: number

  /** 是否为文件夹 */
  isFolder?: boolean

  /** 子节点是否已加载 */
  _childrenLoaded?: boolean
}

/**
 * Chrome 书签树节点
 *
 * Chrome API 返回的书签节点格式
 */
export interface ChromeBookmarkTreeNode {
  /** 节点ID */
  id: string

  /** 父节点ID */
  parentId?: string

  /** 节点索引 */
  index?: number

  /** 节点标题 */
  title: string

  /** 节点URL */
  url?: string

  /** 创建时间 */
  dateAdded?: number

  /** 修改时间 */
  dateGroupModified?: number

  /** 子节点 */
  children?: ChromeBookmarkTreeNode[]

  /** 是否未编辑 */
  unmodifiable?: string
}

/**
 * 书签记录
 *
 * IndexedDB 中存储的书签记录
 */
export interface BookmarkRecord {
  /** 书签ID */
  id: ID

  /** 父节点ID */
  parentId?: ID

  /** 节点索引 */
  index?: number

  /** 标题 */
  title: string

  /** 标题（小写，用于搜索） */
  titleLower: string

  /** URL */
  url?: string

  /** URL（小写，用于搜索） */
  urlLower?: string

  /** 域名 */
  domain?: string

  /** 关键词列表 */
  keywords?: string[]

  /** 路径（面包屑） */
  path?: string[]

  /** 路径字符串 */
  pathString?: string

  /** 创建时间 */
  dateAdded?: Timestamp

  /** 修改时间 */
  dateModified?: Timestamp

  /** 是否为文件夹 */
  isFolder?: boolean

  /** 子节点数量 */
  childrenCount?: number

  /** 图标URL */
  iconUrl?: string

  /** 标签 */
  tags?: string[]

  /** 笔记 */
  notes?: string
}

/**
 * 书签树
 *
 * 完整的书签树结构
 */
export interface BookmarkTree {
  /** 根节点列表 */
  roots: BookmarkNode[]

  /** 所有节点映射（ID -> 节点） */
  nodes: Map<ID, BookmarkNode>

  /** 总节点数 */
  totalCount: number

  /** 书签数量 */
  bookmarkCount: number

  /** 文件夹数量 */
  folderCount: number

  /** 最后更新时间 */
  lastUpdated: Timestamp
}

/**
 * 书签映射
 *
 * ID到书签节点的映射
 */
export type BookmarkMapping = Map<ID, BookmarkNode>

/**
 * 书签变更类型
 *
 * 书签可能发生的变更类型
 */
export enum BookmarkChangeType {
  /** 创建 */
  CREATED = 'CREATED',
  /** 更新 */
  UPDATED = 'UPDATED',
  /** 删除 */
  REMOVED = 'REMOVED',
  /** 移动 */
  MOVED = 'MOVED',
  /** 重排序 */
  REORDERED = 'REORDERED'
}

/**
 * 书签变更事件
 *
 * 书签变更的事件数据
 */
export interface BookmarkChangeEvent {
  /** 变更类型 */
  type: BookmarkChangeType

  /** 书签ID */
  id: ID

  /** 书签节点（创建/更新时） */
  node?: BookmarkNode

  /** 变更内容（更新时） */
  changes?: Partial<BookmarkNode>

  /** 旧父节点ID（移动时） */
  oldParentId?: ID

  /** 新父节点ID（移动时） */
  newParentId?: ID

  /** 旧索引（移动/重排序时） */
  oldIndex?: number

  /** 新索引（移动/重排序时） */
  newIndex?: number

  /** 时间戳 */
  timestamp: Timestamp
}

/**
 * 书签过滤选项
 *
 * 过滤书签的条件
 */
export interface BookmarkFilterOptions {
  /** 仅文件夹 */
  foldersOnly?: boolean

  /** 仅书签 */
  bookmarksOnly?: boolean

  /** 域名过滤 */
  domains?: string[]

  /** 标签过滤 */
  tags?: string[]

  /** 日期范围 */
  dateRange?: {
    start?: Timestamp
    end?: Timestamp
  }

  /** 排序字段 */
  sortBy?: 'title' | 'dateAdded' | 'dateModified' | 'url'

  /** 排序顺序 */
  sortOrder?: 'asc' | 'desc'

  /** 限制数量 */
  limit?: number

  /** 偏移量 */
  offset?: number
}

/**
 * 书签统计信息
 *
 * 书签相关的统计数据
 */
export interface BookmarkStats {
  /** 总书签数 */
  totalBookmarks: number

  /** 总文件夹数 */
  totalFolders: number

  /** 总节点数 */
  totalNodes: number

  /** 按域名分组的统计 */
  byDomain?: Map<string, number>

  /** 按标签分组的统计 */
  byTag?: Map<string, number>

  /** 平均层级深度 */
  averageDepth?: number

  /** 最大层级深度 */
  maxDepth?: number

  /** 空文件夹数量 */
  emptyFolders?: number

  /** 重复URL数量 */
  duplicateUrls?: number
}

/**
 * 书签导出格式
 *
 * 支持的书签导出格式
 */
export enum BookmarkExportFormat {
  /** HTML格式 */
  HTML = 'HTML',
  /** JSON格式 */
  JSON = 'JSON',
  /** Markdown格式 */
  MARKDOWN = 'MARKDOWN',
  /** CSV格式 */
  CSV = 'CSV'
}

/**
 * 书签导出选项
 *
 * 导出书签的配置选项
 */
export interface BookmarkExportOptions {
  /** 导出格式 */
  format: BookmarkExportFormat

  /** 是否包含子文件夹 */
  includeSubfolders?: boolean

  /** 是否包含图标 */
  includeIcons?: boolean

  /** 是否包含笔记 */
  includeNotes?: boolean

  /** 起始节点ID */
  startNodeId?: ID

  /** 文件名 */
  filename?: string
}

/**
 * 书签导入结果
 *
 * 导入书签的结果信息
 */
export interface BookmarkImportResult {
  /** 成功导入数量 */
  success: number

  /** 失败数量 */
  failed: number

  /** 跳过数量（重复） */
  skipped: number

  /** 总处理数量 */
  total: number

  /** 错误列表 */
  errors: Array<{
    line?: number
    message: string
    data?: unknown
  }>

  /** 导入的节点ID列表 */
  importedIds: ID[]
}
