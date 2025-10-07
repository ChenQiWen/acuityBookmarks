import { Ok, Err, type Result } from '@/core/common/result'
import {
  smartBookmarkDiffEngine,
  type DiffResult
} from '@/core/bookmark/services/diff-engine'
import {
  SmartBookmarkExecutor,
  type ExecutionResult,
  type ProgressCallback
} from '@/core/bookmark/services/executor'
import type { ChromeBookmarkTreeNode, BookmarkNode } from '@/types'

export interface PlanAndExecuteOptions {
  executor?: SmartBookmarkExecutor
  onProgress?: ProgressCallback
}

class BookmarkChangeAppService {
  async planChanges(
    original: ChromeBookmarkTreeNode[],
    target: ChromeBookmarkTreeNode[]
  ): Promise<Result<DiffResult>> {
    try {
      const diff = await smartBookmarkDiffEngine.computeDiff(
        original as BookmarkNode[],
        target as BookmarkNode[]
      )
      return Ok(diff)
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async executePlan(
    diffResult: DiffResult,
    options: PlanAndExecuteOptions = {}
  ): Promise<Result<ExecutionResult>> {
    try {
      const executor = options.executor ?? new SmartBookmarkExecutor()
      const res = await executor.executeDiff(diffResult, options.onProgress)
      return Ok(res)
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async planAndExecute(
    original: ChromeBookmarkTreeNode[],
    target: ChromeBookmarkTreeNode[],
    options: PlanAndExecuteOptions = {}
  ): Promise<Result<{ diff: DiffResult; execution: ExecutionResult }>> {
    const plan = await this.planChanges(original, target)
    if (!plan.ok) return Err(plan.error)
    const exec = await this.executePlan(plan.value, options)
    if (!exec.ok) return Err(exec.error)
    return Ok({ diff: plan.value, execution: exec.value })
  }
}

export const bookmarkChangeAppService = new BookmarkChangeAppService()
