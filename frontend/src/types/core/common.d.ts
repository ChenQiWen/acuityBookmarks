/**
 * 核心通用类型定义
 *
 * 包含项目中使用的通用类型、工具类型和基础类型
 */

/**
 * 可选的部分类型
 *
 * 将类型 T 的所有属性变为可选
 */
export type Optional<T> = {
  [P in keyof T]?: T[P]
}

/**
 * 必需的部分类型
 *
 * 将类型 T 的指定属性 K 变为必需
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * 深度可选类型
 *
 * 递归地将类型 T 的所有属性变为可选
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * 深度只读类型
 *
 * 递归地将类型 T 的所有属性变为只读
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * 值类型
 *
 * 提取对象类型 T 的所有值类型
 */
export type ValueOf<T> = T[keyof T]

/**
 * 键路径类型
 *
 * 提取对象类型 T 的所有嵌套键路径
 */
export type KeyPath<T> = T extends object
  ? {
      [K in keyof T]: K extends string | number
        ? T[K] extends object
          ? `${K}` | `${K}.${KeyPath<T[K]>}`
          : `${K}`
        : never
    }[keyof T]
  : never

/**
 * 回调函数类型
 *
 * @template Args - 参数类型数组
 * @template Return - 返回值类型
 */
export type Callback<Args extends unknown[] = [], Return = void> = (
  ...args: Args
) => Return

/**
 * 异步回调函数类型
 *
 * @template Args - 参数类型数组
 * @template Return - 返回值类型
 */
export type AsyncCallback<Args extends unknown[] = [], Return = void> = (
  ...args: Args
) => Promise<Return>

/**
 * 可空类型
 *
 * 类型 T 或 null
 */
export type Nullable<T> = T | null

/**
 * 可undefined类型
 *
 * 类型 T 或 undefined
 */
export type Maybe<T> = T | undefined

/**
 * 可空或undefined类型
 *
 * 类型 T、null 或 undefined
 */
export type Optional<T> = T | null | undefined

/**
 * ID 类型
 *
 * 通用的标识符类型
 */
export type ID = string | number

/**
 * 时间戳类型
 *
 * Unix 时间戳（毫秒）
 */
export type Timestamp = number

/**
 * JSON 值类型
 *
 * 可以序列化为 JSON 的值类型
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

/**
 * JSON 对象类型
 *
 * 可以序列化为 JSON 的对象类型
 */
export interface JSONObject {
  [key: string]: JSONValue
}

/**
 * 构造函数类型
 *
 * @template T - 实例类型
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T

/**
 * 抽象构造函数类型
 *
 * @template T - 实例类型
 */
export type AbstractConstructor<T = unknown> = abstract new (
  ...args: unknown[]
) => T

/**
 * 函数类型
 *
 * 通用的函数类型
 */
export type AnyFunction = (...args: unknown[]) => unknown

/**
 * 对象类型
 *
 * 通用的对象类型
 */
export type AnyObject = Record<string, unknown>

/**
 * 数组元素类型
 *
 * 提取数组类型 T 的元素类型
 */
export type ArrayElement<T extends readonly unknown[]> =
  T extends ReadonlyArray<infer E> ? E : never

/**
 * Promise 值类型
 *
 * 提取 Promise 类型 T 的值类型
 */
export type PromiseValue<T> = T extends Promise<infer U> ? U : T

/**
 * 排除键类型
 *
 * 从对象类型 T 中排除指定键 K
 */
export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

/**
 * 选择键类型
 *
 * 从对象类型 T 中选择指定键 K
 */
export type PickStrict<T, K extends keyof T> = Pick<T, K>

/**
 * 合并类型
 *
 * 合并两个对象类型，后者覆盖前者
 */
export type Merge<A, B> = Omit<A, keyof B> & B

/**
 * 扁平化类型
 *
 * 将交叉类型扁平化为单一对象类型
 */
export type Flatten<T> = T extends infer U ? { [K in keyof U]: U[K] } : never
