export interface HealthOverview {
  totalScanned: number
  dead: number
  duplicateCount: number
  lastScanAt?: number
}

export interface HealthScanTask {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  processed: number
  total: number
  startedAt: number
  finishedAt?: number
  error?: string
}
