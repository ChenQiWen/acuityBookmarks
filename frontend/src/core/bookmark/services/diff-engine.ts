/**
 * 智能书签差异引擎（核心单一来源）
 *
 * 职责：
 * - 负责原始树与目标树的差异计算，输出标准化操作序列
 * - 内含删除/新增/更新/移动/重排等规则与策略评估
 * - 对外暴露 computeDiff 作为主入口，其他方法保持私有
 * - 尽量保持与运行环境无关，仅依赖轻量日志模块
 */
import type { ILogger } from '@/core/common/logger'
import { noopLogger } from '@/core/common/logger'
import type { BookmarkNode } from '@/types'

export const OperationType = {
  CREATE: 'create' as const,
  DELETE: 'delete' as const,
  UPDATE: 'update' as const,
  MOVE: 'move' as const,
  REORDER: 'reorder' as const
} as const

export type OperationType = (typeof OperationType)[keyof typeof OperationType]

export interface BookmarkOperation {
  id: string
  type: OperationType
  priority: number
  nodeId?: string
  target?: {
    id?: string
    title?: string
    url?: string
    parentId?: string
    index?: number
    children?: BookmarkNode[]
  }
  dependencies?: string[]
  estimatedCost: number
}

export interface DiffResult {
  operations: BookmarkOperation[]
  stats: {
    totalOperations: number
    estimatedTime: number
    apiCalls: number
    complexity: 'low' | 'medium' | 'high' | 'extreme'
  }
  strategy: {
    type: 'incremental' | 'batch' | 'rebuild'
    reason: string
    recommendations: string[]
  }
}

export class SmartBookmarkDiffEngine {
  private operationCounter = 0
  private logger: ILogger

  /**
   * 构造函数
   *
   * @param logger - Logger 实例，默认使用 noopLogger
   */
  constructor(logger?: ILogger) {
    this.logger = logger || noopLogger
  }

  async computeDiff(
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[]
  ): Promise<DiffResult> {
    const startTime = performance.now()
    this.logger.info('SmartDiff', '🧠 开始智能差异分析...')

    const originalMap = this.buildNodeMap(originalTree)
    const targetMap = this.buildNodeMap(targetTree)

    const operations = await this.performTreeDiff(
      originalMap,
      targetMap,
      originalTree,
      targetTree
    )
    const optimizedOperations = this.optimizeOperations(operations)
    const strategy = this.determineStrategy(optimizedOperations)
    const stats = this.calculateStats(optimizedOperations)

    const duration = performance.now() - startTime
    this.logger.info(
      'SmartDiff',
      `🧠 差异分析完成，耗时: ${duration.toFixed(2)}ms`
    )
    this.logger.info(
      'SmartDiff',
      `📊 发现 ${operations.length} 个操作，优化后 ${optimizedOperations.length} 个`
    )

    return { operations: optimizedOperations, stats, strategy }
  }

  private async performTreeDiff(
    originalMap: Map<string, BookmarkNode>,
    targetMap: Map<string, BookmarkNode>,
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[]
  ): Promise<BookmarkOperation[]> {
    const operations: BookmarkOperation[] = []

    operations.push(...this.findDeleteOperations(originalMap, targetMap))
    operations.push(...this.findCreateOperations(originalMap, targetMap))
    operations.push(...this.findUpdateOperations(originalMap, targetMap))
    operations.push(
      ...(await this.findMoveOperations(originalTree, targetTree))
    )

    return operations
  }

  private findDeleteOperations(
    originalMap: Map<string, BookmarkNode>,
    targetMap: Map<string, BookmarkNode>
  ): BookmarkOperation[] {
    const operations: BookmarkOperation[] = []
    originalMap.forEach((node, id) => {
      if (!targetMap.has(id)) {
        operations.push({
          id: `delete_${this.operationCounter++}`,
          type: OperationType.DELETE,
          priority: 100,
          nodeId: id,
          target: { id },
          estimatedCost: node.children ? 50 : 10
        })
      }
    })
    return operations
  }

