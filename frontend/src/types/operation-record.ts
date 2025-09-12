/**
 * 操作记录系统 - 类型定义
 * 为确认对话框和撤销功能提供数据结构基础
 */

import type { BookmarkNode } from './index'

/**
 * 操作类型枚举
 */
export const OperationType = {
  CREATE: 'CREATE',           // 创建书签/文件夹
  DELETE: 'DELETE',           // 删除书签/文件夹  
  UPDATE: 'UPDATE',           // 更新书签/文件夹信息
  MOVE: 'MOVE',               // 移动书签/文件夹位置
  BATCH: 'BATCH',             // 批量操作
  AI_REGENERATE: 'AI_REGENERATE' // AI重新生成整个结构
} as const

export type OperationType = typeof OperationType[keyof typeof OperationType]

/**
 * 节点类型
 */
export const NodeType = {
  BOOKMARK: 'BOOKMARK',       // 书签
  FOLDER: 'FOLDER'            // 文件夹
} as const

export type NodeType = typeof NodeType[keyof typeof NodeType]

/**
 * 操作来源
 */
export const OperationSource = {
  MANUAL: 'MANUAL',           // 手动操作
  AI: 'AI',                   // AI生成
  IMPORT: 'IMPORT',           // 导入
  SYSTEM: 'SYSTEM'            // 系统操作
} as const

export type OperationSource = typeof OperationSource[keyof typeof OperationSource]

/**
 * 基础操作记录接口
 */
export interface BaseOperationRecord {
  id: string                   // 操作唯一ID
  type: OperationType          // 操作类型
  source: OperationSource      // 操作来源
  timestamp: number            // 操作时间戳
  description: string          // 操作描述
  nodeType: NodeType           // 节点类型
  nodeId: string               // 目标节点ID
  
  // 撤销相关 (预留)
  reversible: boolean          // 是否可撤销
  undoOperation?: BaseOperationRecord // 撤销操作记录
}

/**
 * 创建操作记录
 */
export interface CreateOperationRecord extends BaseOperationRecord {
  type: 'CREATE'
  data: {
    node: BookmarkNode         // 新创建的节点
    parentId: string           // 父节点ID
    index: number              // 插入位置
  }
}

/**
 * 删除操作记录
 */
export interface DeleteOperationRecord extends BaseOperationRecord {
  type: 'DELETE'
  data: {
    node: BookmarkNode         // 被删除的节点
    parentId: string           // 原父节点ID
    index: number              // 原位置
    childrenCount?: number     // 如果是文件夹，包含的子项数量
  }
}

/**
 * 更新操作记录
 */
export interface UpdateOperationRecord extends BaseOperationRecord {
  type: 'UPDATE'
  data: {
    nodeId: string
    changes: {
      field: 'title' | 'url' | 'dateAdded' | 'dateModified'
      oldValue: any
      newValue: any
    }[]
  }
}

/**
 * 移动操作记录
 */
export interface MoveOperationRecord extends BaseOperationRecord {
  type: 'MOVE'
  data: {
    nodeId: string
    from: {
      parentId: string
      index: number
    }
    to: {
      parentId: string
      index: number
    }
  }
}

/**
 * 批量操作记录
 */
export interface BatchOperationRecord extends BaseOperationRecord {
  type: 'BATCH'
  data: {
    operations: OperationRecord[] // 包含的子操作
    summary: string               // 批量操作摘要
  }
}

/**
 * AI重新生成操作记录
 */
export interface AIRegenerateOperationRecord extends BaseOperationRecord {
  type: 'AI_REGENERATE'
  data: {
    oldTree: BookmarkNode[]       // 原始书签树
    newTree: BookmarkNode[]       // 新生成的书签树
    aiPrompt?: string             // AI提示词
    aiReason?: string             // AI重组理由
    statistics: {
      totalNodes: number          // 总节点数
      foldersCreated: number      // 创建的文件夹数
      bookmarksMoved: number      // 移动的书签数
      duplicatesRemoved: number   // 删除的重复项数
    }
  }
}

/**
 * 联合操作记录类型
 */
export type OperationRecord = 
  | CreateOperationRecord
  | DeleteOperationRecord  
  | UpdateOperationRecord
  | MoveOperationRecord
  | BatchOperationRecord
  | AIRegenerateOperationRecord

/**
 * 操作记录会话
 */
export interface OperationSession {
  id: string                    // 会话ID
  startTime: number             // 开始时间
  endTime?: number              // 结束时间
  source: OperationSource       // 操作来源
  operations: OperationRecord[] // 操作列表
  initialState: BookmarkNode[]  // 初始状态快照
  finalState?: BookmarkNode[]   // 最终状态快照
  
  // 统计信息
  statistics: {
    totalOperations: number
    operationsByType: Record<OperationType, number>
  }
}

/**
 * 差异分析结果
 */
export interface DiffResult {
  hasChanges: boolean           // 是否有变更
  operations: OperationRecord[] // 操作记录列表
  summary: {
    created: number             // 创建数量
    deleted: number             // 删除数量
    updated: number             // 更新数量
    moved: number               // 移动数量
  }
  affectedNodes: Set<string>    // 受影响的节点ID集合
}

/**
 * 撤销重做管理器接口 (预留)
 */
export interface UndoRedoManager {
  // 基础操作
  canUndo(): boolean
  canRedo(): boolean
  undo(): Promise<void>
  redo(): Promise<void>
  
  // 历史记录
  getHistory(): OperationRecord[]
  clearHistory(): void
  getHistorySize(): number
  
  // 批量操作
  beginBatch(): void
  endBatch(): void
  
  // 安全点
  createSavePoint(): string
  restoreToSavePoint(savePointId: string): Promise<void>
}

/**
 * 操作记录配置
 */
export interface OperationConfig {
  maxHistorySize: number        // 最大历史记录数
  enableAutoSavePoint: boolean  // 是否启用自动安全点
  batchThreshold: number        // 批量操作阈值
  compressionEnabled: boolean   // 是否启用压缩存储
}
