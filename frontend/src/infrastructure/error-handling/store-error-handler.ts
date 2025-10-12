/**
 * Store 错误处理服务
 *
 * 提供统一的错误处理、分类、恢复和监控功能
 */

import { logger } from '../logging/logger'
import {
  StoreError,
  StoreErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  type StoreErrorState
} from '@/core/common/store-error'

export class StoreErrorHandler {
  private static instance: StoreErrorHandler
  private errorHistory: StoreError[] = []
  private maxHistorySize = 100

  static getInstance(): StoreErrorHandler {
    if (!StoreErrorHandler.instance) {
      StoreErrorHandler.instance = new StoreErrorHandler()
    }
    return StoreErrorHandler.instance
  }

  /**
   * 处理错误
   */
  async handleError(
    error: Error | StoreError,
    context?: Record<string, unknown>
  ): Promise<StoreError> {
    const storeError = this.normalizeError(error, context)

    // 记录错误
    this.recordError(storeError)

    // 记录日志
    this.logError(storeError)

    // 执行恢复策略
    await this.executeRecoveryStrategy(storeError)

    return storeError
  }

  /**
   * 标准化错误
   */
  private normalizeError(
    error: Error | StoreError,
    context?: Record<string, unknown>
  ): StoreError {
    if (error instanceof StoreError) {
      return error
    }

    // 根据错误类型和消息推断错误类型
    const errorType = this.inferErrorType(error)
    const severity = this.inferSeverity(errorType)
    const recoveryStrategy = this.inferRecoveryStrategy(errorType)

    return new StoreError(
      errorType,
      severity,
      recoveryStrategy,
      StoreError.createUserFriendlyMessage(errorType, context),
      error.message,
      context,
      error
    )
  }

  /**
   * 推断错误类型
   */
  private inferErrorType(error: Error): StoreErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('network') || message.includes('fetch')) {
      return StoreErrorType.NETWORK_ERROR
    }
    if (message.includes('timeout')) {
      return StoreErrorType.TIMEOUT_ERROR
    }
    if (message.includes('permission') || message.includes('denied')) {
      return StoreErrorType.PERMISSION_DENIED
    }
    if (message.includes('auth') || message.includes('token')) {
      return StoreErrorType.AUTHENTICATION_ERROR
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return StoreErrorType.DATA_VALIDATION_ERROR
    }
    if (message.includes('not found') || message.includes('404')) {
      return StoreErrorType.DATA_NOT_FOUND
    }
    if (message.includes('sync') || message.includes('synchronization')) {
      return StoreErrorType.DATA_SYNC_ERROR
    }
    if (message.includes('business') || message.includes('logic')) {
      return StoreErrorType.BUSINESS_LOGIC_ERROR
    }
    if (message.includes('operation') || message.includes('failed')) {
      return StoreErrorType.OPERATION_FAILED
    }
    if (message.includes('system') || message.includes('critical')) {
      return StoreErrorType.SYSTEM_ERROR
    }

    return StoreErrorType.UNKNOWN_ERROR
  }

  /**
   * 推断严重程度
   */
  private inferSeverity(type: StoreErrorType): ErrorSeverity {
    const severityMap = {
      [StoreErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [StoreErrorType.TIMEOUT_ERROR]: ErrorSeverity.LOW,
      [StoreErrorType.DATA_VALIDATION_ERROR]: ErrorSeverity.LOW,
      [StoreErrorType.DATA_NOT_FOUND]: ErrorSeverity.LOW,
      [StoreErrorType.DATA_SYNC_ERROR]: ErrorSeverity.MEDIUM,
      [StoreErrorType.PERMISSION_DENIED]: ErrorSeverity.HIGH,
      [StoreErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
      [StoreErrorType.BUSINESS_LOGIC_ERROR]: ErrorSeverity.MEDIUM,
      [StoreErrorType.OPERATION_FAILED]: ErrorSeverity.MEDIUM,
      [StoreErrorType.SYSTEM_ERROR]: ErrorSeverity.CRITICAL,
      [StoreErrorType.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
    }

    return severityMap[type] || ErrorSeverity.MEDIUM
  }

  /**
   * 推断恢复策略
   */
  private inferRecoveryStrategy(type: StoreErrorType): RecoveryStrategy {
    const strategyMap = {
      [StoreErrorType.NETWORK_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.TIMEOUT_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.DATA_VALIDATION_ERROR]: RecoveryStrategy.MANUAL,
      [StoreErrorType.DATA_NOT_FOUND]: RecoveryStrategy.FALLBACK,
      [StoreErrorType.DATA_SYNC_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.PERMISSION_DENIED]: RecoveryStrategy.MANUAL,
      [StoreErrorType.AUTHENTICATION_ERROR]: RecoveryStrategy.MANUAL,
      [StoreErrorType.BUSINESS_LOGIC_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.OPERATION_FAILED]: RecoveryStrategy.RETRY,
      [StoreErrorType.SYSTEM_ERROR]: RecoveryStrategy.MANUAL,
      [StoreErrorType.UNKNOWN_ERROR]: RecoveryStrategy.RETRY
    }

    return strategyMap[type] || RecoveryStrategy.RETRY
  }

  /**
   * 记录错误
   */
  private recordError(error: StoreError): void {
    this.errorHistory.push(error)
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift()
    }
  }

  /**
   * 记录日志
   */
  private logError(error: StoreError): void {
    const logLevel = this.getLogLevel(error.severity)
    logger[logLevel]('StoreErrorHandler', error.technicalMessage, {
      type: error.type,
      severity: error.severity,
      context: error.context,
      originalError: error.originalError
    })
  }

  /**
   * 获取日志级别
   */
  private getLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error'
      default:
        return 'warn'
    }
  }

  /**
   * 执行恢复策略
   */
  private async executeRecoveryStrategy(error: StoreError): Promise<void> {
    switch (error.recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        // 自动重试逻辑 - 可以在这里实现重试机制
        logger.info('StoreErrorHandler', `准备重试操作: ${error.type}`)
        break
      case RecoveryStrategy.FALLBACK:
        // 降级处理逻辑 - 可以在这里实现降级策略
        logger.info('StoreErrorHandler', `执行降级处理: ${error.type}`)
        break
      case RecoveryStrategy.MANUAL:
        // 需要用户手动处理 - 可以在这里触发用户通知
        logger.warn('StoreErrorHandler', `需要用户手动处理: ${error.type}`)
        break
      case RecoveryStrategy.NONE:
      default:
        // 无恢复策略
        break
    }
  }

  /**
   * 获取错误历史
   */
  getErrorHistory(): StoreError[] {
    return [...this.errorHistory]
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory = []
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    total: number
    byType: Record<StoreErrorType, number>
    bySeverity: Record<ErrorSeverity, number>
  } {
    const byType = {} as Record<StoreErrorType, number>
    const bySeverity = {} as Record<ErrorSeverity, number>

    // 初始化计数器
    Object.values(StoreErrorType).forEach(type => {
      byType[type] = 0
    })
    Object.values(ErrorSeverity).forEach(severity => {
      bySeverity[severity] = 0
    })

    // 统计错误
    this.errorHistory.forEach(error => {
      byType[error.type]++
      bySeverity[error.severity]++
    })

    return {
      total: this.errorHistory.length,
      byType,
      bySeverity
    }
  }
}