  private findCreateOperations(
    originalMap: Map<string, BookmarkNode>,
    targetMap: Map<string, BookmarkNode>
  ): BookmarkOperation[] {
    const operations: BookmarkOperation[] = []
    targetMap.forEach((node, id) => {
      if (!originalMap.has(id)) {
        operations.push({
          id: `create_${this.operationCounter++}`,
          type: OperationType.CREATE,
          priority: 10,
          target: {
            title: node.title,
            url: node.url,
            parentId: node.parentId,
            index: node.index
          },
          estimatedCost: 15
        })
      }
    })
    return operations
  }

  private findUpdateOperations(
    originalMap: Map<string, BookmarkNode>,
    targetMap: Map<string, BookmarkNode>
  ): BookmarkOperation[] {
    const operations: BookmarkOperation[] = []
    targetMap.forEach((targetNode, id) => {
      const originalNode = originalMap.get(id)
      if (originalNode) {
        if (originalNode.title !== targetNode.title) {
          operations.push({
            id: `update_title_${this.operationCounter++}`,
            type: OperationType.UPDATE,
            priority: 20,
            nodeId: id,
            target: { id, title: targetNode.title },
            estimatedCost: 8
          })
        }
        if (originalNode.url !== targetNode.url && targetNode.url) {
          operations.push({
            id: `update_url_${this.operationCounter++}`,
            type: OperationType.UPDATE,
            priority: 25,
            nodeId: id,
            target: { id, url: targetNode.url },
            estimatedCost: 8
          })
        }
      }
    })
    return operations
  }

  private async findMoveOperations(
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[]
  ): Promise<BookmarkOperation[]> {
    const operations: BookmarkOperation[] = []
    const originalParentMap = this.buildParentChildMap(originalTree)
    const targetParentMap = this.buildParentChildMap(targetTree)
    await this.analyzeFolderReordering(
      'root',
      originalParentMap,
      targetParentMap,
      operations
    )
    return operations
  }

  private async analyzeFolderReordering(
    parentId: string,
    originalParentMap: Map<string, BookmarkNode[]>,
    targetParentMap: Map<string, BookmarkNode[]>,
    operations: BookmarkOperation[]
  ): Promise<void> {
    const originalChildren = originalParentMap.get(parentId) || []
    const targetChildren = targetParentMap.get(parentId) || []
    if (originalChildren.length === 0 && targetChildren.length === 0) return

    const moveSequence = this.calculateOptimalMoveSequence(
      originalChildren,
      targetChildren
    )
    if (moveSequence.length > 0) {
      if (moveSequence.length > 3) {
        operations.push({
          id: `reorder_${parentId}_${this.operationCounter++}`,
          type: OperationType.REORDER,
          priority: 50,
          target: { parentId, children: targetChildren },
          estimatedCost: moveSequence.length * 5
        })
      } else {
        moveSequence.forEach(move => {
          operations.push({
            id: `move_${move.nodeId}_${this.operationCounter++}`,
            type: OperationType.MOVE,
            priority: 40,
            nodeId: move.nodeId,
            target: { id: move.nodeId, parentId, index: move.toIndex },
            estimatedCost: 12
          })
        })
      }
    }

    const allFolders = new Set(
      [...originalChildren, ...targetChildren]
        .filter(n => n.children)
        .map(n => n.id!)
    )
    for (const folderId of allFolders) {
      await this.analyzeFolderReordering(
        folderId,
        originalParentMap,
        targetParentMap,
        operations
      )
    }
  }

  private calculateOptimalMoveSequence(
    original: BookmarkNode[],
    target: BookmarkNode[]
  ): Array<{ nodeId: string; fromIndex: number; toIndex: number }> {
    const moves: Array<{ nodeId: string; fromIndex: number; toIndex: number }> =
      []
    for (let targetIndex = 0; targetIndex < target.length; targetIndex++) {
      const targetNode = target[targetIndex]
      const originalIndex = original.findIndex(n => n.id === targetNode.id)
      if (originalIndex !== -1 && originalIndex !== targetIndex) {
        moves.push({
          nodeId: targetNode.id!,
          fromIndex: originalIndex,
          toIndex: targetIndex
        })
      }
    }
    return moves
  }

