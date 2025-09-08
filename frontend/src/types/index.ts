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
export interface BookmarkNode {
  id: string
  title: string
  url?: string
  parentId?: string
  index?: number
  dateAdded?: number
  children?: BookmarkNode[]
  expanded?: boolean
  uniqueId?: string
  faviconUrl?: string // favicon URL
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

export type BookmarkHoverPayload = {
  id?: string | null
  node?: BookmarkNode
  isOriginal?: boolean
  [key: string]: unknown // 允许额外属性
} | null | undefined

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

export interface ReorderEvent {
  oldIndex: number
  newIndex: number
  item: HTMLElement
}

export interface AnalysisData {
  stats: {
    originalTotal: number
    proposedTotal: number
    originalBookmarks: number
    proposedBookmarks: number
    originalFolders: number
    proposedFolders: number
    specialFoldersCount: number
  }
  operations: {
    bookmarksToCreate: number
    foldersToCreate: number
    bookmarksToDelete: number
    foldersToDelete: number
    bookmarksToRename: number
    foldersToRename: number
    bookmarksToUpdateUrl: number
    bookmarksToMove: number
    foldersToMove: number
    structureReorganization: number
    deepFolderChanges: number
  }
  changes: {
    created: BookmarkNode[]
    deleted: BookmarkNode[]
    renamed: Array<{ original: BookmarkNode; proposed: BookmarkNode; type: string }>
    moved: Array<{ original: BookmarkNode; proposed: BookmarkNode; type: string }>
    urlChanged: Array<{ original: BookmarkNode; proposed: BookmarkNode; type: string }>
  }
}

export interface ApplicationStrategy {
  strategy: 'no-change' | 'minor-update' | 'incremental' | 'full-rebuild'
  reason: string
  complexityScore: number
  totalOperations: number
  estimatedTime: number
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  changePercentage: number
  apiCalls: number
}

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
  isSortable?: boolean
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
export interface SortableOptions {
  onEnd: (event: ReorderEvent) => void
  disabled?: boolean
  animation?: number
  ghostClass?: string
  chosenClass?: string
  dragClass?: string
}

// === 类型守护函数 ===
export function isBookmarkNode(obj: unknown): obj is BookmarkNode {
  return typeof obj === 'object' && obj !== null && 
         'id' in obj && 'title' in obj && typeof (obj as BookmarkNode).id === 'string'
}

export function isChromeBookmarkTreeNode(obj: unknown): obj is ChromeBookmarkTreeNode {
  return typeof obj === 'object' && obj !== null && 
         'id' in obj && 'title' in obj && typeof (obj as ChromeBookmarkTreeNode).id === 'string'
}

export function isBookmarkArray(arr: unknown): arr is BookmarkNode[] {
  return Array.isArray(arr) && arr.every(isBookmarkNode)
}

export function isSearchResult(obj: unknown): obj is SearchResult {
  return typeof obj === 'object' && obj !== null &&
         'id' in obj && 'title' in obj && 'url' in obj &&
         typeof (obj as SearchResult).id === 'string' &&
         typeof (obj as SearchResult).title === 'string' &&
         typeof (obj as SearchResult).url === 'string'
}