/**
 * 操作记录跟踪系统
 * 负责记录、分析和管理书签操作历史
 */

import type { BookmarkNode } from '../types';
import {
  OperationType,
  OperationSource,
  NodeType,
  type OperationRecord,
  type OperationSession,
  type DiffResult,
  type OperationConfig,
  type UndoRedoManager,
  type CreateOperationRecord,
  type DeleteOperationRecord,
  type UpdateOperationRecord,
  type MoveOperationRecord,
  type AIRegenerateOperationRecord
} from '../types/operation-record';
import { logger } from './logger';

/**
 * 书签树差异计算引擎
 */
export class BookmarkDiffEngine {
  /**
   * 计算两个书签树之间的差异
   */
  static calculateDiff(
    oldTree: BookmarkNode[], 
    newTree: BookmarkNode[]
  ): DiffResult {
    const operations: OperationRecord[] = [];
    const affectedNodes = new Set<string>();
    
    // 创建节点映射表
    const oldNodeMap = this.createNodeMap(oldTree);
    const newNodeMap = this.createNodeMap(newTree);
    
    // 检测删除的节点
    for (const [nodeId, oldNode] of oldNodeMap) {
      if (!newNodeMap.has(nodeId)) {
        operations.push(this.createDeleteOperation(oldNode));
        affectedNodes.add(nodeId);
      }
    }
    
    // 检测新增和修改的节点
    for (const [nodeId, newNode] of newNodeMap) {
      const oldNode = oldNodeMap.get(nodeId);
      
      if (!oldNode) {
        // 新增节点
        operations.push(this.createCreateOperation(newNode));
        affectedNodes.add(nodeId);
      } else {
        // 检测修改
        const updateOp = this.detectNodeChanges(oldNode, newNode);
        if (updateOp) {
          operations.push(updateOp);
          affectedNodes.add(nodeId);
        }
        
        // 检测位置变化
        const moveOp = this.detectNodeMove(oldNode, newNode);
        if (moveOp) {
          operations.push(moveOp);
          affectedNodes.add(nodeId);
        }
      }
    }
    
    // 统计摘要
    const summary = {
      created: operations.filter(op => op.type === OperationType.CREATE).length,
      deleted: operations.filter(op => op.type === OperationType.DELETE).length,
      updated: operations.filter(op => op.type === OperationType.UPDATE).length,
      moved: operations.filter(op => op.type === OperationType.MOVE).length
    };
    
    return {
      hasChanges: operations.length > 0,
      operations,
      summary,
      affectedNodes
    };
  }
  
