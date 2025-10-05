import { OperationType, type BookmarkOperation } from './diff-engine'
import { logger } from '@/utils/logger'

export interface ExecutorConfig {
  maxConcurrency: number
  batchSize: number
  retryAttempts: number
  enableProgressCallback: boolean
  timeoutMs: number
}

export interface ExecutionResult {
  success: boolean
  executedOperations: number
  failedOperations: number
  totalTime: number
  errors: Array<{ operation: BookmarkOperation; error: string }>
  performance: {
    apiCallsActual: number
    timePerOperation: number
    effectiveSpeedup: number
  }
}

export type ProgressCallback = (progress: {
  completed: number
  total: number
  failed: number
  currentOperation: string
  estimatedTimeRemaining: number
}) => void

export class SmartBookmarkExecutor {
  private config: ExecutorConfig = {
    maxConcurrency: 3,
    batchSize: 10,
    retryAttempts: 2,
    enableProgressCallback: true,
    timeoutMs: 30000
  }

  constructor(config?: Partial<ExecutorConfig>) {
    if (config) this.config = { ...this.config, ...config }
  }

  async executeDiff(diffResult: any, progressCallback?: ProgressCallback): Promise<ExecutionResult> {
    const startTime = performance.now()
    logger.info('SmartBookmarkExecutor', '🚀 开始执行书签变更', {
      totalOperations: diffResult.operations.length,
      strategy: diffResult.strategy.type,
      estimatedTime: diffResult.stats.estimatedTime
    })

    const result: ExecutionResult = {
      success: false,
      executedOperations: 0,
      failedOperations: 0,
      totalTime: 0,
      errors: [],
      performance: { apiCallsActual: 0, timePerOperation: 0, effectiveSpeedup: 1 }
    }

    try {
      switch (diffResult.strategy.type) {
        case 'incremental':
          await this.executeIncremental(diffResult.operations, progressCallback, result)
          break
        case 'batch':
          await this.executeBatch(diffResult.operations, progressCallback, result)
          break
        case 'rebuild':
          await this.executeRebuild(diffResult.operations, progressCallback, result)
          break
      }
      result.success = result.failedOperations === 0
      result.totalTime = performance.now() - startTime
      result.performance.timePerOperation = result.executedOperations > 0 ? (result.totalTime / result.executedOperations) : 0
      const originalEstimatedTime = this.calculateOriginalTime(diffResult.operations)
      result.performance.effectiveSpeedup = originalEstimatedTime / Math.max(1, result.totalTime)
      logger.info('SmartBookmarkExecutor', '✅ 执行完成', {
        success: result.success,
        executedOperations: result.executedOperations,
        failedOperations: result.failedOperations,
        totalTime: result.totalTime,
        speedup: `${result.performance.effectiveSpeedup.toFixed(1)}x`
      })
    } catch (error) {
      logger.error('SmartBookmarkExecutor', '❌ 执行失败', error)
      result.success = false
    }

    return result
  }

  private async executeIncremental(operations: BookmarkOperation[], progressCallback?: ProgressCallback, result?: ExecutionResult): Promise<void> {
    logger.info('SmartBookmarkExecutor', '📋 使用增量执行模式')
    const sortedOps = this.resolveDependencies(operations)
    for (let i = 0; i < sortedOps.length; i++) {
      const operation = sortedOps[i]
      try {
        await this.executeOperation(operation)
        result!.executedOperations++
        result!.performance.apiCallsActual++
        if (progressCallback) {
          progressCallback({
            completed: i + 1,
            total: sortedOps.length,
            failed: result!.failedOperations,
            currentOperation: this.getOperationDescription(operation),
            estimatedTimeRemaining: this.estimateRemainingTime(i, sortedOps.length, performance.now())
          })
        }
      } catch (error) {
        result!.failedOperations++
        result!.errors.push({ operation, error: error instanceof Error ? error.message : String(error) })
        logger.warn('SmartBookmarkExecutor', '操作失败，继续执行下一个', { operation: operation.id, error })
        if (progressCallback) {
          progressCallback({
            completed: i + 1,
            total: sortedOps.length,
            failed: result!.failedOperations,
            currentOperation: this.getOperationDescription(operation),
            estimatedTimeRemaining: this.estimateRemainingTime(i, sortedOps.length, performance.now())
          })
        }
      }
    }
  }

