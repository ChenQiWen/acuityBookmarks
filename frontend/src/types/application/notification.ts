export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationPayload {
  id: string
  text: string
  level: NotificationLevel
  createdAt: number
  autoClose?: boolean
  duration?: number
}

export interface NotificationChannel {
  subscribe(callback: (payload: NotificationPayload) => void): () => void
  publish(payload: NotificationPayload): void
}
