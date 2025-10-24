import type { Timestamp } from '../core/common'
import type { ErrorType, ErrorSeverity } from '../core/error'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  maxBufferSize: number
}

export interface LogEntry {
  timestamp: Timestamp
  level: LogLevel
  scope: string
  message: string
  data?: unknown
}

export interface ErrorContext {
  component?: string
  operation?: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

export interface RemoteLogPayload {
  entries: LogEntry[]
  appVersion: string
  userAgent: string
  locale: string
}

export interface CapturedError {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  stack?: string
  context?: ErrorContext
}