  private async executeBatch(operations: BookmarkOperation[], progressCallback?: ProgressCallback, result?: ExecutionResult): Promise<void> {
    logger.info('SmartBookmarkExecutor', '🔄 使用批量执行模式')
    const batches = this.groupOperationsIntoBatches(operations)
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const batchPromises = batch.map(async (operation) => {
        try {
          await this.executeOperation(operation)
          return { success: true, operation }
        } catch (error) {
          return { success: false, operation, error: error instanceof Error ? error.message : String(error) }
        }
      })
      const batchResults = await Promise.allSettled(batchPromises)
      batchResults.forEach(promiseResult => {
        if (promiseResult.status === 'fulfilled') {
          const operationResult = promiseResult.value
          if (operationResult.success) {
            result!.executedOperations++
          } else {
            result!.failedOperations++
            result!.errors.push({ operation: operationResult.operation, error: operationResult.error! })
          }
        }
        result!.performance.apiCallsActual++
      })
      if (progressCallback) {
        const processed = Math.min((batchIndex + 1) * this.config.batchSize, operations.length)
        progressCallback({
          completed: processed,
          total: operations.length,
          failed: result!.failedOperations,
          currentOperation: `批量处理第 ${batchIndex + 1} 批`,
          estimatedTimeRemaining: this.estimateRemainingTime(batchIndex, batches.length, performance.now())
        })
      }
    }
  }

  private async executeRebuild(_operations: BookmarkOperation[], _progressCallback?: ProgressCallback, _result?: ExecutionResult): Promise<void> {
    logger.info('SmartBookmarkExecutor', '🏗️  使用重建执行模式')
    throw new Error('重建模式尚未实现')
  }

  private async executeOperation(operation: BookmarkOperation): Promise<void> {
    switch (operation.type) {
      case OperationType.CREATE:
        await this.executeCreateOperation(operation)
        break
      case OperationType.DELETE:
        await this.executeDeleteOperation(operation)
        break
      case OperationType.UPDATE:
        await this.executeUpdateOperation(operation)
        break
      case OperationType.MOVE:
        await this.executeMoveOperation(operation)
        break
      case OperationType.REORDER:
        await this.executeReorderOperation(operation)
        break
    }
  }

  private async executeCreateOperation(operation: BookmarkOperation): Promise<void> {
    const target = operation.target!
    return new Promise((resolve, reject) => {
      const createParams: any = { parentId: target.parentId, title: target.title, index: target.index }
      if (target.url) createParams.url = target.url
      chrome.bookmarks.create(createParams, (_result) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else { logger.debug('SmartBookmarkExecutor', `✅ 创建成功: ${target.title}`); resolve() }
      })
    })
  }

  private async executeDeleteOperation(operation: BookmarkOperation): Promise<void> {
    const nodeId = operation.target!.id!
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get([nodeId], (results) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
        const node = results[0]
        if (!node.url) {
          chrome.bookmarks.removeTree(nodeId, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
            else { logger.debug('SmartBookmarkExecutor', `🗑️  删除文件夹: ${node.title}`); resolve() }
          })
        } else {
          chrome.bookmarks.remove(nodeId, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
            else { logger.debug('SmartBookmarkExecutor', `🗑️  删除书签: ${node.title}`); resolve() }
          })
        }
      })
    })
  }

  private async executeUpdateOperation(operation: BookmarkOperation): Promise<void> {
    const target = operation.target!
    return new Promise((resolve, reject) => {
      const updateParams: any = {}
      if (target.title) updateParams.title = target.title
      if (target.url) updateParams.url = target.url
      chrome.bookmarks.update(target.id!, updateParams, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else { logger.debug('SmartBookmarkExecutor', `📝 更新成功: ${target.title}`); resolve() }
      })
    })
  }

  private async executeMoveOperation(operation: BookmarkOperation): Promise<void> {
    const target = operation.target!
    return new Promise((resolve, reject) => {
      const moveParams: any = {}
      if (target.parentId) moveParams.parentId = target.parentId
      if (target.index !== undefined) moveParams.index = target.index
      chrome.bookmarks.move(target.id!, moveParams, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else { logger.debug('SmartBookmarkExecutor', `📦 移动成功: ${target.id}`); resolve() }
      })
    })
  }

  private async executeReorderOperation(operation: BookmarkOperation): Promise<void> {
    const target = operation.target!
    const children = target.children!
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.id) {
        await new Promise<void>((resolve, reject) => {
          chrome.bookmarks.move(child.id!, { parentId: target.parentId, index: i }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
            else resolve()
          })
        })
      }
    }
    logger.debug('SmartBookmarkExecutor', `🔄 重排序完成: ${target.parentId}`)
  }

  private resolveDependencies(operations: BookmarkOperation[]): BookmarkOperation[] {
    const result: BookmarkOperation[] = []
    const visited = new Set<string>()
    const visit = (operation: BookmarkOperation) => {
      if (visited.has(operation.id)) return
      if (operation.dependencies) {
        operation.dependencies.forEach(depId => {
          const dep = operations.find(op => op.id === depId)
          if (dep) visit(dep)
        })
      }
      visited.add(operation.id)
      result.push(operation)
    }
    operations.forEach(visit)
    return result
  }

  private groupOperationsIntoBatches(operations: BookmarkOperation[]): BookmarkOperation[][] {
    const batches: BookmarkOperation[][] = []
    const groups = new Map<string, BookmarkOperation[]>()
    operations.forEach(op => {
      const key = `${op.type}_${op.priority}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(op)
    })
    groups.forEach(group => {
      for (let i = 0; i < group.length; i += this.config.batchSize) {
        batches.push(group.slice(i, i + this.config.batchSize))
      }
    })
    return batches
  }

  private calculateOriginalTime(operations: BookmarkOperation[]): number {
    return operations.length * 20
  }

  private getOperationDescription(operation: BookmarkOperation): string {
    switch (operation.type) {
      case OperationType.CREATE: return `创建 ${operation.target?.title}`
      case OperationType.DELETE: return `删除 ${operation.nodeId}`
      case OperationType.UPDATE: return `更新 ${operation.target?.title}`
      case OperationType.MOVE: return `移动 ${operation.nodeId}`
      case OperationType.REORDER: return `重排序 ${operation.target?.parentId}`
      default: return '未知操作'
    }
  }

  private estimateRemainingTime(currentIndex: number, total: number, startTime: number): number {
    if (currentIndex === 0) return 0
    const elapsed = performance.now() - startTime
    const avgTimePerItem = elapsed / currentIndex
    const remaining = total - currentIndex
    return remaining * avgTimePerItem
  }
}

export const smartBookmarkExecutor = new SmartBookmarkExecutor()
