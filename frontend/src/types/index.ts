/**
 * AcuityBookmarks 类型定义
 * 统一的类型系统，消除any类型使用
 */

// === Chrome API 相关类型 ===
export interface ChromeBookmarkTreeNode {
  id: string // 书签节点ID
  title: string // 书签标题
  url?: string // 书签URL（文件夹节点为空）
  parentId?: string // 父文件夹ID（根文件夹为空）
  index?: number // 子项索引（同级排序）
  dateAdded?: number // 创建时间（毫秒级时间戳）
  children?: ChromeBookmarkTreeNode[] // 子项（文件夹节点）
  expanded?: boolean // 扩展字段：文件夹展开状态
  uniqueId?: string // 扩展字段：唯一标识符
  syncing?: boolean // Chrome扩展同步字段
  [key: string]: unknown // 允许额外属性以兼容BookmarkNode
}

export interface BookmarkCreateDetails {
  parentId?: string // 父文件夹ID（根文件夹为空）
  index?: number // 子项索引（同级排序）
  title?: string // 书签标题
  url?: string // 书签URL（文件夹节点为空）
}

export interface BookmarkDestination {
  parentId?: string // 目标父文件夹ID（根文件夹为空）
  index?: number // 目标子项索引（同级排序）
}

export interface BookmarkUpdateDetails {
  title?: string // 更新后的书签标题
  url?: string // 更新后的书签URL（文件夹节点为空）
}

// === 书签节点类型 ===
import type { CleanupProblem } from './cleanup'

// 使用交叉类型而非继承，避免对 chrome.bookmarks.BookmarkTreeNode 的强绑定，
// 同时覆盖 children 的类型并放宽可选扩展字段（如 syncing）。
export type BookmarkNode = Omit<
  chrome.bookmarks.BookmarkTreeNode,
  'children' | 'syncing'
> & {
  children?: BookmarkNode[]
  syncing?: boolean
  // 扩展Chrome的BookmarkTreeNode
  path?: string[] // 完整路径
  pathString?: string // 路径字符串
  pathIds?: Array<string | number> // 节点ID路径 （用于快速定位）
  tags?: string[] // 标签（用户自定义）
  level?: number // 节点层级（根为0）
  domain?: string // 域名（文件夹节点为空）
  favicon?: string // 图标URL（文件夹节点为空）
  visits?: number // 访问次数（文件夹节点为空）
  lastVisit?: number // 最后访问时间（毫秒级时间戳）
  score?: number // 相关性得分（用于排序）
  isFolder?: boolean // 是否是文件夹
  expanded?: boolean // 是否展开（UI状态）
  selected?: boolean // 是否选中（UI状态）
  modified?: boolean // 是否被修改（仅用于比较）
  childrenCount?: number
  bookmarksCount?: number // 子孙书签总数
  _childrenLoaded?: boolean // 是否已加载全部子节点

  // 🎯 清理功能：问题标记
  _cleanupProblems?: CleanupProblem[] // 节点的清理问题列表

  [key: string]: unknown // 允许额外属性
}

export type BookmarkChildrenIndex = Map<string, BookmarkNode[]>
export type BookmarkNodeMap = Map<string, BookmarkNode>

export interface ProposalNode {
  id: string // 提案节点ID
  title: string // 提案标题
  url?: string // 提案URL（文件夹节点为空）
  children?: ProposalNode[] // 子项（文件夹节点）
  parentId?: string // 父文件夹ID（根文件夹为空）
  index?: number // 子项索引（同级排序）
  dateAdded?: number // 创建时间（毫秒级时间戳）
}

// === 书签操作相关类型 ===
export interface BookmarkEditData {
  id: string // 书签节点ID
  title: string // 更新后的书签标题
  url: string // 更新后的书签URL（文件夹节点为空）
  parentId?: string // 目标父文件夹ID（根文件夹为空）
}

export interface AddItemData {
  type: 'folder' | 'bookmark' // 新增项类型
  title: string // 新增项标题
  url?: string // 新增项URL（书签节点为空）
  parentId?: string // 目标父文件夹ID（根文件夹为空）
}

export type BookmarkHoverPayload =
  | {
      id?: string | null
      node?: BookmarkNode
      isOriginal?: boolean
      [key: string]: unknown // 允许额外属性
    }
  | null
  | undefined

export interface FolderToggleData {
  nodeId: string // 文件夹节点ID
  isOriginal?: boolean // 是否原始节点（用于区分提案和实际书签）
}

// === 事件处理类型 ===
export interface BookmarkDeletePayload {
  node: BookmarkNode
  isOriginal?: boolean // 是否原始节点（用于区分提案和实际书签）
}

export interface BookmarkEditPayload {
  node: BookmarkNode
  isOriginal?: boolean // 是否原始节点（用于区分提案和实际书签）
}

// ReorderEvent 已移除（拖拽排序功能废弃）

// AnalysisData 和 ApplicationStrategy 接口已移除 - 复杂度分析功能已废弃

// === 搜索相关类型 ===
export interface SearchResult {
  id: string // 搜索结果节点ID
  title: string // 搜索结果标题
  url: string // 搜索结果URL（文件夹节点为空）
  path?: string[] // 搜索结果路径（用于显示层级）
}

