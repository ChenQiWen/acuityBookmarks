/**
 * 书签差异计算服务
 * 负责对比原始树和提案树，生成操作列表
 */

import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签操作类型
 */
export type BookmarkOperationType = 'create' | 'move' | 'edit' | 'delete'

/**
 * 基础操作接口
 */
interface BaseOperation {
  type: BookmarkOperationType
  nodeId: string
  title: string
  isFolder: boolean
}

/**
 * 创建操作
 */
export interface CreateOperation extends BaseOperation {
  type: 'create'
  url?: string
  parentId: string
  index: number
}

/**
 * 移动操作
 */
export interface MoveOperation extends BaseOperation {
  type: 'move'
  fromParentId: string
  toParentId: string
  fromIndex: number
  toIndex: number
  isSameParent: boolean // 是否在同一文件夹内调整顺序
}

/**
 * 编辑操作
 */
export interface EditOperation extends BaseOperation {
  type: 'edit'
  oldTitle: string
  newTitle: string
  oldUrl?: string
  newUrl?: string
}

/**
 * 删除操作
 */
export interface DeleteOperation extends BaseOperation {
  type: 'delete'
  parentId: string
}

/**
 * 联合类型
 */
export type BookmarkOperation =
  | CreateOperation
  | MoveOperation
  | EditOperation
  | DeleteOperation

/**
 * Diff 结果统计
 */
export interface DiffStatistics {
  total: number
  create: number
  move: number
  edit: number
  delete: number
  newFolders: number
  newBookmarks: number
}

/**
 * Diff 结果
 */
export interface DiffResult {
  operations: BookmarkOperation[]
  statistics: DiffStatistics
}

/**
 * 书签差异计算服务
 */
class BookmarkDiffService {
  /**
   * 计算两棵树的差异
   * @param original 原始树（来自 IndexedDB）
   * @param proposal 提案树（用户编辑后或 LLM 生成）
   */
  calculateDiff(original: BookmarkNode, proposal: BookmarkNode): DiffResult {
    logger.info('BookmarkDiffService', '🔍 开始计算差异')

    // 1️⃣ 构建 ID -> Node 映射
    const originalMap = new Map<string, BookmarkNode>()
    const proposalMap = new Map<string, BookmarkNode>()

    this.buildNodeMap(original, originalMap)
    this.buildNodeMap(proposal, proposalMap)

    logger.debug('BookmarkDiffService', '✅ 映射表构建完成', {
      originalCount: originalMap.size,
      proposalCount: proposalMap.size
    })

    const operations: BookmarkOperation[] = []

    // 2️⃣ 检测删除（original 有但 proposal 没有）
    for (const [id, node] of originalMap) {
      if (!proposalMap.has(id)) {
        operations.push({
          type: 'delete',
          nodeId: id,
          title: node.title,
          isFolder: !node.url,
          parentId: node.parentId || 'root'
        })
      }
    }

    // 3️⃣ 检测新增、编辑、移动
    for (const [id, proposalNode] of proposalMap) {
      const originalNode = originalMap.get(id)

      if (!originalNode) {
        // 新增节点
        operations.push({
          type: 'create',
          nodeId: id,
          title: proposalNode.title,
          isFolder: !proposalNode.url,
          url: proposalNode.url,
          parentId: proposalNode.parentId || 'root',
          index: proposalNode.index ?? 0
        })
      } else {
        // 检测编辑（标题或URL变化）
        const titleChanged = originalNode.title !== proposalNode.title
        const urlChanged = originalNode.url !== proposalNode.url

        if (titleChanged || urlChanged) {
          operations.push({
            type: 'edit',
            nodeId: id,
            title: proposalNode.title,
            isFolder: !proposalNode.url,
            oldTitle: originalNode.title,
            newTitle: proposalNode.title,
            oldUrl: originalNode.url,
            newUrl: proposalNode.url
          })
        }

        // ✅ 检测移动（只有真正需要调用 Chrome API move 的情况）
        const parentChanged = originalNode.parentId !== proposalNode.parentId
        const indexChanged = originalNode.index !== proposalNode.index

        // 🔑 关键优化：只有以下情况才算"真正的移动"
        // 1. parentId 变化（跨文件夹移动）
        // 2. 同一父节点内，且不是"整体偏移"（排除连锁反应）
        if (parentChanged) {
          // 跨文件夹移动，必须记录
          logger.debug('BookmarkDiffService', '📦 检测到跨文件夹移动', {
            title: proposalNode.title,
            from: originalNode.parentId || 'root',
            to: proposalNode.parentId || 'root'
          })
          operations.push({
            type: 'move',
            nodeId: id,
            title: proposalNode.title,
            isFolder: !proposalNode.url,
            fromParentId: originalNode.parentId || 'root',
            toParentId: proposalNode.parentId || 'root',
            fromIndex: originalNode.index ?? 0,
            toIndex: proposalNode.index ?? 0,
            isSameParent: false
          })
        } else if (indexChanged) {
          // 同一父节点内 index 变化
          // 暂时记录，后面会过滤掉"整体偏移"造成的假移动
          logger.debug('BookmarkDiffService', '🔄 检测到同级 index 变化', {
            title: proposalNode.title,
            parentId: originalNode.parentId || 'root',
            fromIndex: originalNode.index,
            toIndex: proposalNode.index,
            delta: (proposalNode.index ?? 0) - (originalNode.index ?? 0)
          })
          operations.push({
            type: 'move',
            nodeId: id,
            title: proposalNode.title,
            isFolder: !proposalNode.url,
            fromParentId: originalNode.parentId || 'root',
            toParentId: proposalNode.parentId || 'root',
            fromIndex: originalNode.index ?? 0,
            toIndex: proposalNode.index ?? 0,
            isSameParent: true
          })
        }
      }
    }

    // 4️⃣ 过滤掉"整体偏移"造成的假移动
    const filteredOperations = this.filterFalsePositiveMoves(operations)

    // 5️⃣ 按顺序排序：删除 → 移动 → 编辑 → 新增
    const sortedOperations = this.sortOperations(filteredOperations)

    // 6️⃣ 计算统计信息
    const statistics = this.calculateStatistics(sortedOperations)

    logger.info('BookmarkDiffService', '差异计算完成', statistics)

    return {
      operations: sortedOperations,
      statistics
    }
  }

