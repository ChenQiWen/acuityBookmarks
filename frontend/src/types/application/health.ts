export interface HealthOverview {
  /** 总扫描数量 */
  totalScanned: number
  /** 死亡书签数量 */
  dead: number
  /** 重复书签数量 */
  duplicateCount: number
  /** 最后扫描时间 */
  lastScanAt?: number
}

export interface HealthScanTask {
  /** 任务ID */
  id: string
  /** 任务状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 已处理数量 */
  processed: number
  /** 总数量 */
  total: number
  /** 开始时间 */
  startedAt: number
  /** 完成时间 */
  finishedAt?: number
  /** 错误信息 */
  error?: string
}
