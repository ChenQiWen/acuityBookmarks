/**
 * 调度器应用层类型定义
 *
 * 包含任务调度相关的所有类型定义
 */

import type { Callback } from '../core/common'

/**
 * 任务类型
 *
 * 定义不同优先级的任务类型
 */
export type TaskType = 'ui-update' | 'microtask' | 'background' | 'animation'

/**
 * 调度选项接口
 *
 * 配置任务调度的选项
 */
export interface ScheduleOptions {
  /** 任务优先级 */
  priority?: 'high' | 'normal' | 'low'

  /** 延迟执行时间（毫秒） */
  delay?: number

  /** 超时时间（毫秒） */
  timeout?: number
}

/**
 * 任务接口
 *
 * 表示一个待执行的任务
 */
export interface Task {
  /** 任务ID */
  id: string

  /** 任务类型 */
  type: TaskType

  /** 任务回调函数 */
  callback: Callback

  /** 任务优先级 */
  priority: 'high' | 'normal' | 'low'

  /** 创建时间 */
  createdAt: number

  /** 调度时间 */
  scheduledAt?: number

  /** 执行时间 */
  executedAt?: number
}

/**
 * 调度器配置接口
 *
 * 调度器的配置选项
 */
export interface SchedulerConfig {
  /** 最大并发任务数 */
  maxConcurrent: number

  /** 空闲超时时间（毫秒） */
  idleTimeout: number

  /** 是否启用性能监控 */
  enablePerfMonitoring: boolean

  /** 任务队列最大长度 */
  maxQueueSize: number

  /** 是否使用 requestIdleCallback */
  useIdleCallback: boolean

  /** 是否使用 requestAnimationFrame */
  useAnimationFrame: boolean
}

/**
 * 调度器状态接口
 *
 * 调度器的运行状态
 */
export interface SchedulerState {
  /** 是否正在运行 */
  isRunning: boolean

  /** 待执行任务数 */
  pendingTasks: number

  /** 正在执行的任务数 */
  runningTasks: number

  /** 已完成任务数 */
  completedTasks: number

  /** 失败任务数 */
  failedTasks: number

  /** 平均执行时间（毫秒） */
  avgExecutionTime: number
}

/**
 * 任务结果接口
 *
 * 任务执行的结果
 */
export interface TaskResult<T = unknown> {
  /** 任务ID */
  taskId: string

  /** 是否成功 */
  success: boolean

  /** 返回值 */
  value?: T

  /** 错误信息 */
  error?: string

  /** 执行时间（毫秒） */
  executionTime: number
}
