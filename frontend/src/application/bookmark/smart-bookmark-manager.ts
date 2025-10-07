/**
 * 应用层兼容封装：SmartBookmarkManager（委派到 bookmarkChangeAppService）
 *
 * 目的：为历史使用方保留原 API（applyChanges / analyzeDifferences / getChangePreview / validateChanges），
 * 内部统一委派到 `bookmarkChangeAppService`，避免 utils 层承载业务编排。
 */

import { bookmarkChangeAppService } from './bookmark-change-app-service'
import type { ChromeBookmarkTreeNode, BookmarkNode } from '@/types'
import type {
  ExecutionResult,
  ProgressCallback
} from '@/core/bookmark/services/executor'
import type {
  DiffResult,
  BookmarkOperation
} from '@/core/bookmark/services/diff-engine'

export interface ApplyChangesOptions {
  enableProgressFeedback?: boolean
  maxConcurrency?: number
  enablePerformanceLogging?: boolean
  onProgress?: ProgressCallback
  onAnalysisComplete?: (diffResult: DiffResult) => void
  onExecutionComplete?: (result: ExecutionResult) => void
}

export interface ApplyChangesResult {
  success: boolean
  diff: DiffResult
  execution: ExecutionResult
  totalTime: number
  recommendations: string[]
}

export class SmartBookmarkManager {
  async applyChanges(
    originalTree: ChromeBookmarkTreeNode[],
    targetTree: ChromeBookmarkTreeNode[],
    options: ApplyChangesOptions = {}
  ): Promise<ApplyChangesResult> {
    const start = performance.now()
    const plan = await bookmarkChangeAppService.planChanges(
      originalTree as BookmarkNode[],
      targetTree as BookmarkNode[]
    )
    if (!plan.ok) throw plan.error
    options.onAnalysisComplete?.(plan.value)
    const exec = await bookmarkChangeAppService.executePlan(plan.value, {
      onProgress: options.onProgress
    })
    if (!exec.ok) throw exec.error
    options.onExecutionComplete?.(exec.value)
    const totalTime = performance.now() - start
    return {
      success: exec.value.success,
      diff: plan.value,
      execution: exec.value,
      totalTime,
      recommendations: []
    }
  }

  async analyzeDifferences(
    originalTree: ChromeBookmarkTreeNode[],
    targetTree: ChromeBookmarkTreeNode[]
  ) {
    const plan = await bookmarkChangeAppService.planChanges(
      originalTree as BookmarkNode[],
      targetTree as BookmarkNode[]
    )
    if (!plan.ok) throw plan.error
    return plan.value
  }

  async getChangePreview(
    originalTree: ChromeBookmarkTreeNode[],
    targetTree: ChromeBookmarkTreeNode[]
  ) {
    const diff = await this.analyzeDifferences(originalTree, targetTree)
    const details = (diff.operations || []).map((op: BookmarkOperation) => ({
      type: op.type,
      description: op.type,
      estimatedTime: op.estimatedCost
    }))
    return {
      summary: `发现 ${diff.operations?.length ?? 0} 个变更操作`,
      details,
      totalEstimatedTime: diff.stats?.estimatedTime ?? 0,
      complexity: diff.stats?.complexity ?? 'low',
      recommendation: diff.strategy?.reason ?? ''
    }
  }

  validateChanges(
    originalTree: ChromeBookmarkTreeNode[],
    targetTree: ChromeBookmarkTreeNode[]
  ) {
    const count = (nodes: ChromeBookmarkTreeNode[]): number =>
      nodes.reduce(
        (acc, n) => acc + 1 + (n.children ? count(n.children) : 0),
        0
      )
    const originalCount = count(originalTree)
    const targetCount = count(targetTree)
    const warnings: string[] = []
    const risks: string[] = []
    if (targetCount < originalCount * 0.5)
      risks.push('目标结构书签数量显著减少 (>50%)')
    if (targetCount > originalCount * 2)
      warnings.push('目标结构书签数量显著增加 (>100%)')
    return { isValid: risks.length === 0, warnings, risks }
  }
}

export const smartBookmarkManager = new SmartBookmarkManager()
