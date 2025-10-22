/**
 * 健康检查应用层类型定义
 *
 * 包含应用健康状态相关的所有类型定义
 */

import type { Timestamp } from '../core/common'

/**
 * 健康概览接口
 *
 * 应用健康状态的概览信息
 */
export interface HealthOverview {
  /** 总扫描数量 */
  totalScanned: number

  /** 无法访问的书签数量（统一统计 4xx/5xx/超时等失败状态） */
  dead: number

  /** 重复书签数量 */
  duplicateCount: number

  /** 最后扫描时间 */
  lastScanTime?: Timestamp
}

/**
 * HTTP 状态统计接口
 *
 * HTTP 状态码的统计信息
 */
export interface HttpStatusStats {
  /** 成功请求数 (2xx) */
  success: number

  /** 重定向数 (3xx) */
  redirects: number

  /** 失败请求数（4xx/5xx/超时等） */
  failures: number

  /** 总请求数 */
  total: number

  /** 成功率 (0-1) */
  successRate: number
}

/**
 * 系统健康状态接口
 *
 * 系统各组件的健康状态
 */
export interface SystemHealth {
  /** 数据库健康状态 */
  database: ComponentHealth

  /** API 健康状态 */
  api: ComponentHealth

  /** 缓存健康状态 */
  cache: ComponentHealth

  /** Worker 健康状态 */
  worker: ComponentHealth

  /** 整体健康状态 */
  overall: 'healthy' | 'degraded' | 'unhealthy'
}

/**
 * 组件健康状态接口
 *
 * 单个组件的健康状态
 */
export interface ComponentHealth {
  /** 组件名称 */
  name: string

  /** 健康状态 */
  status: 'healthy' | 'degraded' | 'unhealthy'

  /** 响应时间（毫秒） */
  responseTime?: number

  /** 错误数量 */
  errorCount?: number

  /** 最后检查时间 */
  lastCheckTime: Timestamp

  /** 错误消息 */
  message?: string
}

/**
 * 性能指标接口
 *
 * 应用性能相关的指标
 */
export interface PerformanceMetrics {
  /** 内存使用量（字节） */
  memoryUsage: number

  /** CPU 使用率 (0-1) */
  cpuUsage?: number

  /** 平均响应时间（毫秒） */
  avgResponseTime: number

  /** P95 响应时间（毫秒） */
  p95ResponseTime: number

  /** 请求速率（请求/秒） */
  requestRate: number

  /** 错误率 (0-1) */
  errorRate: number
}

/**
 * 健康检查配置接口
 *
 * 健康检查的配置选项
 */
export interface HealthCheckConfig {
  /** 检查间隔（毫秒） */
  interval: number

  /** 超时时间（毫秒） */
  timeout: number

  /** 是否启用自动检查 */
  autoCheck: boolean

  /** 需要检查的组件列表 */
  components: string[]

  /** 失败重试次数 */
  retries: number
}