  /**
   * 创建节点映射表
   */
  private static createNodeMap(tree: BookmarkNode[]): Map<string, BookmarkNode> {
    const map = new Map<string, BookmarkNode>();
    
    const traverse = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (node.children) {
          traverse(node.children);
        }
      }
    };
    
    traverse(tree);
    return map;
  }
  
  /**
   * 创建删除操作记录
   */
  private static createDeleteOperation(
    node: BookmarkNode
  ): DeleteOperationRecord {
    return {
      id: this.generateOperationId(),
      type: OperationType.DELETE,
      source: OperationSource.MANUAL,
      timestamp: Date.now(),
      description: `删除${node.children ? '文件夹' : '书签'}: "${node.title}"`,
      nodeType: node.children ? NodeType.FOLDER : NodeType.BOOKMARK,
      nodeId: node.id,
      reversible: true,
      data: {
        node,
        parentId: node.parentId || '',
        index: node.index || 0,
        childrenCount: node.children?.length || 0
      }
    };
  }
  
  /**
   * 创建新增操作记录
   */
  private static createCreateOperation(
    node: BookmarkNode
  ): CreateOperationRecord {
    return {
      id: this.generateOperationId(),
      type: OperationType.CREATE,
      source: OperationSource.MANUAL,
      timestamp: Date.now(),
      description: `创建${node.children ? '文件夹' : '书签'}: "${node.title}"`,
      nodeType: node.children ? NodeType.FOLDER : NodeType.BOOKMARK,
      nodeId: node.id,
      reversible: true,
      data: {
        node,
        parentId: node.parentId || '',
        index: node.index || 0
      }
    };
  }
  
  /**
   * 检测节点内容变化
   */
  private static detectNodeChanges(
    oldNode: BookmarkNode, 
    newNode: BookmarkNode
  ): UpdateOperationRecord | null {
    const changes: any[] = [];
    
    if (oldNode.title !== newNode.title) {
      changes.push({
        field: 'title',
        oldValue: oldNode.title,
        newValue: newNode.title
      });
    }
    
    if (oldNode.url !== newNode.url) {
      changes.push({
        field: 'url',
        oldValue: oldNode.url,
        newValue: newNode.url
      });
    }
    
    if (changes.length === 0) return null;
    
    return {
      id: this.generateOperationId(),
      type: OperationType.UPDATE,
      source: OperationSource.MANUAL,
      timestamp: Date.now(),
      description: `修改${newNode.children ? '文件夹' : '书签'}: "${newNode.title}"`,
      nodeType: newNode.children ? NodeType.FOLDER : NodeType.BOOKMARK,
      nodeId: newNode.id,
      reversible: true,
      data: {
        nodeId: newNode.id,
        changes
      }
    };
  }
  
  /**
   * 检测节点位置变化
   */
  private static detectNodeMove(
    oldNode: BookmarkNode,
    newNode: BookmarkNode
  ): MoveOperationRecord | null {
    if (oldNode.parentId === newNode.parentId && oldNode.index === newNode.index) {
      return null;
    }
    
    return {
      id: this.generateOperationId(),
      type: OperationType.MOVE,
      source: OperationSource.MANUAL,
      timestamp: Date.now(),
      description: `移动${newNode.children ? '文件夹' : '书签'}: "${newNode.title}"`,
      nodeType: newNode.children ? NodeType.FOLDER : NodeType.BOOKMARK,
      nodeId: newNode.id,
      reversible: true,
      data: {
        nodeId: newNode.id,
        from: {
          parentId: oldNode.parentId || '',
          index: oldNode.index || 0
        },
        to: {
          parentId: newNode.parentId || '',
          index: newNode.index || 0
        }
      }
    };
  }
  
  /**
   * 生成操作ID
   */
  private static generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 操作记录跟踪器
 */
export class OperationTracker {
  private currentSession: OperationSession | null = null;
  private sessions: OperationSession[] = [];
  private config: OperationConfig;
  
  constructor(config?: Partial<OperationConfig>) {
    this.config = {
      maxHistorySize: 50,
      enableAutoSavePoint: true,
      batchThreshold: 5,
      compressionEnabled: false,
      ...config
    };
  }
  
