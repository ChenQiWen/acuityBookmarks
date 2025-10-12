/**
 * Store 类型定义
 *
 * 包含 Pinia Store 相关的所有类型定义
 */

import type { ID, Timestamp } from '../core/common'
import type { AppError } from '../core/error'
import type { BookmarkNode } from '../domain/bookmark'

/**
 * Store 加载状态接口
 *
 * 管理异步操作的加载状态
 */
export interface LoadingState {
  /** 是否正在加载 */
  isLoading: boolean

  /** 是否正在刷新 */
  isRefreshing: boolean

  /** 是否正在保存 */
  isSaving: boolean

  /** 加载进度 (0-100) */
  progress: number

  /** 加载开始时间 */
  startTime: Timestamp | null

  /** 预计完成时间 */
  estimatedTime: Timestamp | null

  /** 加载消息 */
  message?: string
}

/**
 * Store 错误状态接口
 *
 * 管理错误状态
 */
export interface StoreErrorState {
  /** 是否有错误 */
  hasError: boolean

  /** 最后一个错误 */
  lastError: AppError | null

  /** 错误历史 */
  errorHistory: AppError[]

  /** 错误数量 */
  errorCount: number

  /** 是否正在恢复 */
  isRecovering: boolean

  /** 恢复进度 (0-100) */
  recoveryProgress: number
}

/**
 * Toast 消息类型
 *
 * Toast 通知的类型
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

/**
 * Toast 位置
 *
 * Toast 显示的位置
 */
export type ToastPosition =
  | 'top'
  | 'top-right'
  | 'top-left'
  | 'bottom'
  | 'bottom-right'
  | 'bottom-left'

/**
 * Toast 消息接口
 *
 * 单个 Toast 消息的数据结构
 */
export interface ToastMessage {
  /** Toast ID */
  id: ID

  /** 消息类型 */
  type: ToastType

  /** 消息标题 */
  title?: string

  /** 消息内容 */
  message: string

  /** 显示持续时间（毫秒），0 表示不自动关闭 */
  duration: number

  /** 显示位置 */
  position: ToastPosition

  /** 是否可关闭 */
  closable: boolean

  /** 是否显示图标 */
  showIcon: boolean

  /** 自定义图标 */
  icon?: string

  /** 创建时间 */
  timestamp: Timestamp

  /** 是否已显示 */
  shown: boolean

  /** 操作按钮列表 */
  actions?: ToastAction[]
}

/**
 * Toast 操作接口
 *
 * Toast 中的操作按钮
 */
export interface ToastAction {
  /** 操作标签 */
  label: string

  /** 操作回调 */
  callback: () => void | Promise<void>

  /** 是否为主要操作 */
  primary?: boolean
}

/**
 * Toast 状态接口
 *
 * Toast 管理状态
 */
export interface ToastState {
  /** Toast 列表 */
  toasts: ToastMessage[]

  /** 最大同时显示数量 */
  maxVisible: number

  /** 默认持续时间 */
  defaultDuration: number

  /** 默认位置 */
  defaultPosition: ToastPosition
}

/**
 * 主题模式类型
 *
 * 应用的主题模式
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * 主题状态接口
 *
 * 主题管理状态
 */
export interface ThemeState {
  /** 当前主题模式 */
  mode: ThemeMode

  /** 实际应用的主题（考虑 auto 模式） */
  activeTheme: 'light' | 'dark'

  /** 主题色 */
  primaryColor?: string

  /** 强调色 */
  accentColor?: string

  /** 是否使用系统主题 */
  useSystemTheme: boolean
}

/**
 * 语言代码类型
 *
 * 支持的语言代码
 */
export type LanguageCode = 'en' | 'zh_CN' | 'zh_TW' | 'ja' | 'ko' | 'ar'

/**
 * 国际化状态接口
 *
 * i18n 管理状态
 */
export interface I18nState {
  /** 当前语言 */
  locale: LanguageCode

  /** 可用语言列表 */
  availableLocales: LanguageCode[]

  /** 是否使用浏览器语言 */
  useBrowserLanguage: boolean

  /** 是否正在加载语言包 */
  isLoadingLocale: boolean
}

/**
 * UI 配置接口
 *
 * UI 相关的配置选项
 */
export interface UIConfig {
  /** 是否显示侧边栏 */
  showSidebar: boolean

  /** 侧边栏宽度 */
  sidebarWidth: number

  /** 是否紧凑模式 */
  compactMode: boolean

  /** 列表项高度 */
  listItemHeight: number

  /** 虚拟滚动是否启用 */
  virtualScrollEnabled: boolean

  /** 动画是否启用 */
  animationsEnabled: boolean

  /** 是否显示工具提示 */
  showTooltips: boolean

  /** 工具提示延迟（毫秒） */
  tooltipDelay: number
}

/**
 * 对话框类型
 *
 * 对话框的类型
 */
export type DialogType = 'confirm' | 'alert' | 'prompt' | 'custom'

