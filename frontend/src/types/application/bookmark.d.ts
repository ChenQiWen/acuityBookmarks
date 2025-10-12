/**
 * 书签应用服务类型定义
 *
 * 包含书签应用层服务相关的所有类型定义
 */

import type { BookmarkNode } from '../domain/bookmark'

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (
  completed: number,
  total: number,
  message?: string
) => void

/**
 * 计划和执行选项接口
 *
 * 书签变更计划和执行的配置选项
 */
export interface PlanAndExecuteOptions {
  /** 执行器实例 (SmartBookmarkExecutor) */
  executor?: unknown

  /** 进度回调函数 */
  onProgress?: ProgressCallback

  /** 是否执行干运行（仅计划不执行） */
  dryRun?: boolean

  /** 是否自动应用变更 */
  autoApply?: boolean

  /** 批处理大小 */
  batchSize?: number

  /** 是否显示进度 */
  showProgress?: boolean

  /** 错误处理策略 */
  errorStrategy?: 'continue' | 'stop' | 'rollback'
}

/**
 * 书签变更类型
 *
 * 书签可能发生的变更操作
 */
export type BookmarkChangeType = 'create' | 'update' | 'move' | 'delete'

/**
 * 书签变更记录接口
 *
 * 单个书签变更的记录
 */
export interface BookmarkChange {
  /** 变更类型 */
  type: BookmarkChangeType

  /** 书签ID */
  id: string

  /** 父节点ID */
  parentId?: string

  /** 索引位置 */
  index?: number

  /** 标题 */
  title?: string

  /** URL */
  url?: string

  /** 原始数据 */
  before?: Partial<BookmarkNode>

  /** 变更后数据 */
  after?: Partial<BookmarkNode>
}

/**
 * 差异结果接口
 *
 * 书签树比较的差异结果
 */
export interface DiffResult {
  /** 需要创建的节点 */
  toCreate: BookmarkChange[]

  /** 需要更新的节点 */
  toUpdate: BookmarkChange[]

  /** 需要移动的节点 */
  toMove: BookmarkChange[]

  /** 需要删除的节点 */
  toDelete: BookmarkChange[]

  /** 总变更数 */
  totalChanges: number

  /** 是否有变更 */
  hasChanges: boolean
}

/**
 * 执行结果接口
 *
 * 书签变更执行的结果
 */
export interface ExecutionResult {
  /** 成功数量 */
  successCount: number

  /** 失败数量 */
  failureCount: number

  /** 跳过数量 */
  skippedCount: number

  /** 总数量 */
  totalCount: number

  /** 成功的变更 */
  succeeded: BookmarkChange[]

  /** 失败的变更 */
  failed: Array<{
    change: BookmarkChange
    error: string
  }>

  /** 执行时间（毫秒） */
  duration: number
}

/**
 * 书签同步状态接口
 *
 * 书签同步的状态信息
 */
export interface BookmarkSyncStatus {
  /** 是否正在同步 */
  isSyncing: boolean

  /** 最后同步时间 */
  lastSyncTime: number | null

  /** 同步进度 (0-100) */
  progress: number

  /** 同步的书签数 */
  syncedCount: number

  /** 总书签数 */
  totalCount: number

  /** 同步错误 */
  error: string | null
}

/**
 * 书签验证结果接口
 *
 * 书签数据验证的结果
 */
export interface BookmarkValidationResult {
  /** 是否有效 */
  isValid: boolean

  /** 验证错误列表 */
  errors: Array<{
    /** 书签ID */
    id: string
    /** 错误类型 */
    type: string
    /** 错误消息 */
    message: string
  }>

  /** 验证警告列表 */
  warnings: Array<{
    /** 书签ID */
    id: string
    /** 警告类型 */
    type: string
    /** 警告消息 */
    message: string
  }>
}

/**
 * 批量操作选项接口
 *
 * 批量书签操作的配置
 */
export interface BatchOperationOptions {
  /** 批处理大小 */
  batchSize: number

  /** 批次间延迟（毫秒） */
  batchDelay: number

  /** 是否并行执行 */
  parallel: boolean

  /** 最大并发数 */
  maxConcurrency: number

  /** 错误处理策略 */
  errorHandling: 'continue' | 'stop' | 'rollback'

  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void

  /** 批次完成回调 */
  onBatchComplete?: (batchIndex: number, batchSize: number) => void
}
