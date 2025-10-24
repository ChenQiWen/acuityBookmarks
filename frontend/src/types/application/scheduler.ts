export interface ScheduledTask {
  id: string
  createdAt: number
  runAt: number
  completedAt?: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

export interface SchedulerConfig {
  concurrency: number
  tickIntervalMs: number
}
