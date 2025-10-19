/**
 * 通知服务 - 应用服务层
 *
 * 职责：
 * - 管理全局通知队列
 * - 提供系统通知和页面Toast的统一接口
 * - 处理通知去重和抑制
 * - 支持Chrome扩展通知API
 */

import type { Result } from '../../core/common/result'
import { ok, err } from '../../core/common/result'
import { logger } from '../../infrastructure/logging/logger'
import { createApp, h, type App } from 'vue'
import { ToastBar } from '@/components'
import { navigationService } from '@/services/navigation-service'

// 从统一类型定义导入

/**
 * Toast 级别类型
 */
type ToastLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * Toast 显示选项
 */
interface ToastShowOptions {
  title?: string
  level?: ToastLevel
  timeoutMs?: number
}

/**
 * Toast 实例接口
 */
interface ToastInstance {
  showToast?: (message: string, opts?: ToastShowOptions) => string
}

/**
 * 页面 Toast 管理器
 * 单例管理页面内的 ToastBar 组件
 */
class PageToastManager {
  private app: App | null = null
  private container: HTMLElement | null = null
  private exposed: ToastInstance | null = null

  /**
   * 确保 ToastBar 已挂载
   */
  private ensureMounted(): void {
    if (this.exposed) return

    // Service Worker 环境检查：没有 document
    if (typeof document === 'undefined') {
      logger.warn('PageToastManager', 'document 不可用（Service Worker 环境）')
      return
    }

    if (!this.container) {
      this.container = document.createElement('div')
      document.body.appendChild(this.container)
    }

    this.app = createApp({
      render: () =>
        h(ToastBar, {
          ref: 'toast',
          position: 'top-right',
          defaultTitle: 'AcuityBookmarks',
          offsetTop: 56,
          maxLifetimeMs: 6000
        })
    })

    const vm = this.app.mount(this.container)

    // 通过 $refs 获取暴露的方法
    this.exposed =
      (vm as { $refs?: { toast?: ToastInstance } })?.$refs?.toast || null
  }

  /**
   * 显示 Toast 消息
   */
  show(message: string, opts?: ToastShowOptions): string {
    // Service Worker 环境检查
    if (typeof document === 'undefined') {
      logger.debug('PageToastManager', 'Service Worker 环境，跳过 Toast 显示')
      return ''
    }

    this.ensureMounted()

    if (!this.exposed?.showToast) {
      logger.warn('PageToastManager', 'ToastBar 未正确初始化')
      return ''
    }

    return this.exposed.showToast(message, opts)
  }

  /**
   * 清理资源
   */
  dispose(): void {
    try {
      if (typeof document !== 'undefined' && this.app && this.container) {
        this.app.unmount()
        document.body.removeChild(this.container)
      }
    } catch (error) {
      logger.error('Component', 'PageToastManager', '清理资源失败', error)
    }

    this.app = null
    this.container = null
    this.exposed = null
  }
}

/**
 * 通知级别
 *
 * @deprecated 请使用 @/types/application/notification 中的 NotificationType
 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * 通知选项 (扩展版本)
 *
 * @deprecated 请使用 @/types/application/notification 中的 NotificationOptions
 */
export interface NotificationOptions {
  title?: string
  iconUrl?: string
  level?: NotificationLevel
  key?: string // 用于去重
  timeoutMs?: number // 显示时长，默认 2000ms
}

/**
 * 队列中的通知
 */
export interface QueuedNotification {
  id: string
  message: string
  options: Required<NotificationOptions>
}

/**
 * 通知服务配置
 *
 * @deprecated 请使用 @/types/application/notification 中的 NotificationConfig
 */
export interface NotificationServiceConfig {
  defaultTitle: string
  defaultTimeout: number
  concurrency: number
  suppressWindowMs: number
  enableSystemNotifications: boolean
  enablePageToasts: boolean
}

/**
 * 通知服务
 */
export class NotificationService {
  private config: NotificationServiceConfig
  private queue: QueuedNotification[] = []
  private active = 0
  private recentMap = new Map<string, number>() // key -> timestamp，用于抑制相同消息
  private permissionCache: string | null = null
  private pageToastManager: PageToastManager | null = null

  constructor(config: Partial<NotificationServiceConfig> = {}) {
    this.config = {
      defaultTitle: 'AcuityBookmarks',
      defaultTimeout: 2000,
      concurrency: 1,
      suppressWindowMs: 1200,
      enableSystemNotifications: true,
      enablePageToasts: true,
      ...config
    }

    if (this.config.enablePageToasts) {
      this.pageToastManager = new PageToastManager()
    }
  }

