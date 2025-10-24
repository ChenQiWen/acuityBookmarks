export type FontSource = 'google' | 'local' | 'system'

export interface FontDescriptor {
  family: string
  source: FontSource
  weights: number[]
  subsets?: string[]
  fallback?: string
}

export interface FontLoadTask {
  id: string
  descriptor: FontDescriptor
  status: 'pending' | 'loading' | 'loaded' | 'failed'
  startedAt: number
  finishedAt?: number
  error?: string
}
