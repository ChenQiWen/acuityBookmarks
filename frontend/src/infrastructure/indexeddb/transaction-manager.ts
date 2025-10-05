import { idbConnectionPool } from './connection-pool'

export type TxMode = 'readonly' | 'readwrite'

export interface TxOptions {
  retries?: number
  retryDelayMs?: number
  onRetry?: (attempt: number, error: unknown) => void
}

async function delay(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

export async function withTransaction<T>(
  stores: string[],
  mode: TxMode,
  cb: (tx: IDBTransaction) => Promise<T>,
  options: TxOptions = {}
): Promise<T> {
  const retries = Math.max(0, options.retries ?? 0)
  const retryDelayMs = options.retryDelayMs ?? 50
  let attempt = 0

  while (true) {
    try {
      const db = idbConnectionPool.getDB()
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(stores, mode)
        let resultValue: T | undefined
        let cbErrored = false

        tx.oncomplete = () => {
          if (!cbErrored) resolve(resultValue as T)
        }
        tx.onerror = () => {
          cbErrored = true
          reject(tx.error)
        }
        tx.onabort = () => {
          cbErrored = true
          reject(tx.error || new Error('IndexedDB 事务已中止'))
        }

        // 执行业务回调，等待其完成后由 oncomplete 统一 resolve
        ;(async () => {
          try {
            resultValue = await cb(tx)
          } catch (err) {
            cbErrored = true
            try { tx.abort() } catch {}
            reject(err)
          }
        })()
      })
    } catch (error) {
      if (attempt < retries) {
        attempt++
        options.onRetry?.(attempt, error)
        await delay(retryDelayMs)
        continue
      }
      throw error
    }
  }
}
