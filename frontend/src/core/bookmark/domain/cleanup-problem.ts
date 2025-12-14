/**
 * 书签清理问题领域模型
 */

export interface CleanupProblem {
  type: 'duplicate' | 'invalid' | 'internal'
  severity: 'high' | 'medium' | 'low'
  description: string
  details?: string
  canAutoFix: boolean
  bookmarkId: string
  relatedNodeIds?: string[]
}

export interface CleanupTask {
  type: 'duplicate' | 'invalid' | 'internal'
  targetIds: string[]
  settings: CleanupSettings
}

/**
 * @deprecated 已废弃：使用 ProblemTypeSettings from @/types/domain/cleanup 替代
 * 保留此类型仅用于向后兼容
 */
export interface CleanupSettings {
  duplicate?: Record<string, unknown>
  invalid?: Record<string, unknown>
}

export interface ScanProgress {
  type: string
  processed: number
  total: number
  foundIssues: number
  status: 'pending' | 'running' | 'completed' | 'error'
  estimatedTime?: string
}

import type { BookmarkNode } from './bookmark'

export interface ScanResult {
  nodeId: string
  problems: CleanupProblem[]
  originalNode: BookmarkNode
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
