/**
 * 查询 Worker 类型定义
 *
 * @deprecated WorkerDoc 和 WorkerHit 已迁移到 @/types/domain/query
 * 新代码请直接从 @/types 导入
 */

import type {
  WorkerDoc as WorkerDocType,
  WorkerHit as WorkerHitType
} from '../types/domain/query'

// 重新导出已迁移的类型
export type WorkerDoc = WorkerDocType
export type WorkerHit = WorkerHitType

/**
 * Worker 命令类型
 */
export type SearchWorkerCommand =
  | { type: 'init'; docs: WorkerDoc[]; options?: WorkerInitOptions }
  | { type: 'query'; q: string; limit?: number; reqId: number }
  | {
      type: 'applyPatch'
      adds?: WorkerDoc[]
      updates?: WorkerDoc[]
      removes?: string[]
    }
  | { type: 'dispose' }

/**
 * Worker 事件类型
 */
export type SearchWorkerEvent =
  | { type: 'ready' }
  | { type: 'inited'; docCount: number }
  | { type: 'result'; reqId: number; hits: WorkerHit[] }
  | { type: 'error'; message: string; reqId?: number }

/**
 * Worker 初始化选项
 */
export interface WorkerInitOptions {
  threshold?: number
  keys?: Array<{ name: keyof WorkerDoc; weight?: number }>
}
