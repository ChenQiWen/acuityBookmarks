/**
 * AcuityBookmarks 类型定义
 * 统一的类型系统，消除any类型使用
 */

// === Chrome API 相关类型 ===
export interface ChromeBookmarkTreeNode {
  id: string
  title: string
  url?: string
  parentId?: string
  index?: number
  dateAdded?: number
  children?: ChromeBookmarkTreeNode[]
  expanded?: boolean // 扩展字段：文件夹展开状态
  uniqueId?: string // 扩展字段：唯一标识符
  syncing?: boolean // Chrome扩展同步字段
  [key: string]: unknown // 允许额外属性以兼容BookmarkNode
}

export interface BookmarkCreateDetails {
  parentId?: string
  index?: number
  title?: string
  url?: string
}

export interface BookmarkDestination {
  parentId?: string
  index?: number
}

export interface BookmarkUpdateDetails {
  title?: string
  url?: string
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
  level?: number // 节点层级
  domain?: string // 域名
  favicon?: string // 图标
  visits?: number // 访问次数
  lastVisit?: number // 最后访问时间
  score?: number // 相关性得分
  isFolder?: boolean // 是否是文件夹
  expanded?: boolean // 是否展开（UI状态）
  selected?: boolean // 是否选中（UI状态）
  modified?: boolean // 是否被修改（仅用于比较）
  childrenCount?: number

  // 🎯 清理功能：问题标记
  _cleanupProblems?: CleanupProblem[] // 节点的清理问题列表

  [key: string]: unknown // 允许额外属性
}

export interface ProposalNode {
  id: string
  title: string
  url?: string
  children?: ProposalNode[]
  parentId?: string
  index?: number
  dateAdded?: number
}

// === 书签操作相关类型 ===
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
  nodeId: string
  isOriginal?: boolean
}

// === 事件处理类型 ===
export interface BookmarkDeletePayload {
  node: BookmarkNode
  isOriginal?: boolean
}

export interface BookmarkEditPayload {
  node: BookmarkNode
}

// ReorderEvent 已移除（拖拽排序功能废弃）

// AnalysisData 和 ApplicationStrategy 接口已移除 - 复杂度分析功能已废弃

// === 搜索相关类型 ===
export interface SearchResult {
  id: string
  title: string
  url: string
  path?: string[]
}

export interface SearchOptions {
  query: string
  limit?: number
  includeContent?: boolean
}

// === 性能监控类型 ===
export interface PerformanceMetadata {
  [key: string]: string | number | boolean | undefined
}

export interface PerformanceMetric {
  operation: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: PerformanceMetadata
}

export interface UserActionData {
  action: string
  metadata?: PerformanceMetadata
  timestamp: number
}

export interface MemoryUsage {
  usedJSHeapSize?: number
  totalJSHeapSize?: number
  jsHeapSizeLimit?: number
}

export interface PerformanceSummary {
  [key: string]: string | number | boolean | PerformanceMetric[] | undefined
}

// === 错误处理类型 ===
export interface ErrorMetadata {
  [key: string]: string | number | boolean | undefined
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

// === Storage 相关类型 ===
export interface StorageData {
  [key: string]: unknown
  originalTree?: ChromeBookmarkTreeNode[]
  aiProposal?: ProposalNode
  newProposal?: ProposalNode | Record<string, unknown> // 兼容旧版本格式
  isGenerating?: boolean
}

export interface CacheStatus {
  isFromCache: boolean
  lastUpdate: number | null
  dataAge: number | null
}

export interface DuplicateInfo {
  folders?: string[]
  bookmarks?: string[]
  message?: string
}

// === UI 相关类型 ===
export interface NotificationOptions {
  text: string
  color?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

export interface DialogState {
  isOpen: boolean
  data?: unknown
}

export type FormRef = {
  validate: () => boolean | { valid: boolean }
  reset: () => void
  resetValidation?: () => void
} | null

// === 工具函数类型 ===
export type DebounceFunction<T extends (...args: unknown[]) => unknown> = T & {
  cancel(): void
  flush(): void
}

export type ThrottleFunction<T extends (...args: unknown[]) => unknown> = T & {
  cancel(): void
}

// === Vue 组件 Props 类型 ===
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
