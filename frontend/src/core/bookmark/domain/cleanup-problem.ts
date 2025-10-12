/**
 * 书签清理问题领域模型
 */

export interface CleanupProblem {
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  severity: 'high' | 'medium' | 'low'
  description: string
  details?: string
  canAutoFix: boolean
  bookmarkId: string
  relatedNodeIds?: string[]
}

export interface CleanupTask {
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  targetIds: string[]
  settings: CleanupSettings
}

export interface CleanupSettings {
  enable404Check: boolean
  enableDuplicateCheck: boolean
  enableEmptyFolderCheck: boolean
  enableInvalidUrlCheck: boolean
  maxConcurrentRequests: number
  requestTimeout: number
  retryAttempts: number
}

export interface ScanProgress {
  type: string
  processed: number
  total: number
  foundIssues: number
  status: 'pending' | 'running' | 'completed' | 'error'
  estimatedTime?: string
}

export interface ScanResult {
  nodeId: string
  problems: CleanupProblem[]
  originalNode: unknown // 临时使用 unknown，后续会替换为 BookmarkNode
}

/**
 * 清理操作结果
 */
export interface CleanupResult {
  success: boolean
  processedCount: number
  fixedCount: number
  errorCount: number
  errors: string[]
  fixedProblems: CleanupProblem[]
}

/**
 * 问题严重性权重
 */
export const SEVERITY_WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1
} as const

/**
 * 获取问题严重性权重
 */
export function getSeverityWeight(
  severity: CleanupProblem['severity']
): number {
  return SEVERITY_WEIGHTS[severity]
}

/**
 * 计算问题总权重
 */
export function calculateProblemWeight(problems: CleanupProblem[]): number {
  return problems.reduce((total, problem) => {
    return total + getSeverityWeight(problem.severity)
  }, 0)
}
