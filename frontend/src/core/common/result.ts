/**
 * Result 类型 - 统一错误处理模式
 *
 * 设计目标：
 * - 统一异步操作的错误处理
 * - 避免异常传播，明确错误类型
 * - 提供类型安全的错误处理
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * 创建成功结果
 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

/**
 * 创建错误结果
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * 类型守卫：检查是否为成功结果
 */
export function isOk<T, E>(
  result: Result<T, E>
): result is { ok: true; value: T } {
  return result.ok === true
}

/**
 * 类型守卫：检查是否为错误结果
 */
export function isErr<T, E>(
  result: Result<T, E>
): result is { ok: false; error: E } {
  return result.ok === false
}

/**
 * 解包结果，成功时返回值，失败时抛出错误
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value
  throw result.error
}

/**
 * 解包结果，失败时返回默认值
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue
}

/**
 * 解包结果，失败时执行回调函数
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  callback: (error: E) => T
): T {
  return result.ok ? result.value : callback(result.error)
}

/**
 * 映射成功值
 */
export function map<T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(mapper(result.value))
  }
  return result
}

/**
 * 映射错误值
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  mapper: (error: E) => F
): Result<T, F> {
  if (result.ok) {
    return result
  }
  return err(mapper(result.error))
}

/**
 * 链式操作
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return mapper(result.value)
  }
  return result
}
