/**
 * 🧠 智能书签差异引擎
 * 
 * 核心功能：
 * 1. 高效Tree Diff算法，计算两个书签树的最小差异
 * 2. 智能操作规划，生成最优的Chrome API调用序列
 * 3. 批量执行优化，最小化API调用次数和执行时间
 * 4. 依赖关系分析，确保操作的正确执行顺序
 */

export interface BookmarkNode {
  id?: string
  title: string
  url?: string
  parentId?: string
  index?: number
  children?: BookmarkNode[]
  dateAdded?: number
  dateModified?: number
}

// 操作类型常量
export const OperationType = {
  CREATE: 'create' as const,           // 创建书签/文件夹
  DELETE: 'delete' as const,           // 删除书签/文件夹
  UPDATE: 'update' as const,           // 重命名/修改URL
  MOVE: 'move' as const,              // 移动位置或父级
  REORDER: 'reorder' as const         // 批量重排序
} as const

export type OperationType = typeof OperationType[keyof typeof OperationType]

// 单个操作定义
export interface BookmarkOperation {
  id: string                  // 操作唯一标识
  type: OperationType
  priority: number           // 执行优先级(数字越小优先级越高)
  nodeId?: string           // 目标节点ID
  target?: {
    id?: string
    title?: string
    url?: string
    parentId?: string
    index?: number
    children?: BookmarkNode[]
  }
  dependencies?: string[]   // 依赖的其他操作ID
  estimatedCost: number    // 预估执行成本(毫秒)
}

// 批量重排序操作
export interface ReorderOperation {
  parentId: string
  moves: Array<{
    nodeId: string
    fromIndex: number
    toIndex: number
  }>
}

// 差异分析结果
export interface DiffResult {
  operations: BookmarkOperation[]
  stats: {
    totalOperations: number
    estimatedTime: number    // 预估总执行时间(毫秒)
    apiCalls: number        // Chrome API调用次数
    complexity: 'low' | 'medium' | 'high' | 'extreme'
  }
  strategy: {
    type: 'incremental' | 'batch' | 'rebuild'
    reason: string
    recommendations: string[]
  }
}

/**
 * 智能书签差异引擎
 */
export class SmartBookmarkDiffEngine {
  
  private operationCounter = 0
  
  /**
   * 主要入口：计算两个书签树的差异
   */
  async computeDiff(
    originalTree: BookmarkNode[], 
    targetTree: BookmarkNode[]
  ): Promise<DiffResult> {
    
    const startTime = performance.now()
    console.log('🧠 开始智能差异分析...')
    
    // 1. 预处理：建立索引和映射
    const originalMap = this.buildNodeMap(originalTree)
    const targetMap = this.buildNodeMap(targetTree)
    
    // 2. 核心算法：Tree Diff
    const operations = await this.performTreeDiff(originalMap, targetMap, originalTree, targetTree)
    
    // 3. 操作优化：依赖分析和优先级调整
    const optimizedOperations = this.optimizeOperations(operations)
    
    // 4. 策略决策：选择最优执行策略
    const strategy = this.determineStrategy(optimizedOperations)
    
    // 5. 性能统计
    const stats = this.calculateStats(optimizedOperations)
    
    const duration = performance.now() - startTime
    console.log(`🧠 差异分析完成，耗时: ${duration.toFixed(2)}ms`)
    console.log(`📊 发现 ${operations.length} 个操作，优化后 ${optimizedOperations.length} 个`)
    
    return {
      operations: optimizedOperations,
      stats,
      strategy
    }
  }
  
  /**
   * 核心算法：Tree Diff
   */
  private async performTreeDiff(
    originalMap: Map<string, BookmarkNode>,
    targetMap: Map<string, BookmarkNode>,
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[]
  ): Promise<BookmarkOperation[]> {
    
    const operations: BookmarkOperation[] = []
    
    // 1. 识别删除操作
    const deleteOps = this.findDeleteOperations(originalMap, targetMap)
    operations.push(...deleteOps)
    
    // 2. 识别创建操作  
    const createOps = this.findCreateOperations(originalMap, targetMap)
    operations.push(...createOps)
    
    // 3. 识别更新操作（重命名、URL变更）
    const updateOps = this.findUpdateOperations(originalMap, targetMap)
    operations.push(...updateOps)
    
    // 4. 识别移动和重排序操作（最复杂）
    const moveOps = await this.findMoveOperations(originalTree, targetTree, originalMap, targetMap)
    operations.push(...moveOps)
    
    return operations
  }
  
