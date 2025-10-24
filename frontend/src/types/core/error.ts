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

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum RecoveryStrategy {
  NONE = 'NONE',
  RETRY = 'RETRY',
  FALLBACK = 'FALLBACK',
  MANUAL = 'MANUAL'
}

export interface AppError {
  type: ErrorType
  severity: ErrorSeverity
  recoveryStrategy: RecoveryStrategy
  userMessage: string
  technicalMessage: string
  context?: Record<string, unknown>
  originalError?: Error
  code?: string | number
  timestamp?: number
  stack?: string
}

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

export interface StoreErrorState {
  lastError: AppError | null
  errorHistory: AppError[]
  isRecovering: boolean
  recoveryProgress: number
}

export interface ErrorStats {
  total: number
  byType: Record<ErrorType, number>
  bySeverity: Record<ErrorSeverity, number>
  recentErrors: AppError[]
}
