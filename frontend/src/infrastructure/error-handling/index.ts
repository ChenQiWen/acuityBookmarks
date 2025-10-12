/**
 * 错误处理模块统一导出
 */

// 核心错误类型和类
export {
  StoreError,
  StoreErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  type StoreErrorState,
  createErrorState
} from '@/core/common/store-error'

// 错误处理服务
export { StoreErrorHandler } from './store-error-handler'

// 错误处理中间件
export {
  withErrorHandling,
  withSyncErrorHandling,
  withRetry,
  withTimeout,
  composeDecorators,
  ErrorHandlingUtils
} from './error-middleware'

// 错误处理 Hooks
export {
  useStoreErrorHandling,
  useErrorRecovery,
  useErrorMonitoring,
  useErrorHandling
} from './error-hooks'