  /**
   * 过滤掉"整体偏移"造成的假移动
   *
   * 场景：当一个节点插入到列表中间时，后面的节点 index 都会 +1
   * 但这些节点实际上没有"移动"，不需要调用 Chrome API
   */
  private filterFalsePositiveMoves(
    operations: BookmarkOperation[]
  ): BookmarkOperation[] {
    logger.info('BookmarkDiffService', '🧹 开始过滤整体偏移')

    // 按 parentId 分组同级移动操作
    const movesByParent = new Map<string, MoveOperation[]>()
    const otherOperations: BookmarkOperation[] = []

    for (const op of operations) {
      if (op.type === 'move' && op.isSameParent) {
        const parentId = op.fromParentId
        if (!movesByParent.has(parentId)) {
          movesByParent.set(parentId, [])
        }
        movesByParent.get(parentId)!.push(op as MoveOperation)
      } else {
        otherOperations.push(op)
      }
    }

    logger.debug('BookmarkDiffService', '📊 同级移动分组统计', {
      totalGroups: movesByParent.size,
      groups: Array.from(movesByParent.entries()).map(([parentId, moves]) => ({
        parentId,
        count: moves.length
      }))
    })

    // 检查每个父节点下的移动操作
    const genuineMoves: BookmarkOperation[] = []
    let filteredCount = 0

    for (const [parentId, moves] of movesByParent) {
      // 计算每个节点的 index 变化值
      const indexDeltas = moves.map(m => m.toIndex - m.fromIndex)

      // 检查是否所有变化值都相同（整体偏移）
      const allSame = indexDeltas.every(delta => delta === indexDeltas[0])

      if (allSame && indexDeltas.length > 1) {
        // 整体偏移：所有节点的 index 都增加/减少相同的值
        // 这是因为其他节点插入/删除造成的连锁反应，不算真正的移动
        logger.info(
          'BookmarkDiffService',
          `🚫 过滤整体偏移（parentId=${parentId}）`,
          {
            filteredCount: moves.length,
            delta: indexDeltas[0],
            affectedNodes: moves.map(m => m.title).slice(0, 5), // 只显示前5个
            more: moves.length > 5 ? `... 还有 ${moves.length - 5} 个` : ''
          }
        )
        filteredCount += moves.length
        // 不添加到 genuineMoves
      } else {
        // 非整体偏移：真正的位置调换
        logger.debug(
          'BookmarkDiffService',
          `✅ 保留真实移动（parentId=${parentId}）`,
          {
            count: moves.length,
            nodes: moves.map(m => ({
              title: m.title,
              from: m.fromIndex,
              to: m.toIndex,
              delta: m.toIndex - m.fromIndex
            }))
          }
        )
        genuineMoves.push(...moves)
      }
    }

    logger.info('BookmarkDiffService', '✅ 过滤完成', {
      originalMoveCount: Array.from(movesByParent.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      filteredCount,
      remainingMoveCount: genuineMoves.length,
      otherOperationsCount: otherOperations.length
    })

    return [...otherOperations, ...genuineMoves]
  }

  /**
   * 递归构建节点映射表
   */
  private buildNodeMap(
    node: BookmarkNode,
    map: Map<string, BookmarkNode>
  ): void {
    map.set(node.id, node)

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.buildNodeMap(child, map)
      }
    }
  }

  /**
   * 排序操作：删除 → 移动 → 编辑 → 新增
   */
  private sortOperations(operations: BookmarkOperation[]): BookmarkOperation[] {
    const order: Record<BookmarkOperationType, number> = {
      delete: 1,
      move: 2,
      edit: 3,
      create: 4
    }

    return operations.sort((a, b) => {
      const orderDiff = order[a.type] - order[b.type]
      if (orderDiff !== 0) return orderDiff

      // 同类型操作：文件夹优先于书签
      const aFolderWeight = a.isFolder ? 0 : 1
      const bFolderWeight = b.isFolder ? 0 : 1
      return aFolderWeight - bFolderWeight
    })
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(operations: BookmarkOperation[]): DiffStatistics {
    const stats: DiffStatistics = {
      total: operations.length,
      create: 0,
      move: 0,
      edit: 0,
      delete: 0,
      newFolders: 0,
      newBookmarks: 0
    }

    for (const op of operations) {
      stats[op.type]++

      if (op.type === 'create') {
        if (op.isFolder) {
          stats.newFolders++
        } else {
          stats.newBookmarks++
        }
      }
    }

    return stats
  }

  /**
   * 按操作类型分组
   */
  groupOperationsByType(
    operations: BookmarkOperation[]
  ): Record<BookmarkOperationType, BookmarkOperation[]> {
    return {
      create: operations.filter(op => op.type === 'create'),
      move: operations.filter(op => op.type === 'move'),
      edit: operations.filter(op => op.type === 'edit'),
      delete: operations.filter(op => op.type === 'delete')
    }
  }
}

/**
 * 导出单例
 */
export const bookmarkDiffService = new BookmarkDiffService()
