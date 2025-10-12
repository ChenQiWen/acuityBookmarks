/**
 * 错误处理中间件
 *
 * 提供统一的错误处理装饰器和工具函数
 */

import { StoreErrorHandler } from './store-error-handler'
import {
  StoreError,
  StoreErrorType,
  ErrorSeverity,
  RecoveryStrategy
} from '@/core/common/store-error'

/**
 * 错误处理装饰器
 * 自动捕获和处理函数中的错误
 */
export function withErrorHandling<
  T extends (...args: unknown[]) => Promise<unknown>
>(fn: T, context?: Record<string, unknown>): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      const storeError = await StoreErrorHandler.getInstance().handleError(
        error as Error,
        context
      )
      throw storeError
    }
  }) as T
}

/**
 * 同步错误处理装饰器
 */
export function withSyncErrorHandling<
  T extends (...args: unknown[]) => unknown
>(fn: T, context?: Record<string, unknown>): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args)
    } catch (error) {
      // 同步函数中的错误处理
      const storeError = new StoreError(
        StoreErrorType.UNKNOWN_ERROR,
        ErrorSeverity.MEDIUM,
        RecoveryStrategy.RETRY,
        '操作失败，请重试',
        (error as Error).message,
        context,
        error as Error
      )

      StoreErrorHandler.getInstance().handleError(storeError, context)
      throw storeError
    }
  }) as T
}

/**
 * 重试装饰器
 * 自动重试失败的操作
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  maxRetries: number = 3,
  delay: number = 1000,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args)
      } catch (error) {
        lastError = error as Error

        if (attempt === maxRetries) {
          // 最后一次尝试失败，抛出错误
          const storeError = await StoreErrorHandler.getInstance().handleError(
            error as Error,
            { ...context, attempt, maxRetries }
          )
          throw storeError
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
      }
    }

    throw lastError
  }) as T
}

/**
 * 超时装饰器
 * 为异步操作添加超时控制
 */
<<<<<<< HEAD
export function withTimeout<T extends (...args: unknown[]) => Promise<unknown>>(
=======
export function withTimeout<T extends (...args: never[]) => Promise<unknown>>(
>>>>>>> 543115e (feat(build): 完成构建错误修复与优化)
  fn: T,
  timeoutMs: number = 5000,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`操作超时 (${timeoutMs}ms)`))
      }, timeoutMs)
    })

    try {
      return await Promise.race([fn(...args), timeoutPromise])
    } catch (error) {
      const storeError = await StoreErrorHandler.getInstance().handleError(
        error as Error,
        { ...context, timeoutMs }
      )
      throw storeError
    }
  }) as T
}

/**
 * 组合装饰器
 * 组合多个装饰器
 */
export function composeDecorators<
<<<<<<< HEAD
  T extends (...args: unknown[]) => Promise<unknown>
=======
  T extends (...args: never[]) => Promise<unknown>
>>>>>>> 543115e (feat(build): 完成构建错误修复与优化)
>(
  fn: T,
  decorators: Array<(fn: T, context?: Record<string, unknown>) => T>,
  context?: Record<string, unknown>
): T {
  return decorators.reduce((wrappedFn, decorator) => {
    return decorator(wrappedFn, context)
  }, fn)
}

/**
 * 错误处理工具函数
 */
export class ErrorHandlingUtils {
  /**
   * 安全执行异步操作
   */
  static async safeExecute<T>(
    operation: () => Promise<T>,
    fallback?: T,
    context?: Record<string, unknown>
  ): Promise<T | undefined> {
    try {
      return await operation()
    } catch (error) {
      await StoreErrorHandler.getInstance().handleError(error as Error, context)
      return fallback
    }
  }

  /**
   * 安全执行同步操作
   */
  static safeExecuteSync<T>(
    operation: () => T,
    fallback?: T,
    context?: Record<string, unknown>
  ): T | undefined {
    try {
      return operation()
    } catch (error) {
      StoreErrorHandler.getInstance().handleError(error as Error, context)
      return fallback
    }
  }

  /**
   * 批量安全执行
   */
  static async safeExecuteBatch<T>(
    operations: Array<() => Promise<T>>,
    context?: Record<string, unknown>
  ): Promise<Array<T | undefined>> {
    const results = await Promise.allSettled(
      operations.map(operation =>
        ErrorHandlingUtils.safeExecute(operation, undefined, context)
      )
    )

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : undefined
    )
  }

  /**
   * 检查是否为可重试错误
   */
  static isRetryableError(error: StoreError): boolean {
    return error.recoveryStrategy === 'RETRY' && error.severity !== 'CRITICAL'
  }

  /**
   * 检查是否为用户操作错误
   */
  static isUserActionRequired(error: StoreError): boolean {
    return error.recoveryStrategy === 'MANUAL'
  }
}