  private optimizeOperations(
    operations: BookmarkOperation[]
  ): BookmarkOperation[] {
    const sortedOps = operations.sort((a, b) => a.priority - b.priority)
    const optimized = this.mergeOperations(sortedOps)
    this.analyzeDependencies(optimized)
    return optimized
  }

  private mergeOperations(
    operations: BookmarkOperation[]
  ): BookmarkOperation[] {
    return operations
  }

  private analyzeDependencies(operations: BookmarkOperation[]): void {
    operations.forEach(op => {
      if (op.type === OperationType.MOVE && op.target?.parentId) {
        const parentCreateOp = operations.find(
          other =>
            other.type === OperationType.CREATE &&
            other.target?.id === op.target?.parentId
        )
        if (parentCreateOp) {
          op.dependencies = op.dependencies || []
          op.dependencies.push(parentCreateOp.id)
        }
      }
    })
  }

  private determineStrategy(
    operations: BookmarkOperation[]
  ): DiffResult['strategy'] {
    const totalOps = operations.length
    const complexity = this.calculateComplexity(operations)
    if (totalOps < 10 && complexity !== 'extreme') {
      return {
        type: 'incremental',
        reason: '变更较少，适合增量更新',
        recommendations: ['使用单个Chrome API调用', '实时反馈用户进度']
      }
    } else if (totalOps < 100 && complexity !== 'extreme') {
      return {
        type: 'batch',
        reason: '中等规模变更，适合批量处理',
        recommendations: [
          '使用批量API调用',
          '分批执行避免阻塞',
          '显示详细进度条'
        ]
      }
    } else {
      return {
        type: 'rebuild',
        reason: '大规模变更，建议重建书签树',
        recommendations: ['先备份原有书签', '清空后重新构建', '提供回滚机制']
      }
    }
  }

  private calculateStats(operations: BookmarkOperation[]): DiffResult['stats'] {
    const totalTime = operations.reduce((sum, op) => sum + op.estimatedCost, 0)
    const apiCalls =
      operations.filter(op => op.type !== OperationType.REORDER).length +
      operations.filter(op => op.type === OperationType.REORDER).length * 3
    return {
      totalOperations: operations.length,
      estimatedTime: totalTime,
      apiCalls,
      complexity: this.calculateComplexity(operations)
    }
  }

  private calculateComplexity(
    operations: BookmarkOperation[]
  ): 'low' | 'medium' | 'high' | 'extreme' {
    const totalCost = operations.reduce((sum, op) => sum + op.estimatedCost, 0)
    if (totalCost < 100) return 'low'
    if (totalCost < 500) return 'medium'
    if (totalCost < 2000) return 'high'
    return 'extreme'
  }

  private buildNodeMap(tree: BookmarkNode[]): Map<string, BookmarkNode> {
    const map = new Map<string, BookmarkNode>()
    const traverse = (nodes: BookmarkNode[]) => {
      nodes.forEach(node => {
        if (node.id) map.set(node.id, node)
        if (node.children) traverse(node.children)
      })
    }
    traverse(tree)
    return map
  }

  private buildParentChildMap(
    tree: BookmarkNode[]
  ): Map<string, BookmarkNode[]> {
    const map = new Map<string, BookmarkNode[]>()
    const traverse = (nodes: BookmarkNode[], parentId = 'root') => {
      map.set(parentId, nodes)
      nodes.forEach(node => {
        if (node.children && node.id) traverse(node.children, node.id)
      })
    }
    traverse(tree)
    return map
  }
}

export const smartBookmarkDiffEngine = new SmartBookmarkDiffEngine()

// 为兼容旧引用保留类型别名
export type DiffBookmarkNode = BookmarkNode
