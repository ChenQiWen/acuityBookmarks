// Shared types between search worker and main thread adapter

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

// Minimal projection stored in worker index
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
