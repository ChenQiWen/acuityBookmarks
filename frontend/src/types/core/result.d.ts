/**
 * Result 模式类型定义
 *
 * 提供统一的成功/失败结果处理，避免异常抛出
 *
 * @example
 * ```typescript
 * // 成功结果
 * const success: Result<string> = { ok: true, value: 'Hello' }
 *
 * // 失败结果
 * const failure: Result<string> = { ok: false, error: 'Error message' }
 *
 * // 使用结果
 * if (result.ok) {
 *   console.log(result.value) // 类型安全访问
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */

/**
 * Result 类型
 *
 * 表示操作的成功或失败结果
 *
 * @template T - 成功时的值类型
 * @template E - 失败时的错误类型，默认为 string
 */
export type Result<T, E = string> =
  | { ok: true; value: T; error?: never }
  | { ok: false; error: E; value?: never }

/**
 * 成功结果类型
 *
 * 表示操作成功的结果
 *
 * @template T - 成功值类型
 */
export interface Success<T> {
  ok: true
  value: T
  error?: never
}

/**
 * 失败结果类型
 *
 * 表示操作失败的结果
 *
 * @template E - 错误类型
 */
export interface Failure<E = string> {
  ok: false
  error: E
  value?: never
}

/**
 * 异步 Result 类型
 *
 * 表示异步操作的成功或失败结果
 *
 * @template T - 成功时的值类型
 * @template E - 失败时的错误类型
 */
export type AsyncResult<T, E = string> = Promise<Result<T, E>>

/**
 * Result 工具函数类型
 */
export interface ResultHelpers {
  /**
   * 创建成功结果
   *
   * @template T - 值类型
   * @param value - 成功值
   * @returns 成功结果
   */
  ok<T>(value: T): Success<T>

  /**
   * 创建失败结果
   *
   * @template E - 错误类型
   * @param error - 错误信息
   * @returns 失败结果
   */
  err<E = string>(error: E): Failure<E>

  /**
   * 检查是否为成功结果
   *
   * @template T, E - 结果类型参数
   * @param result - 结果对象
   * @returns 是否为成功结果
   */
  isOk<T, E = string>(result: Result<T, E>): result is Success<T>

  /**
   * 检查是否为失败结果
   *
   * @template T, E - 结果类型参数
   * @param result - 结果对象
   * @returns 是否为失败结果
   */
  isErr<T, E = string>(result: Result<T, E>): result is Failure<E>

  /**
   * 映射成功值
   *
   * @template T, U, E - 类型参数
   * @param result - 结果对象
   * @param fn - 映射函数
   * @returns 映射后的结果
   */
  map<T, U, E = string>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>

  /**
   * 映射错误值
   *
   * @template T, E, F - 类型参数
   * @param result - 结果对象
   * @param fn - 映射函数
   * @returns 映射后的结果
   */
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>

  /**
   * 链式操作
   *
   * @template T, U, E - 类型参数
   * @param result - 结果对象
   * @param fn - 链式函数
   * @returns 新的结果
   */
  andThen<T, U, E = string>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E>

  /**
   * 获取值或默认值
   *
   * @template T, E - 类型参数
   * @param result - 结果对象
   * @param defaultValue - 默认值
   * @returns 值或默认值
   */
  unwrapOr<T, E = string>(result: Result<T, E>, defaultValue: T): T

  /**
   * 获取值或抛出错误
   *
   * @template T, E - 类型参数
   * @param result - 结果对象
   * @returns 值
   * @throws 如果结果为失败
   */
  unwrap<T, E = string>(result: Result<T, E>): T
}

/**
 * 从 Promise 创建 Result
 *
 * @template T - 成功值类型
 * @param promise - Promise 对象
 * @returns Result Promise
 *
 * @example
 * ```typescript
 * const result = await fromPromise(fetch('/api/data'))
 * if (result.ok) {
 *   console.log(result.value)
 * }
 * ```
 */
export type FromPromise<T> = (promise: Promise<T>) => AsyncResult<T>

/**
 * Result 数组类型
 *
 * 表示多个 Result 的数组
 *
 * @template T - 成功值类型
 * @template E - 错误类型
 */
export type ResultArray<T, E = string> = Array<Result<T, E>>

/**
 * 全部成功或失败
 *
 * 如果所有 Result 都成功，返回值数组；否则返回第一个错误
 *
 * @template T - 成功值类型
 * @template E - 错误类型
 */
export type AllOrNothing<T, E = string> = (
  results: ResultArray<T, E>
) => Result<T[], E>
