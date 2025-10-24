/**
 * 标准化的错误类型枚举。
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/** 错误严重级别。 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/** 针对错误的降级策略。 */
export enum RecoveryStrategy {
  NONE = 'NONE',
  RETRY = 'RETRY',
  FALLBACK = 'FALLBACK',
  MANUAL = 'MANUAL'
}

/** 全局错误对象定义。 */
export interface AppError {
  type: ErrorType
  severity: ErrorSeverity
  recoveryStrategy: RecoveryStrategy
  /** 给用户看的错误文案 */
  userMessage: string
  /** 用于日志/调试的技术细节 */
  technicalMessage: string
  /** 额外上下文信息 */
  context?: Record<string, unknown>
  /** 原始错误实例（如果存在） */
  originalError?: Error
  /** 业务自定义错误码 */
  code?: string | number
  /** 发生时间戳 */
  timestamp?: number
  /** 堆栈信息 */
  stack?: string
}

/** Store 层常用错误类型。 */
export enum StoreErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/** Store 错误状态结构，用于 Pinia 管理。 */
export interface StoreErrorState {
  lastError: AppError | null
  errorHistory: AppError[]
  isRecovering: boolean
  recoveryProgress: number
}

/** 错误统计数据。 */
export interface ErrorStats {
  total: number
  byType: Record<ErrorType, number>
  bySeverity: Record<ErrorSeverity, number>
  recentErrors: AppError[]
}
