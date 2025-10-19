/**
 * 日志系统类型定义
 *
 * 包含日志记录相关的所有类型
 */

import type { Timestamp } from '../core/common'

/**
 * 日志级别类型
 *
 * 日志的严重程度级别
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/**
 * 日志配置接口
 *
 * 日志系统的配置选项
 */
export interface LoggerConfig {
  /** 日志级别 */
  level: LogLevel

  /** 是否启用控制台输出 */
  enableConsole: boolean

  /** 是否启用远程日志 */
  enableRemote: boolean

  /** 远程日志端点 */
  remoteEndpoint?: string

  /** 最大缓冲区大小 */
  maxBufferSize: number
}

/**
 * 日志条目接口
 *
 * 单条日志记录的数据结构
 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: Timestamp

  /** 日志级别 */
  level: LogLevel

  /** 作用域/组件名 */
  scope: string

  /** 日志消息 */
  message: string

  /** 附加数据 */
  data?: unknown
}

/**
 * 错误上下文接口
 *
 * 错误处理时的上下文信息
 */
export interface ErrorContext {
  /** 组件名称 */
  component?: string

  /** 操作名称 */
  operation?: string

  /** 用户ID */
  userId?: string

  /** 会话ID */
  sessionId?: string

  /** 额外数据 */
  metadata?: Record<string, unknown>
}

/**
 * 重试选项接口
 *
 * 错误重试的配置选项
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries: number

  /** 初始延迟（毫秒） */
  initialDelay: number

  /** 最大延迟（毫秒） */
  maxDelay: number

  /** 退避因子 */
  backoffFactor: number

  /** 重试前的回调 */
  onRetry?: (attempt: number, error: Error) => void
}

/**
 * 错误类型枚举
 *
 * 系统中的错误类型分类
 */
export const ErrorType = {
  /** 网络错误 */
  NETWORK: 'NETWORK',

  /** 超时错误 */
  TIMEOUT: 'TIMEOUT',

  /** 验证错误 */
  VALIDATION: 'VALIDATION',

  /** 权限错误 */
  PERMISSION: 'PERMISSION',

  /** 系统错误 */
  SYSTEM: 'SYSTEM',

  /** 未知错误 */
  UNKNOWN: 'UNKNOWN'
} as const

/**
 * 错误类型
 *
 * 从 ErrorType 对象派生的类型
 */
export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType]
