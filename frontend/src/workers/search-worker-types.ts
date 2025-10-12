/**
 * 搜索 Worker 与主线程适配器共享的类型定义
 *
 * ⚠️ DEPRECATED: WorkerDoc 和 WorkerHit 已迁移到 @/types/domain/search
 *
 * 为保持向后兼容，此文件暂时保留。
 * 新代码请直接从 @/types 导入。
 *
 * @deprecated 使用 import type { WorkerDoc, WorkerHit } from '@/types'
 */

// 重新导出已迁移的类型
export type { WorkerDoc, WorkerHit } from '@/types/domain/search'

// Worker 特定的命令和事件类型保留在此处（未迁移到全局类型）
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

export type SearchWorkerEvent =
  | { type: 'ready' }
  | { type: 'inited'; docCount: number }
  | { type: 'result'; reqId: number; hits: WorkerHit[] }
  | { type: 'error'; message: string; reqId?: number }

export interface WorkerInitOptions {
  threshold?: number
  keys?: Array<{ name: keyof WorkerDoc; weight?: number }>
}
