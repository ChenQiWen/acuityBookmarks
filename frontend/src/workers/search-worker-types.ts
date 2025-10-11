// 搜索 Worker 与主线程适配器共享的类型定义
// 说明：定义消息协议（Command/Event）与最小索引文档形状，确保两端一致

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

// Worker 索引中的最小投影（字段均为已规范化/小写形式）
export interface WorkerDoc {
  id: string
  titleLower: string
  urlLower?: string
  domain?: string
  keywords?: string[]
  isFolder?: boolean
}

export interface WorkerHit {
  id: string
  score: number
}
