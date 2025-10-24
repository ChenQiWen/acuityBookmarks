export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface ScheduleOptions {
  delayMs?: number
  priority?: TaskPriority
  timeoutMs?: number
  retries?: number
  retryDelay?: number
}

export interface TaskOptions {
  timeoutMs: number
  priority: TaskPriority
  retries: number
  retryDelay: number
}

export interface Task {
  id: string
  name: string
  type: string
  priority: TaskPriority
  fn: () => void | Promise<void>
  options: TaskOptions
  createdAt: number
  retryCount: number
}

export interface SchedulerConfig {
  defaultTimeout: number
  retryDelay: number
  maxRetries: number
  maxConcurrentTasks: number
  enablePriorityQueue: boolean
  enableRetry: boolean
}