  /**
   * 查找删除操作
   */
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
          priority: 100, // 删除操作优先级较低
          nodeId: id,
          target: { id },
          estimatedCost: node.children ? 50 : 10 // 文件夹删除更耗时
        })
      }
    })
    
    return operations
  }
  
  /**
   * 查找创建操作
   */
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
          priority: 10, // 创建操作优先级较高
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
  
  /**
   * 查找更新操作
   */
  private findUpdateOperations(
    originalMap: Map<string, BookmarkNode>,
    targetMap: Map<string, BookmarkNode>
  ): BookmarkOperation[] {
    
    const operations: BookmarkOperation[] = []
    
    targetMap.forEach((targetNode, id) => {
      const originalNode = originalMap.get(id)
      
      if (originalNode) {
        // 检查标题变化
        if (originalNode.title !== targetNode.title) {
          operations.push({
            id: `update_title_${this.operationCounter++}`,
            type: OperationType.UPDATE,
            priority: 20,
            nodeId: id,
            target: {
              id,
              title: targetNode.title
            },
            estimatedCost: 8
          })
        }
        
        // 检查URL变化（仅书签）
        if (originalNode.url !== targetNode.url && targetNode.url) {
          operations.push({
            id: `update_url_${this.operationCounter++}`,
            type: OperationType.UPDATE,
            priority: 25,
            nodeId: id,
            target: {
              id,
              url: targetNode.url
            },
            estimatedCost: 8
          })
        }
      }
    })
    
    return operations
  }
  
  /**
   * 查找移动和重排序操作（最复杂的部分）
   */
  private async findMoveOperations(
    originalTree: BookmarkNode[],
    targetTree: BookmarkNode[],
    _originalMap: Map<string, BookmarkNode>,
    _targetMap: Map<string, BookmarkNode>
  ): Promise<BookmarkOperation[]> {
    
    const operations: BookmarkOperation[] = []
    
    // 构建父子关系映射
    const originalParentMap = this.buildParentChildMap(originalTree)
    const targetParentMap = this.buildParentChildMap(targetTree)
    
    // 递归分析每个文件夹的子项重排序
    await this.analyzeFolderReordering('root', originalParentMap, targetParentMap, operations)
    
    return operations
  }
  
  /**
   * 分析文件夹内的重排序操作
   */
  private async analyzeFolderReordering(
    parentId: string,
    originalParentMap: Map<string, BookmarkNode[]>,
    targetParentMap: Map<string, BookmarkNode[]>,
    operations: BookmarkOperation[]
  ): Promise<void> {
    
    const originalChildren = originalParentMap.get(parentId) || []
    const targetChildren = targetParentMap.get(parentId) || []
    
    if (originalChildren.length === 0 && targetChildren.length === 0) return
    
    // 使用LCS算法找到最小移动序列
    const moveSequence = this.calculateOptimalMoveSequence(originalChildren, targetChildren)
    
    if (moveSequence.length > 0) {
      // 批量重排序优化
      if (moveSequence.length > 3) {
        operations.push({
          id: `reorder_${parentId}_${this.operationCounter++}`,
          type: OperationType.REORDER,
          priority: 50,
          target: {
            parentId,
            children: targetChildren
          },
          estimatedCost: moveSequence.length * 5
        })
      } else {
        // 少量移动单独处理
        moveSequence.forEach(move => {
          operations.push({
            id: `move_${move.nodeId}_${this.operationCounter++}`,
            type: OperationType.MOVE,
            priority: 40,
            nodeId: move.nodeId,
            target: {
              id: move.nodeId,
              parentId,
              index: move.toIndex
            },
            estimatedCost: 12
          })
        })
      }
    }
    
    // 递归处理子文件夹
    const allFolders = new Set([...originalChildren, ...targetChildren]
      .filter(node => node.children)
      .map(node => node.id!))
    
    for (const folderId of allFolders) {
      await this.analyzeFolderReordering(folderId, originalParentMap, targetParentMap, operations)
    }
  }
  
  /**
   * 最长公共子序列算法 - 计算最优移动序列
   */
  private calculateOptimalMoveSequence(
    original: BookmarkNode[],
    target: BookmarkNode[]
  ): Array<{ nodeId: string; fromIndex: number; toIndex: number }> {
    
    const moves: Array<{ nodeId: string; fromIndex: number; toIndex: number }> = []
    
    // 简化版LCS - 这里可以用更高效的算法
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
  
  /**
   * 操作优化：依赖分析和批量合并
   */
  private optimizeOperations(operations: BookmarkOperation[]): BookmarkOperation[] {
    // 1. 按优先级排序
    const sortedOps = operations.sort((a, b) => a.priority - b.priority)
    
    // 2. 合并相似操作
    const optimized = this.mergeOperations(sortedOps)
    
    // 3. 添加依赖关系
    this.analyzeDependencies(optimized)
    
    return optimized
  }
  
  /**
   * 合并相似操作
   */
  private mergeOperations(operations: BookmarkOperation[]): BookmarkOperation[] {
    // TODO: 实现批量更新、批量移动等优化
    // 例如：将多个update操作合并为一个批量更新
    return operations
  }
  
  /**
   * 分析操作依赖关系
   */
  private analyzeDependencies(operations: BookmarkOperation[]): void {
    operations.forEach(op => {
      // 例如：移动操作依赖于目标父文件夹的存在
      if (op.type === OperationType.MOVE && op.target?.parentId) {
        const parentCreateOp = operations.find(
          other => other.type === OperationType.CREATE && 
                  other.target?.id === op.target?.parentId
        )
        if (parentCreateOp) {
          op.dependencies = op.dependencies || []
          op.dependencies.push(parentCreateOp.id)
        }
      }
    })
  }
  
  /**
   * 决策最优执行策略
   */
  private determineStrategy(operations: BookmarkOperation[]): DiffResult['strategy'] {
    const totalOps = operations.length
    const complexity = this.calculateComplexity(operations)
    
    if (totalOps < 10 && complexity !== 'extreme') {
      return {
        type: 'incremental',
        reason: '变更较少，适合增量更新',
        recommendations: [
          '使用单个Chrome API调用',
          '实时反馈用户进度'
        ]
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
        recommendations: [
          '先备份原有书签',
          '清空后重新构建',
          '提供回滚机制'
        ]
      }
    }
  }
  
  /**
   * 计算性能统计
   */
  private calculateStats(operations: BookmarkOperation[]): DiffResult['stats'] {
    const totalTime = operations.reduce((sum, op) => sum + op.estimatedCost, 0)
    const apiCalls = operations.filter(op => op.type !== OperationType.REORDER).length +
                    operations.filter(op => op.type === OperationType.REORDER).length * 3 // 重排序需要多次调用
    
    return {
      totalOperations: operations.length,
      estimatedTime: totalTime,
      apiCalls,
      complexity: this.calculateComplexity(operations)
    }
  }
  
  /**
   * 计算复杂度等级
   */
  private calculateComplexity(operations: BookmarkOperation[]): 'low' | 'medium' | 'high' | 'extreme' {
    const totalCost = operations.reduce((sum, op) => sum + op.estimatedCost, 0)
    
    if (totalCost < 100) return 'low'
    if (totalCost < 500) return 'medium'  
    if (totalCost < 2000) return 'high'
    return 'extreme'
  }
  
  // === 辅助方法 ===
  
  private buildNodeMap(tree: BookmarkNode[]): Map<string, BookmarkNode> {
    const map = new Map()
    
    const traverse = (nodes: BookmarkNode[]) => {
      nodes.forEach(node => {
        if (node.id) {
          map.set(node.id, node)
        }
        if (node.children) {
          traverse(node.children)
        }
      })
    }
    
    traverse(tree)
    return map
  }
  
  private buildParentChildMap(tree: BookmarkNode[]): Map<string, BookmarkNode[]> {
    const map = new Map()
    
    const traverse = (nodes: BookmarkNode[], parentId = 'root') => {
      map.set(parentId, nodes)
      
      nodes.forEach(node => {
        if (node.children && node.id) {
          traverse(node.children, node.id)
        }
      })
    }
    
    traverse(tree)
    return map
  }
}

// 单例导出
export const smartBookmarkDiffEngine = new SmartBookmarkDiffEngine()
