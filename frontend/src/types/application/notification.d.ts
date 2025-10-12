/**
 * 通知应用层类型定义
 *
 * 包含通知系统相关的所有类型定义
 */

import type { ID, Timestamp } from '../core/common'

/**
 * 通知类型
 *
 * 通知的类型分类
 */
export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'system'

/**
 * 通知优先级
 *
 * 通知的优先级等级
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * 通知接口
 *
 * 单个通知的数据结构
 *
 * @example
 * ```typescript
 * const notification: Notification = {
 *   id: '123',
 *   type: 'success',
 *   title: '操作成功',
 *   message: '书签已保存',
 *   timestamp: Date.now()
 * }
 * ```
 */
export interface Notification {
  /** 通知ID */
  id: ID

  /** 通知类型 */
  type: NotificationType

  /** 通知标题 */
  title: string

  /** 通知消息 */
  message: string

  /** 优先级 */
  priority: NotificationPriority

  /** 创建时间 */
  timestamp: Timestamp

  /** 是否已读 */
  read: boolean

  /** 是否持久化（不自动消失） */
  persistent: boolean

  /** 自动关闭时间（毫秒） */
  autoClose?: number

  /** 图标 */
  icon?: string

  /** 图片URL */
  imageUrl?: string

  /** 操作按钮 */
  actions?: NotificationAction[]

  /** 相关数据 */
  data?: Record<string, unknown>

  /** 来源 */
  source?: string

  /** 分组标识 */
  groupId?: ID
}

/**
 * 通知操作接口
 *
 * 通知中的操作按钮
 */
export interface NotificationAction {
  /** 操作ID */
  id: ID

  /** 操作标签 */
  label: string

  /** 操作类型 */
  type: 'primary' | 'secondary' | 'danger'

  /** 操作回调 */
  callback: () => void | Promise<void>

  /** 是否关闭通知 */
  closeOnClick?: boolean

  /** 图标 */
  icon?: string
}

/**
 * 通知选项接口
 *
 * 创建通知时的配置选项
 */
export interface NotificationOptions {
  /** 通知类型 */
  type?: NotificationType

  /** 优先级 */
  priority?: NotificationPriority

  /** 是否持久化 */
  persistent?: boolean

  /** 自动关闭时间 */
  autoClose?: number

  /** 图标 */
  icon?: string

  /** 图片URL */
  imageUrl?: string

  /** 操作按钮 */
  actions?: NotificationAction[]

  /** 相关数据 */
  data?: Record<string, unknown>

  /** 来源 */
  source?: string

  /** 分组标识 */
  groupId?: ID

  /** 是否播放声音 */
  playSound?: boolean

  /** 是否显示桌面通知 */
  showDesktopNotification?: boolean
}

/**
 * 通知状态接口
 *
 * 通知系统的状态管理
 */
export interface NotificationState {
  /** 通知列表 */
  notifications: Notification[]

  /** 未读通知数量 */
  unreadCount: number

  /** 是否显示通知面板 */
  showPanel: boolean

  /** 是否启用通知 */
  enabled: boolean

  /** 是否启用声音 */
  soundEnabled: boolean

  /** 是否启用桌面通知 */
  desktopNotificationEnabled: boolean

  /** 通知过滤器 */
  filter: NotificationFilter

  /** 最大显示数量 */
  maxVisible: number
}

/**
 * 通知过滤器接口
 *
 * 过滤和筛选通知
 */
export interface NotificationFilter {
  /** 按类型过滤 */
  types?: NotificationType[]

  /** 按优先级过滤 */
  priorities?: NotificationPriority[]

  /** 是否只显示未读 */
  unreadOnly?: boolean

  /** 日期范围 */
  dateRange?: {
    start?: Timestamp
    end?: Timestamp
  }

  /** 搜索关键词 */
  searchQuery?: string
}

/**
 * 通知配置接口
 *
 * 通知系统的全局配置
 */
export interface NotificationConfig {
  /** 是否启用通知 */
  enabled: boolean

  /** 是否启用声音 */
  soundEnabled: boolean

  /** 声音文件URL */
  soundUrl?: string

  /** 是否启用桌面通知 */
  desktopNotificationEnabled: boolean

  /** 默认自动关闭时间（毫秒） */
  defaultAutoClose: number

  /** 最大通知数量 */
  maxNotifications: number

  /** 是否分组显示 */
  groupNotifications: boolean

  /** 通知位置 */
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

/**
 * 通知统计接口
 *
 * 通知相关的统计数据
 */
export interface NotificationStats {
  /** 总通知数 */
  total: number

  /** 未读数量 */
  unread: number

  /** 按类型统计 */
  byType: Record<NotificationType, number>

  /** 按优先级统计 */
  byPriority: Record<NotificationPriority, number>

  /** 最近通知时间 */
  lastNotificationTime: Timestamp | null

  /** 平均每天通知数 */
  averagePerDay?: number
}

/**
 * Chrome 通知选项接口
 *
 * Chrome API 通知的选项
 */
export interface ChromeNotificationOptions {
  /** 通知类型 */
  type: 'basic' | 'image' | 'list' | 'progress'

  /** 图标URL */
  iconUrl: string

  /** 标题 */
  title: string

  /** 消息 */
  message: string

  /** 上下文消息 */
  contextMessage?: string

  /** 优先级 (0-2) */
  priority?: number

  /** 事件时间 */
  eventTime?: number

  /** 按钮列表 */
  buttons?: Array<{
    title: string
    iconUrl?: string
  }>

  /** 图片URL（image 类型） */
  imageUrl?: string

  /** 列表项（list 类型） */
  items?: Array<{
    title: string
    message: string
  }>

  /** 进度值（progress 类型，0-100） */
  progress?: number

  /** 是否需要交互 */
  requireInteraction?: boolean
}

/**
 * 通知权限类型
 *
 * 浏览器通知权限状态
 */
export type NotificationPermission = 'granted' | 'denied' | 'default'

/**
 * 通知分组接口
 *
 * 通知分组信息
 */
export interface NotificationGroup {
  /** 分组ID */
  id: ID

  /** 分组名称 */
  name: string

  /** 分组内通知数量 */
  count: number

  /** 未读数量 */
  unreadCount: number

  /** 最后通知时间 */
  lastNotificationTime: Timestamp

  /** 是否折叠 */
  collapsed: boolean
}
