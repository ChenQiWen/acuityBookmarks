/**
 * IndexedDB 连接池（轻量版）
 * 目标：
 * - 统一管理单个打开的 IDBDatabase 连接，避免重复打开
 * - 提供显式 set/get 方法，便于由现有 Manager 完成初始化后注入
 */

export class IndexedDBConnectionPool {
  private static _instance: IndexedDBConnectionPool | null = null
  private _db: IDBDatabase | null = null

  static get instance(): IndexedDBConnectionPool {
    if (!this._instance) this._instance = new IndexedDBConnectionPool()
    return this._instance
  }

  setDB(db: IDBDatabase) {
    this._db = db
  }

  getDB(): IDBDatabase {
    if (!this._db) throw new Error('IndexedDBConnectionPool: 数据库尚未初始化')
    return this._db
  }

  close(): void {
    if (this._db) {
      this._db.close()
      this._db = null
    }
  }
}

export const idbConnectionPool = IndexedDBConnectionPool.instance
