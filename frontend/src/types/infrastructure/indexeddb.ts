export interface IndexedDBConfig {
  name: string
  version: number
  stores: StoreConfig[]
  timeout?: number
  debug?: boolean
}

export interface StoreConfig {
  name: string
  keyPath: string | string[]
  autoIncrement?: boolean
  indexes?: IndexConfig[]
}

export interface IndexConfig {
  name: string
  keyPath: string | string[]
  unique?: boolean
  multiEntry?: boolean
}

export type TransactionMode = 'readonly' | 'readwrite' | 'versionchange'

export interface QueryOptions {
  index?: string
  range?: IDBKeyRange
  direction?: IDBCursorDirection
  limit?: number
  offset?: number
  filter?: (value: unknown) => boolean
}

export interface BatchOperationConfig {
  batchSize: number
  parallel?: boolean
  errorStrategy: 'continue' | 'stop' | 'rollback'
  onProgress?: (completed: number, total: number) => void
}

export interface DatabaseMigration {
  version: number
  upgrade: (
    db: IDBDatabase,
    transaction: IDBTransaction
  ) => void | Promise<void>
  downgrade?: (
    db: IDBDatabase,
    transaction: IDBTransaction
  ) => void | Promise<void>
}

export interface DatabaseState {
  isConnected: boolean
  isConnecting: boolean
  name: string
  version: number
  stores: string[]
  lastError: string | null
}

export interface StoreStats {
  name: string
  count: number
  estimatedSize?: number
  indexes: string[]
  lastUpdated?: number
}

export interface ConnectionPoolConfig {
  maxConnections: number
  connectionTimeout: number
  idleTimeout: number
}

export interface ConnectionPoolStats {
  activeConnections: number
  idleConnections: number
  waitingTasks: number
  totalConnections: number
}