/**
 * 对话框状态接口
 *
 * 对话框管理状态
 */
export interface DialogState {
  /** 是否显示对话框 */
  isOpen: boolean

  /** 对话框类型 */
  type: DialogType

  /** 对话框标题 */
  title: string

  /** 对话框内容 */
  content: string

  /** 确认按钮文本 */
  confirmText: string

  /** 取消按钮文本 */
  cancelText: string

  /** 是否显示取消按钮 */
  showCancel: boolean

  /** 确认回调 */
  onConfirm?: () => void | Promise<void>

  /** 取消回调 */
  onCancel?: () => void | Promise<void>

  /** 自定义组件 */
  component?: unknown

  /** 自定义属性 */
  props?: Record<string, unknown>

  /** 是否可通过背景点击关闭 */
  closeOnBackdrop: boolean

  /** 是否可通过 ESC 键关闭 */
  closeOnEscape: boolean
}

/**
 * 分页状态接口
 *
 * 分页管理状态
 */
export interface PaginationState {
  /** 当前页码（从 1 开始） */
  currentPage: number

  /** 每页数量 */
  pageSize: number

  /** 总数量 */
  total: number

  /** 总页数 */
  totalPages: number

  /** 是否有上一页 */
  hasPrevious: boolean

  /** 是否有下一页 */
  hasNext: boolean
}

/**
 * 选择状态接口
 *
 * 多选管理状态
 */
export interface SelectionState<T = ID> {
  /** 已选中的项 */
  selectedIds: Set<T>

  /** 是否全选 */
  isAllSelected: boolean

  /** 是否部分选中 */
  isPartiallySelected: boolean

  /** 选中数量 */
  selectedCount: number

  /** 最后选中的项 */
  lastSelected: T | null
}

/**
 * 视图模式类型
 *
 * 列表/网格等视图模式
 */
export type ViewMode = 'list' | 'grid' | 'tree' | 'table'

/**
 * 视图状态接口
 *
 * 视图管理状态
 */
export interface ViewState {
  /** 当前视图模式 */
  mode: ViewMode

  /** 排序字段 */
  sortBy: string

  /** 排序顺序 */
  sortOrder: 'asc' | 'desc'

  /** 过滤条件 */
  filters: Record<string, unknown>

  /** 搜索关键词 */
  searchQuery: string

  /** 是否显示已删除项 */
  showDeleted: boolean

  /** 是否显示隐藏项 */
  showHidden: boolean
}

/**
 * 布局状态接口
 *
 * 布局管理状态
 */
export interface LayoutState {
  /** 是否全屏模式 */
  isFullscreen: boolean

  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean

  /** 面板是否展开 */
  panelExpanded: boolean

  /** 窗口宽度 */
  windowWidth: number

  /** 窗口高度 */
  windowHeight: number

  /** 是否移动端 */
  isMobile: boolean

  /** 是否平板端 */
  isTablet: boolean

  /** 是否桌面端 */
  isDesktop: boolean
}

/**
 * 缓存状态接口
 *
 * 缓存管理状态
 */
export interface CacheState {
  /** 缓存大小（字节） */
  size: number

  /** 缓存项数量 */
  itemCount: number

  /** 缓存命中次数 */
  hits: number

  /** 缓存未命中次数 */
  misses: number

  /** 缓存命中率 (0-1) */
  hitRate: number

  /** 最后清理时间 */
  lastCleanup: Timestamp | null
}

/**
 * 同步状态接口
 *
 * 数据同步状态
 */
export interface SyncState {
  /** 是否正在同步 */
  isSyncing: boolean

  /** 最后同步时间 */
  lastSyncTime: Timestamp | null

  /** 下次同步时间 */
  nextSyncTime: Timestamp | null

  /** 同步进度 (0-100) */
  syncProgress: number

  /** 同步错误 */
  syncError: string | null

  /** 是否自动同步 */
  autoSync: boolean

  /** 同步间隔（毫秒） */
  syncInterval: number
}

/**
 * 书签创建负载
 *
 * 书签创建事件的数据负载
 */
export interface BookmarkCreatedPayload extends BookmarkNode {}

/**
 * 书签移除负载
 *
 * 书签移除事件的数据负载
 */
export interface BookmarkRemovedPayload {
  /** 书签 ID */
  id: string
}

/**
 * 书签更新负载
 *
 * 书签更新事件的数据负载
 */
export interface BookmarkUpdatedPayload {
  /** 书签 ID */
  id: string

  /** 更改的字段 */
  changes: Partial<BookmarkNode>
}

/**
 * 书签移动负载
 *
 * 书签移动事件的数据负载
 */
export interface BookmarkMovedPayload {
  /** 书签 ID */
  id: string

  /** 新父节点 ID */
  parentId: string

  /** 新的位置索引 */
  index: number
}

/**
 * 子节点重排序负载
 *
 * 子节点重排序事件的数据负载
 */