  /**
   * 开始新的操作会话
   */
  startSession(source: OperationSource, initialState: BookmarkNode[]): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      source,
      operations: [],
      initialState: this.deepClone(initialState),
      statistics: {
        totalOperations: 0,
        operationsByType: {
          [OperationType.CREATE]: 0,
          [OperationType.DELETE]: 0,
          [OperationType.UPDATE]: 0,
          [OperationType.MOVE]: 0,
          [OperationType.BATCH]: 0,
          [OperationType.AI_REGENERATE]: 0
        }
      }
    };
    
    logger.info('OperationTracker', `开始操作会话: ${sessionId}`, { source });
    return sessionId;
  }
  
  /**
   * 结束当前操作会话
   */
  endSession(finalState: BookmarkNode[]): OperationSession | null {
    if (!this.currentSession) return null;
    
    this.currentSession.endTime = Date.now();
    this.currentSession.finalState = this.deepClone(finalState);
    
    // 保存会话
    this.sessions.push(this.currentSession);
    
    // 清理过期会话
    if (this.sessions.length > this.config.maxHistorySize) {
      this.sessions = this.sessions.slice(-this.config.maxHistorySize);
    }
    
    const session = this.currentSession;
    this.currentSession = null;
    
    logger.info('OperationTracker', `结束操作会话: ${session.id}`, {
      duration: (session.endTime! - session.startTime),
      operations: session.operations.length
    });
    
    return session;
  }
  
  /**
   * 记录操作
   */
  recordOperation(operation: OperationRecord): void {
    if (!this.currentSession) {
      logger.warn('OperationTracker', '无活动会话，跳过操作记录', operation);
      return;
    }
    
    this.currentSession.operations.push(operation);
    this.currentSession.statistics.totalOperations++;
    this.currentSession.statistics.operationsByType[operation.type as keyof typeof OperationType]++;
    
    logger.debug('OperationTracker', '记录操作', {
      sessionId: this.currentSession.id,
      operationType: operation.type,
      description: operation.description
    });
  }
  
  /**
   * 获取当前会话
   */
  getCurrentSession(): OperationSession | null {
    return this.currentSession;
  }
  
  /**
   * 获取会话历史
   */
  getSessionHistory(): OperationSession[] {
    return [...this.sessions];
  }
  
  /**
   * 分析两个状态之间的差异并记录操作
   */
  analyzeAndRecord(oldState: BookmarkNode[], newState: BookmarkNode[]): DiffResult {
    const diff = BookmarkDiffEngine.calculateDiff(oldState, newState);
    
    // 记录所有操作
    for (const operation of diff.operations) {
      this.recordOperation(operation);
    }
    
    return diff;
  }
  
  /**
   * 创建AI重组操作记录
   */
  recordAIRegenerate(
    oldTree: BookmarkNode[],
    newTree: BookmarkNode[],
    aiPrompt?: string,
    aiReason?: string
  ): void {
    const statistics = this.calculateAIStatistics(oldTree, newTree);
    
    const operation: AIRegenerateOperationRecord = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: OperationType.AI_REGENERATE,
      source: OperationSource.AI,
      timestamp: Date.now(),
      description: 'AI智能重组书签结构',
      nodeType: NodeType.FOLDER,
      nodeId: 'root',
      reversible: true,
      data: {
        oldTree: this.deepClone(oldTree),
        newTree: this.deepClone(newTree),
        aiPrompt,
        aiReason,
        statistics
      }
    };
    
    this.recordOperation(operation);
  }
  
  /**
   * 计算AI统计信息
   */
  private calculateAIStatistics(oldTree: BookmarkNode[], newTree: BookmarkNode[]) {
    const oldCount = this.countNodes(oldTree);
    const newCount = this.countNodes(newTree);
    
    return {
      totalNodes: newCount.total,
      foldersCreated: Math.max(0, newCount.folders - oldCount.folders),
      bookmarksMoved: newCount.bookmarks, // 简化统计
      duplicatesRemoved: Math.max(0, oldCount.total - newCount.total)
    };
  }
  
  /**
   * 统计节点数量
   */
  private countNodes(tree: BookmarkNode[]): { total: number, folders: number, bookmarks: number } {
    let total = 0, folders = 0, bookmarks = 0;
    
    const traverse = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        total++;
        if (node.children) {
          folders++;
          traverse(node.children);
        } else {
          bookmarks++;
        }
      }
    };
    
    traverse(tree);
    return { total, folders, bookmarks };
  }
  
  /**
   * 深克隆对象
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * 撤销重做管理器实现 (预留接口)
 */
export class UndoRedoManagerImpl implements UndoRedoManager {
  private undoStack: OperationRecord[] = [];
  private redoStack: OperationRecord[] = [];
  
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  
  async undo(): Promise<void> {
    // TODO: 实现撤销逻辑
    logger.info('UndoRedoManager', '撤销操作 - 待实现');
  }
  
  async redo(): Promise<void> {
    // TODO: 实现重做逻辑
    logger.info('UndoRedoManager', '重做操作 - 待实现');
  }
  
  getHistory(): OperationRecord[] {
    return [...this.undoStack];
  }
  
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
  
  getHistorySize(): number {
    return this.undoStack.length;
  }
  
  beginBatch(): void {
    // TODO: 实现批量操作开始
  }
  
  endBatch(): void {
    // TODO: 实现批量操作结束
  }
  
  createSavePoint(): string {
    // TODO: 实现安全点创建
    return `savepoint_${Date.now()}`;
  }
  
  async restoreToSavePoint(savePointId: string): Promise<void> {
    // TODO: 实现安全点恢复
    logger.info('UndoRedoManager', `恢复到安全点: ${savePointId} - 待实现`);
  }
}
