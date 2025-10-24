export interface ServiceStatus {
  name: string
  healthy: boolean
  lastCheckedAt: number
  details?: string
}

export interface RetryPolicy {
  maxAttempts: number
  backoffMs: number
  jitter?: number
}

export interface ServiceConfig {
  baseUrl: string
  timeout: number
  headers?: Record<string, string>
  retry?: RetryPolicy
}
