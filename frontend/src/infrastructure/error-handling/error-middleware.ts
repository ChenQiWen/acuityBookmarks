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
 *
 * 自动捕获和处理函数中的错误，转换为 StoreError 并记录
 *
 * @param fn - 要包装的异步函数
 * @param context - 可选的上下文信息，用于错误追踪
 * @returns 包装后的函数
 *
 * @example
 * ```ts
 * const safeFunction = withErrorHandling(async (id: string) => {
 *   return await fetchData(id)
 * }, { component: 'MyComponent' })
 * ```
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
 *
 * 自动捕获和处理同步函数中的错误
 *
 * @param fn - 要包装的同步函数
 * @param context - 可选的上下文信息
 * @returns 包装后的函数
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
 *
 * 自动重试失败的操作，使用指数退避策略
 *
 * @param fn - 要包装的异步函数
 * @param maxRetries - 最大重试次数，默认 3
 * @param delay - 基础延迟时间（毫秒），默认 1000
 * @param context - 可选的上下文信息
 * @returns 包装后的函数
 *
 * @example
 * ```ts
 * const retryableFunction = withRetry(
 *   async (url: string) => await fetch(url),
 *   3, // 最多重试3次
 *   1000, // 初始延迟1秒，后续呈指数增长
 *   { operation: 'fetch' }
 * )
 * ```
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
 *
 * 为异步操作添加超时控制，超时后自动拒绝
 *
 * @param fn - 要包装的异步函数
 * @param timeoutMs - 超时时间（毫秒），默认 5000
 * @param context - 可选的上下文信息
 * @returns 包装后的函数
 *
 * @example
 * ```ts
 * const timeoutFunction = withTimeout(
 *   async () => await longRunningOperation(),
 *   3000 // 3秒超时
 * )
 * ```
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
 *
 * 将多个装饰器组合应用到同一个函数上
 *
 * @param fn - 原始函数
 * @param decorators - 装饰器数组
 * @param context - 可选的上下文信息
 * @returns 经过所有装饰器包装的函数
 *
 * @example
 * ```ts
 * const enhancedFn = composeDecorators(
 *   originalFn,
 *   [
 *     (fn) => withTimeout(fn, 3000),
 *     (fn) => withRetry(fn, 2)
 *   ]
 * )
 * ```
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
 * 错误处理工具类
 *
 * 提供一系列安全执行操作的静态方法
 */
export class ErrorHandlingUtils {
  /**
   * 安全执行异步操作
   *
   * 捕获并处理错误，失败时返回默认值
   *
   * @param operation - 要执行的异步操作
   * @param fallback - 失败时的默认返回值
   * @param context - 可选的上下文信息
   * @returns 操作结果或默认值
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
   *
   * 捕获并处理同步函数中的错误
   *
   * @param operation - 要执行的同步操作
   * @param fallback - 失败时的默认返回值
   * @param context - 可选的上下文信息
   * @returns 操作结果或默认值
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
   * 批量安全执行异步操作
   *
   * 执行多个操作，即使部分失败也继续执行其他操作
   *
   * @param operations - 异步操作数组
   * @param context - 可选的上下文信息
   * @returns 结果数组，失败的操作返回 undefined
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
   *
   * @param error - StoreError 实例
   * @returns 如果错误可重试返回 true
   */
  static isRetryableError(error: StoreError): boolean {
    return error.recoveryStrategy === 'RETRY' && error.severity !== 'CRITICAL'
  }

  /**
   * 检查是否需要用户手动操作
   *
   * @param error - StoreError 实例
   * @returns 如果需要用户介入返回 true
   */
  static isUserActionRequired(error: StoreError): boolean {
    return error.recoveryStrategy === 'MANUAL'
  }
}