export interface ChildrenReorderedPayload {
  /** 子节点 ID 列表（按新顺序） */
  childIds: string[]
}

/**
 * 书签变更数据
 *
 * 所有书签变更事件的联合类型
 */
export type BookmarkChangeData =
  | { type: 'BOOKMARK_CREATED'; payload: BookmarkCreatedPayload }
  | { type: 'BOOKMARK_REMOVED'; payload: BookmarkRemovedPayload }
  | { type: 'BOOKMARK_UPDATED'; payload: BookmarkUpdatedPayload }
  | { type: 'BOOKMARK_MOVED'; payload: BookmarkMovedPayload }
  | { type: 'CHILDREN_REORDERED'; payload: ChildrenReorderedPayload }

/**
 * Chrome Runtime 书签消息
 *
 * Chrome Extension 运行时的书签变更消息
 */
export interface ChromeRuntimeBookmarkMessage {
  /** 消息通道 */
  channel: 'bookmarks-changed'

  /** 变更数据 */
  data: BookmarkChangeData
}

/**
 * 编辑书签数据
 *
 * 管理页面编辑书签时使用的数据结构
 */
export interface EditBookmarkData {
  /** 书签 ID */
  id: string

  /** 书签标题 */
  title: string

  /** 书签 URL */
  url: string

  /** 父节点 ID */
  parentId?: string
}

/**
 * 添加项数据
 *
 * 管理页面添加书签或文件夹时使用的数据结构
 */
export interface AddItemData {
  /** 项类型 */
  type: 'folder' | 'bookmark'

  /** 标题 */
  title: string

  /** URL（仅书签） */
  url?: string

  /** 父节点 ID */
  parentId?: string
}

/**
 * 清理状态
 *
 * 清理操作的状态信息
 */
export interface CleanupState {
  /** 是否正在运行 */
  isRunning: boolean

  /** 进度（0-100） */
  progress: number

  /** 当前步骤描述 */
  currentStep: string

  /** 清理结果列表 */
  results: unknown[] // 引用 CleanupProblem，避免循环依赖

  /** 清理设置 */
  settings: {
    /** 是否移除重复项 */
    removeDuplicates: boolean

    /** 是否移除失效链接 */
    removeDeadLinks: boolean

    /** 是否移除空文件夹 */
    removeEmptyFolders: boolean
  }
}

/**
 * 书签统计信息
 *
 * 书签数量统计
 */
export interface BookmarkStats {
  /** 书签数量 */
  bookmarks: number

  /** 文件夹数量 */
  folders: number
}

/**
 * 搜索 UI 状态
 *
 * 搜索界面的状态信息
 */
export interface SearchUIState {
  /** 是否正在搜索 */
  isSearching: boolean

  /** 搜索进度（0-100） */
  searchProgress: number

  /** 是否有搜索结果 */
  hasSearchResults: boolean
}

/**
 * 搜索进度
 *
 * 搜索操作的进度信息
 */
export interface SearchProgress {
  /** 当前进度 */
  current: number

  /** 总数 */
  total: number

  /** 进度消息 */
  message: string
}

/**
 * 搜索结果项
 *
 * 单个搜索结果的数据结构
 */
export interface SearchResultItem {
  /** 书签 ID */
  id: string

  /** 书签标题 */
  title: string

  /** 书签 URL（可选，文件夹无 URL） */
  url?: string

  /** 域名（从 URL 解析） */
  domain?: string

  /** 父节点路径数组 */
  path: string[]

  /** 父节点路径字符串 */
  pathString: string

  /** 匹配得分 */
  matchScore: number

  /** 是否为文件夹 */
  isFolder: boolean
}

/**
 * Toast 简化状态
 *
 * UI Store 中使用的简化 Toast 状态
 */
export interface SimpleToastState {
  /** 是否显示 */
  show: boolean

  /** 消息内容 */
  message: string

  /** Toast 类型 */
  type: 'success' | 'error' | 'warning' | 'info'

  /** 显示持续时间（毫秒） */
  duration: number
}

/**
 * 加载简化状态
 *
 * UI Store 中使用的简化加载状态
 */
export interface SimpleLoadingState {
  /** 是否全局加载中 */
  isGlobalLoading: boolean

  /** 加载消息 */
  loadingMessage: string

  /** 加载进度（0-100） */
  loadingProgress: number
}

/**
 * 主题简化状态
 *
 * UI Store 中使用的简化主题状态
 */
export interface SimpleThemeState {
  /** 是否为深色主题 */
  isDark: boolean

  /** 主题色 */
  primaryColor: string

  /** 强调色 */
  accentColor: string
}

/**
 * 布局简化状态
 *
 * UI Store 中使用的简化布局状态
 */
export interface SimpleLayoutState {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean

  /** 侧边栏宽度 */
  sidebarWidth: number

  /** 主内容区宽度 */
  mainContentWidth: number
}
