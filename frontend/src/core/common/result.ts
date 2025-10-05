// 统一 Result 类型及辅助函数
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const Err = <E = Error>(error: E): Result<never, E> => ({ ok: false, error });

export async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (e: any) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

export function tryCatch<T>(fn: () => T): Result<T> {
  try {
    return Ok(fn());
  } catch (e: any) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}
