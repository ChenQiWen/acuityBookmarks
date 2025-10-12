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
 *
 * 说明：使用显式参数与返回类型泛型，避免 any。
 */
export function withErrorHandling<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  context?: Record<string, unknown>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args)
    } catch (error) {
      const storeError = await StoreErrorHandler.getInstance().handleError(
        error as Error,
        context
      )
      throw storeError
    }
  }
}

/**
 * 同步错误处理装饰器
 */
export function withSyncErrorHandling<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  context?: Record<string, unknown>
): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
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
  }
}

/**
 * 重试装饰器
 * 自动重试失败的操作
 */
export function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  maxRetries: number = 3,
  delay: number = 1000,
  context?: Record<string, unknown>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
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
  }
}

/**
 * 超时装饰器
 * 为异步操作添加超时控制
 */
export function withTimeout<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  timeoutMs: number = 5000,
  context?: Record<string, unknown>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`操作超时 (${timeoutMs}ms)`))
      }, timeoutMs)
    })

    try {
      return (await Promise.race([
        fn(...args),
        timeoutPromise
      ])) as Promise<TResult>
    } catch (error) {
      const storeError = await StoreErrorHandler.getInstance().handleError(
        error as Error,
        { ...context, timeoutMs }
      )
      throw storeError
    }
  }
}

/**
 * 组合装饰器
 * 组合多个装饰器
 */
export function composeDecorators<
  T extends (...args: unknown[]) => Promise<unknown>
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
