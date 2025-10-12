import type { Result } from '@/core/common/result'
import { ok as Ok, err as Err } from '@/core/common/result'
import {
  smartBookmarkDiffEngine,
  type DiffResult
} from '@/core/bookmark/services/diff-engine'
import {
  SmartBookmarkExecutor,
  type ExecutionResult
} from '@/core/bookmark/services/executor'
import type { ChromeBookmarkTreeNode, BookmarkNode } from '@/types'
import type { PlanAndExecuteOptions } from '@/types/application/bookmark'

// 使用 core 层的实际类型，而不是 types 中的声明
type CoreDiffResult = DiffResult
type CoreExecutionResult = ExecutionResult

class BookmarkChangeAppService {
  async planChanges(
    original: ChromeBookmarkTreeNode[],
    target: ChromeBookmarkTreeNode[]
  ): Promise<Result<CoreDiffResult>> {
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
    diffResult: CoreDiffResult,
    options: PlanAndExecuteOptions = {}
  ): Promise<Result<CoreExecutionResult>> {
    try {
      const executor = options.executor ?? new SmartBookmarkExecutor()
      const res = await executor.executeDiff(diffResult, options.onProgress)
      return Ok(res as CoreExecutionResult)
    } catch (e: unknown) {
      return Err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async planAndExecute(
    original: ChromeBookmarkTreeNode[],
    target: ChromeBookmarkTreeNode[],
    options: PlanAndExecuteOptions = {}
  ): Promise<Result<{ diff: CoreDiffResult; execution: CoreExecutionResult }>> {
    const plan = await this.planChanges(original, target)
    if (!plan.ok) return Err(plan.error)
    const exec = await this.executePlan(plan.value, options)
    if (!exec.ok) return Err(exec.error)
    return Ok({ diff: plan.value, execution: exec.value })
  }
}

export const bookmarkChangeAppService = new BookmarkChangeAppService()