export interface SearchOptions {
  query: string // 搜索查询字符串
  limit?: number // 结果数量限制（默认10）
  includeContent?: boolean // 是否包含内容搜索（默认false）
}

// === 性能监控类型 ===
export interface PerformanceMetadata {
  [key: string]: string | number | boolean | undefined
}

export interface PerformanceMetric {
  operation: string // 操作名称（如'loadTree', 'search'等）
  startTime: number // 开始时间（毫秒级时间戳）
  endTime?: number // 结束时间（毫秒级时间戳）
  duration?: number // 持续时间（毫秒）
  metadata?: PerformanceMetadata // 额外性能数据
}

export interface UserActionData {
  action: string // 用户操作名称（如'click', 'drag'等）
  metadata?: PerformanceMetadata // 额外操作数据
  timestamp: number // 操作时间（毫秒级时间戳）
}

export interface MemoryUsage {
  usedJSHeapSize?: number // 当前使用的JS堆内存（字节）
  totalJSHeapSize?: number // 总JS堆内存限制（字节）
  jsHeapSizeLimit?: number // JS堆内存限制（字节）
}

export interface PerformanceSummary {
  [key: string]: string | number | boolean | PerformanceMetric[] | undefined // 性能摘要数据
}

// === 错误处理类型 ===
export interface ErrorMetadata {
  [key: string]: string | number | boolean | undefined // 错误相关元数据
}

export interface ValidationResult {
  isValid: boolean // 是否验证通过
  errors: string[] // 验证错误消息列表
}

// === Storage 相关类型 ===
export interface StorageData {
  [key: string]: unknown // 允许额外属性
  originalTree?: ChromeBookmarkTreeNode[]
  aiProposal?: ProposalNode
  newProposal?: ProposalNode | Record<string, unknown> // 兼容旧版本格式
  isGenerating?: boolean
}

export interface CacheStatus {
  isFromCache: boolean // 是否从缓存加载
  lastUpdate: number | null // 最后更新时间（毫秒级时间戳）
  dataAge: number | null // 数据年龄（毫秒）
}

export interface DuplicateInfo {
  folders?: string[] // 重复文件夹ID列表
  bookmarks?: string[] // 重复书签ID列表
  message?: string // 重复检测消息（如'存在重复文件夹'）
}

// === UI 相关类型 ===
export interface NotificationOptions {
  text: string // 通知文本内容
  color?: 'info' | 'success' | 'warning' | 'error' // 通知颜色（默认'info'）
  duration?: number // 通知显示时间（毫秒，默认3000）
}

export interface DialogState {
  isOpen: boolean // 是否打开对话框
  data?: unknown // 对话框数据（可选）
}

export type FormRef = {
  validate: () => boolean | { valid: boolean } // 表单验证函数，返回是否有效
  reset: () => void // 重置表单数据和验证状态
  resetValidation?: () => void // 重置验证状态（可选）
} | null

// === 工具函数类型 ===
export type DebounceFunction<T extends (...args: unknown[]) => unknown> = T & {
  cancel(): void // 取消防抖调用
  flush(): void // 立即执行最后一次调用
}

export type ThrottleFunction<T extends (...args: unknown[]) => unknown> = T & {
  cancel(): void // 取消节流调用
}

// === Vue 组件 Props 类型 ===
export interface BookmarkTreeProps {
  nodes: BookmarkNode[] // 书签树节点列表
  expandedFolders: Set<string> // 展开的文件夹ID集合
  hoveredBookmarkId: string | null // 当前悬停的书签ID（null表示无悬停）
  isOriginal: boolean // 是否显示原始书签（而不是提案）
  isTopLevel?: boolean // 是否为顶级书签树（默认true）
}

export interface BookmarkItemProps {
  node: BookmarkNode // 书签节点
  hoveredBookmarkId?: string | null // 当前悬停的书签ID（可选）
  isOriginal?: boolean // 是否显示原始书签（而不是提案）（可选）
  expandedFolders?: Set<string> // 展开的文件夹ID集合（可选）
}

export interface FolderItemProps {
  node: BookmarkNode // 文件夹节点
  isProposal?: boolean // 是否为提案文件夹（可选）
  isOriginal?: boolean // 是否显示原始书签（而不是提案）（可选）
  expandedFolders: Set<string> // 展开的文件夹ID集合
  hoveredBookmarkId?: string | null // 当前悬停的书签ID（可选）
}

// === 排序相关类型 ===
// SortableOptions 已移除（拖拽排序功能废弃）

// === 类型守护函数 ===
export function isBookmarkNode(obj: unknown): obj is BookmarkNode {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj &&
    typeof (obj as BookmarkNode).id === 'string'
  )
}

export function isChromeBookmarkTreeNode(
  obj: unknown
): obj is ChromeBookmarkTreeNode {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj &&
    typeof (obj as ChromeBookmarkTreeNode).id === 'string'
  )
}

export function isBookmarkArray(arr: unknown): arr is BookmarkNode[] {
  return Array.isArray(arr) && arr.every(isBookmarkNode)
}

export function isSearchResult(obj: unknown): obj is SearchResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj &&
    'url' in obj &&
    typeof (obj as SearchResult).id === 'string' &&
    typeof (obj as SearchResult).title === 'string' &&
    typeof (obj as SearchResult).url === 'string'
  )
}