  /**
   * 显示通知
   */
  async notify(
    message: string,
    opts?: NotificationOptions
  ): Promise<Result<void, Error>> {
    try {
      const options = this.buildOptions(opts)

      logger.debug('NotificationService', 'Enqueue notification', {
        message,
        options
      })

      // 抑制同内容在短时间内重复
      const suppressKey = options.key || `${options.level}:${message}`
      const last = this.recentMap.get(suppressKey) || 0
      const ts = Date.now()

      if (ts - last < this.config.suppressWindowMs) {
        logger.debug('NotificationService', 'Notification suppressed', {
          suppressKey
        })
        return ok(undefined)
      }

      this.recentMap.set(suppressKey, ts)

      const item: QueuedNotification = {
        id: this.makeId(),
        message,
        options
      }

      // 显示页面Toast（主通道）
      if (this.config.enablePageToasts) {
        await this.showPageToast(item)
      }

      // 自动镜像系统通知（副通道）：仅当页面不可见时
      const shouldMirror =
        typeof document !== 'undefined' ? document.hidden : true

      if (shouldMirror && this.config.enableSystemNotifications) {
        this.queue.push(item)
        this.runNext()
      }

      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 显示成功通知
   */
  async notifySuccess(
    message: string,
    title?: string
  ): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'success', title })
  }

  /**
   * 显示信息通知
   */
  async notifyInfo(
    message: string,
    title?: string
  ): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'info', title })
  }

  /**
   * 显示警告通知
   */
  async notifyWarning(
    message: string,
    title?: string
  ): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'warning', title })
  }

  /**
   * 显示错误通知
   */
  async notifyError(
    message: string,
    title?: string
  ): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'error', title })
  }

  /**
   * 构建通知选项
   */
  private buildOptions(
    opts?: NotificationOptions
  ): Required<NotificationOptions> {
    const level: NotificationLevel = opts?.level || 'info'
    return {
      title: opts?.title || this.config.defaultTitle,
      iconUrl: this.resolveIconUrl(opts?.iconUrl, level),
      level,
      key: opts?.key || '',
      timeoutMs: opts?.timeoutMs ?? this.config.defaultTimeout
    }
  }

  /**
   * 解析图标URL
   */
  private resolveIconUrl(
    iconUrl?: string,
    level: NotificationLevel = 'info'
  ): string {
    const defaultIcon = this.getDefaultIcon(level)
    const raw = iconUrl || defaultIcon

    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
        // 若传入的是相对路径，统一通过 getURL 解析；若已是绝对 URL 则直接返回
        if (/^https?:\/\//.test(raw) || raw.startsWith('chrome-extension://')) {
          return raw
        }
        const cleaned = raw.replace(/^\//, '')
        return chrome.runtime.getURL(cleaned)
      }
    } catch {
      // 忽略错误
    }

    return raw
  }

  /**
   * 获取默认图标
   */
  private getDefaultIcon(_level: NotificationLevel): string {
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
        return chrome.runtime.getURL('logo.png')
      }
    } catch {
      // 忽略错误
    }
    return '/logo.png'
  }

  /**
   * 生成唯一ID
   */
  private makeId(): string {
    return Math.random().toString(36).slice(2)
  }

  /**
   * 显示页面Toast
   */
  private async showPageToast(notification: QueuedNotification): Promise<void> {
    try {
      if (!this.pageToastManager) {
        logger.warn('NotificationService', '页面Toast管理器未初始化')
        return
      }

      const level = notification.options.level as ToastLevel
      const toastId = this.pageToastManager.show(notification.message, {
        title: notification.options.title,
        level,
        timeoutMs: notification.options.timeoutMs
      })

      if (toastId) {
        logger.debug('NotificationService', '页面Toast显示成功', {
          id: toastId,
          message: notification.message,
          level
        })
      } else {
        logger.warn('NotificationService', '页面Toast显示失败')
      }
    } catch (error) {
      logger.error(
        'Component',
        'NotificationService',
        '页面Toast显示失败',
        error
      )
    }
  }

  /**
   * 创建Chrome通知
   */
  private async createChromeNotification(
    notification: QueuedNotification
  ): Promise<string> {
    try {
      return await navigationService.showChromeNotification({
        title: notification.options.title,
        message: notification.message,
        iconUrl: notification.options.iconUrl
      })
    } catch (error) {
      logger.warn(
        'NotificationService',
        '调用 showChromeNotification 失败',
        error
      )
      return ''
    }
  }

  /**
   * 清除Chrome通知
   */
  private clearChromeNotification(notificationId: string): void {
    if (!notificationId) return
    void navigationService
      .clearChromeNotification(notificationId)
      .catch(error => {
        logger.warn('NotificationService', '清除通知失败', {
          id: notificationId,
          error
        })
      })
  }

  /**
   * 运行下一个通知
   */
  private async runNext(): Promise<void> {
    if (this.active >= this.config.concurrency) return

    const notification = this.queue.shift()
    if (!notification) return

    this.active++

    try {
      const id = await this.createChromeNotification(notification)
      if (notification.options.timeoutMs > 0) {
        setTimeout(() => {
          this.clearChromeNotification(id)
        }, notification.options.timeoutMs)
      }
    } finally {
      this.active--
      if (this.queue.length > 0) {
        // 小延迟避免过快闪烁
        setTimeout(() => this.runNext(), 100)
      }
    }
  }

  /**
   * 获取通知权限级别
   */
  async getPermissionLevel(): Promise<string> {
    if (this.permissionCache) return this.permissionCache

    try {
      const chromeNotifications = (
        chrome as unknown as {
          notifications?: {
            getPermissionLevel?: (callback: (level: string) => void) => void
          }
        }
      )?.notifications

      if (
        chromeNotifications &&
        typeof chromeNotifications.getPermissionLevel === 'function'
      ) {
        this.permissionCache = await new Promise<string>(resolve => {
          chromeNotifications.getPermissionLevel!((level: string) =>
            resolve(level || 'unknown')
          )
        })
        return this.permissionCache
      }
    } catch {
      // 忽略错误
    }

    return 'unknown'
  }

  /**
   * 检查通知诊断信息
   */
  async checkDiagnostics(): Promise<Record<string, unknown>> {
    const diagnostics: Record<string, unknown> = {}

    try {
      diagnostics.hasChrome = typeof chrome !== 'undefined'
      diagnostics.hasNotifications = !!(
        chrome as unknown as { notifications?: unknown }
      )?.notifications
      diagnostics.manifestHasPermission = false

      try {
        const manifest = chrome?.runtime?.getManifest
          ? (chrome.runtime.getManifest() as { permissions?: string[] })
          : null
        if (manifest && Array.isArray(manifest.permissions)) {
          diagnostics.manifestHasPermission =
            manifest.permissions.includes('notifications')
        }
      } catch {
        // 忽略错误
      }

      diagnostics.permissionLevel = await this.getPermissionLevel()
      diagnostics.swReachable = false

      try {
        await new Promise<void>(resolve => {
          chrome.runtime.sendMessage({ type: 'ACUITY_NOTIFY_PING' }, resp => {
            try {
              if (chrome?.runtime?.lastError) {
                diagnostics.swReachable = false
                return resolve()
              }
            } catch {
              // 忽略错误
            }
            diagnostics.swReachable = !!resp?.ok
            resolve()
          })
        })
      } catch {
        // 忽略错误
      }

      logger.info('NotificationService', 'Diagnostics completed', diagnostics)
    } catch (error) {
      logger.warn('NotificationService', 'Diagnostics failed', error)
    }

    return diagnostics
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<NotificationServiceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): NotificationServiceConfig {
    return { ...this.config }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = []
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { queueLength: number; activeCount: number } {
    return {
      queueLength: this.queue.length,
      activeCount: this.active
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.clearQueue()
    if (this.pageToastManager) {
      this.pageToastManager.dispose()
      this.pageToastManager = null
    }
  }
}

/**
 * 默认通知服务实例
 */
export const notificationService = new NotificationService()

/**
 * 便捷函数（保持向后兼容）
 */
export async function notify(
  message: string,
  opts?: NotificationOptions
): Promise<void> {
  const result = await notificationService.notify(message, opts)
  if (!result.ok) {
    throw result.error
  }
}

export const notifySuccess = (message: string, title?: string) =>
  notificationService.notifySuccess(message, title)

export const notifyInfo = (message: string, title?: string) =>
  notificationService.notifyInfo(message, title)

export const notifyWarning = (message: string, title?: string) =>
  notificationService.notifyWarning(message, title)

export const notifyError = (message: string, title?: string) =>
  notificationService.notifyError(message, title)

/**
 * 向后兼容：页面Toast便捷函数（来自toastbar.ts）
 * @deprecated 请使用 notificationService 上的方法
 */
export function showToast(message: string, opts?: ToastShowOptions): string {
  const service = new NotificationService()
  return service['pageToastManager']?.show(message, opts) || ''
}

export const showToastSuccess = (message: string, title?: string) =>
  showToast(message, { title, level: 'success' })

export const showToastInfo = (message: string, title?: string) =>
  showToast(message, { title, level: 'info' })

export const showToastWarning = (message: string, title?: string) =>
  showToast(message, { title, level: 'warning' })

export const showToastError = (message: string, title?: string) =>
  showToast(message, { title, level: 'error' })
