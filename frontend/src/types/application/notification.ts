export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationPayload {
  id: string
  text: string
  level: NotificationLevel
  createdAt: number
  autoClose?: boolean
  duration?: number
}

export interface NotificationOptions {
  title?: string
  message?: string
  level?: NotificationLevel
  type?: NotificationLevel
  timeoutMs?: number
  priority?: 'low' | 'normal' | 'high'
  persistent?: boolean
  autoClose?: boolean | number
  iconUrl?: string
  icon?: string
  imageUrl?: string
  actions?: Array<{ label: string; action: string }>
  data?: Record<string, unknown>
  source?: string
  groupId?: string
  playSound?: boolean
  showDesktopNotification?: boolean
  key?: string
}

export type ToastLevel = NotificationLevel

export interface ToastShowOptions {
  level?: ToastLevel
  title?: string
  timeout?: number
  timeoutMs?: number
}

export interface ToastInstance {
  id: string
  level: ToastLevel
  message: string
  createdAt: number
  timeoutHandle?: number
  showToast(message: string, opts?: ToastShowOptions): string
}

export interface QueuedNotification {
  id: string
  message: string
  options: NotificationOptions
  createdAt: number
}

export interface NotificationServiceConfig {
  defaultTitle: string
  defaultTimeout: number
  concurrency: number
  suppressWindowMs: number
  enableSystemNotifications: boolean
  enablePageToasts: boolean
}

export interface NotificationChannel {
  subscribe(callback: (payload: NotificationPayload) => void): () => void
  publish(payload: NotificationPayload): void
}
