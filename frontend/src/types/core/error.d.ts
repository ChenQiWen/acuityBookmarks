/**
 * 错误类型定义
 *
 * 提供统一的错误类型和错误处理接口
 */

/**
 * 错误类型枚举
 *
 * 定义系统中所有可能的错误类型
 */
export enum ErrorType {
  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 超时错误 */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  /** 数据验证错误 */
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  /** 数据未找到 */
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  /** 数据同步错误 */
  DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',
  /** 权限拒绝 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** 认证错误 */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  /** 业务逻辑错误 */
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  /** 操作失败 */
  OPERATION_FAILED = 'OPERATION_FAILED',
  /** 系统错误 */
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  /** 未知错误 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 错误严重程度
 *
 * 定义错误的严重程度等级
 */
export enum ErrorSeverity {
  /** 低 - 不影响核心功能 */
  LOW = 'LOW',
  /** 中 - 影响部分功能 */
  MEDIUM = 'MEDIUM',
  /** 高 - 影响核心功能 */
  HIGH = 'HIGH',
  /** 严重 - 系统无法正常工作 */
  CRITICAL = 'CRITICAL'
}

/**
 * 错误恢复策略
 *
 * 定义错误发生后的恢复策略
 */
export enum RecoveryStrategy {
  /** 无恢复策略 */
  NONE = 'NONE',
  /** 自动重试 */
  RETRY = 'RETRY',
  /** 降级处理 */
  FALLBACK = 'FALLBACK',
  /** 需要用户手动处理 */
  MANUAL = 'MANUAL'
}

/**
 * 应用错误接口
 *
 * 定义应用程序中的标准错误结构
 */
export interface AppError {
  /** 错误类型 */
  type: ErrorType

  /** 错误严重程度 */
  severity: ErrorSeverity

  /** 恢复策略 */
  recoveryStrategy: RecoveryStrategy

  /** 用户友好的错误消息 */
  userMessage: string

  /** 技术错误消息（用于日志） */
  technicalMessage: string

  /** 错误上下文信息 */
  context?: Record<string, unknown>

  /** 原始错误对象 */
  originalError?: Error

  /** 错误代码 */
  code?: string | number

  /** 错误发生时间 */
  timestamp?: number

  /** 错误堆栈 */
  stack?: string
}

/**
 * Store 错误类型
 *
 * Store 层特定的错误类型
 */
export enum StoreErrorType {
  /** 网络相关 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  /** 数据相关 */
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',

  /** 权限相关 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',

  /** 业务逻辑相关 */
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',

  /** 系统相关 */
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Store 错误状态
 *
 * Store 中的错误状态管理
 */
export interface StoreErrorState {
  /** 最后一个错误 */
  lastError: AppError | null

  /** 错误历史记录 */
  errorHistory: AppError[]

  /** 是否正在恢复 */
  isRecovering: boolean

  /** 恢复进度 (0-100) */
  recoveryProgress: number
}

/**
 * 错误处理器接口
 *
 * 定义错误处理器的标准接口
 */
export interface ErrorHandler {
  /**
   * 处理错误
   *
   * @param error - 错误对象
   * @param context - 错误上下文
   * @returns 处理后的应用错误
   */
  handleError(
    error: Error | AppError,
    context?: Record<string, unknown>
  ): Promise<AppError>

  /**
   * 清除错误历史
   */
  clearErrorHistory(): void

  /**
   * 获取错误历史
   */
  getErrorHistory(): AppError[]

  /**
   * 获取错误统计
   */
  getErrorStats(): ErrorStats
}

/**
 * 错误统计信息
 *
 * 错误发生的统计数据
 */
export interface ErrorStats {
  /** 总错误数 */
  total: number

  /** 按类型分组的错误数 */
  byType: Record<ErrorType, number>

  /** 按严重程度分组的错误数 */
  bySeverity: Record<ErrorSeverity, number>

  /** 最近的错误 */
  recentErrors: AppError[]

  /** 错误率 (错误数/总操作数) */
  errorRate?: number
}

/**
 * 错误边界配置
 *
 * Vue 错误边界的配置选项
 */
export interface ErrorBoundaryConfig {
  /** 是否启用 */
  enabled: boolean

  /** 错误回调 */
  onError?: (error: Error, info: string) => void

  /** 降级UI组件 */
  fallback?: unknown

  /** 是否记录错误 */
  logErrors: boolean
}

/**
 * 错误通知配置
 *
 * 错误通知的配置选项
 */
export interface ErrorNotificationConfig {
  /** 是否显示用户通知 */
  showUserNotification: boolean

  /** 通知持续时间（毫秒） */
  duration: number

  /** 通知位置 */
  position?:
    | 'top'
    | 'bottom'
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'

  /** 是否可关闭 */
  closable: boolean
}
