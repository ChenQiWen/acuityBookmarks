export type Optional<T> = {
  [P in keyof T]?: T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

export type ValueOf<T> = T[keyof T]

export type KeyPath<T> = T extends object
  ? {
      [K in keyof T]: K extends string | number
        ? T[K] extends object
          ? `${K}` | `${K}.${KeyPath<T[K]>}`
          : `${K}`
        : never
    }[keyof T]
  : never

export type Callback<Args extends unknown[] = [], Return = void> = (
  ...args: Args
) => Return

export type AsyncCallback<Args extends unknown[] = [], Return = void> = (
  ...args: Args
) => Promise<Return>

export type Nullable<T> = T | null
export type Maybe<T> = T | undefined
export type OptionalNullable<T> = T | null | undefined

export type ID = string | number
export type Timestamp = number

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

export interface JSONObject {
  [key: string]: JSONValue
}

export type Constructor<T = unknown> = new (...args: unknown[]) => T
export type AbstractConstructor<T = unknown> = abstract new (
  ...args: unknown[]
) => T

export type AnyFunction = (...args: unknown[]) => unknown
export type AnyObject = Record<string, unknown>

export type ArrayElement<T extends readonly unknown[]> =
  T extends ReadonlyArray<infer E> ? E : never

export type PromiseValue<T> = T extends Promise<infer U> ? U : T

export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export type PickStrict<T, K extends keyof T> = Pick<T, K>

export type Merge<A, B> = Omit<A, keyof B> & B

export type Flatten<T> = T extends infer U ? { [K in keyof U]: U[K] } : never
