/**
 * IndexedDB 基础设施类型定义
 *
 * 包含 IndexedDB 相关的所有类型定义
 */

/**
 * IndexedDB 数据库配置接口
 *
 * 数据库的配置信息
 */
export interface IndexedDBConfig {
  /** 数据库名称 */
  name: string

  /** 数据库版本 */
  version: number

  /** 对象存储配置 */
  stores: StoreConfig[]

  /** 超时时间（毫秒） */
  timeout?: number

  /** 是否启用调试模式 */
  debug?: boolean
}

/**
 * 对象存储配置接口
 *
 * 单个对象存储的配置
 */
export interface StoreConfig {
  /** 存储名称 */
  name: string

  /** 主键路径 */
  keyPath: string | string[]

  /** 是否自动递增 */
  autoIncrement?: boolean

  /** 索引配置 */
  indexes?: IndexConfig[]
}

/**
 * 索引配置接口
 *
 * 对象存储索引的配置
 */
export interface IndexConfig {
  /** 索引名称 */
  name: string

  /** 索引键路径 */
  keyPath: string | string[]

  /** 是否唯一 */
  unique?: boolean

  /** 是否允许多条目 */
  multiEntry?: boolean
}

/**
 * 事务模式类型
 *
 * IndexedDB 事务的模式
 */
export type TransactionMode = 'readonly' | 'readwrite' | 'versionchange'

/**
 * 查询选项接口
 *
 * 查询数据时的选项
 */
export interface QueryOptions {
  /** 索引名称 */
  index?: string

  /** 查询范围 */
  range?: IDBKeyRange

  /** 排序方向 */
  direction?: IDBCursorDirection

  /** 限制数量 */
  limit?: number

  /** 偏移量 */
  offset?: number

  /** 过滤函数 */
  filter?: (value: unknown) => boolean
}

/**
 * 批量操作配置接口
 *
 * 批量操作的配置选项
 */
export interface BatchOperationConfig {
  /** 批次大小 */
  batchSize: number

  /** 是否并行执行 */
  parallel?: boolean

  /** 错误处理策略 */
  errorStrategy: 'continue' | 'stop' | 'rollback'

  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void
}

/**
 * 数据库迁移接口
 *
 * 数据库版本升级迁移
 */
export interface DatabaseMigration {
  /** 目标版本 */
  version: number

  /** 升级函数 */
  upgrade: (
    db: IDBDatabase,
    transaction: IDBTransaction
  ) => void | Promise<void>

  /** 降级函数（可选） */
  downgrade?: (
    db: IDBDatabase,
    transaction: IDBTransaction
  ) => void | Promise<void>
}

/**
 * 数据库状态接口
 *
 * 数据库连接状态
 */
export interface DatabaseState {
  /** 是否已连接 */
  isConnected: boolean

  /** 是否正在连接 */
  isConnecting: boolean

  /** 数据库名称 */
  name: string

  /** 当前版本 */
  version: number

  /** 对象存储列表 */
  stores: string[]

  /** 最后错误 */
  lastError: string | null
}

/**
 * 存储统计接口
 *
 * 对象存储的统计信息
 */
export interface StoreStats {
  /** 存储名称 */
  name: string

  /** 记录数量 */
  count: number

  /** 估计大小（字节） */
  estimatedSize?: number

  /** 索引列表 */
  indexes: string[]

  /** 最后更新时间 */
  lastUpdated?: number
}

/**
 * 连接池配置接口
 *
 * IndexedDB 连接池配置
 */
export interface ConnectionPoolConfig {
  /** 最大连接数 */
  maxConnections: number

  /** 连接超时（毫秒） */
  connectionTimeout: number

  /** 空闲超时（毫秒） */
  idleTimeout: number

  /** 是否启用池 */
  enabled: boolean
}

/**
 * 性能监控接口
 *
 * IndexedDB 操作性能监控
 */
export interface PerformanceMetrics {
  /** 操作类型 */
  operation: 'read' | 'write' | 'delete' | 'query'

  /** 存储名称 */
  storeName: string

  /** 耗时（毫秒） */
  duration: number

  /** 影响的记录数 */
  recordCount: number

  /** 时间戳 */
  timestamp: number

  /** 是否成功 */
  success: boolean

  /** 错误信息 */
  error?: string
}
