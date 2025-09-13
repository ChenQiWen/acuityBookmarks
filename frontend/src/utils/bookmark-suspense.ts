/**
 * ⏳ 书签Suspense机制 - 借鉴React Suspense
 * 
 * 功能：
 * - 异步操作状态管理
 * - 加载状态和错误状态处理
 * - 操作排队和优先级管理
 * - 用户体验优化
 */

import { logger } from './logger';

// Suspense状态
export const SuspenseState = {
  IDLE: 'idle',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
} as const;

export type SuspenseState = typeof SuspenseState[keyof typeof SuspenseState]

// 异步操作类型
export const OperationType = {
  LOAD_BOOKMARKS: 'load_bookmarks',
  SAVE_BOOKMARKS: 'save_bookmarks',
  SEARCH_BOOKMARKS: 'search_bookmarks',
  BACKUP_BOOKMARKS: 'backup_bookmarks',
  RESTORE_BOOKMARKS: 'restore_bookmarks',
  SYNC_BOOKMARKS: 'sync_bookmarks'
} as const;

export type OperationType = typeof OperationType[keyof typeof OperationType]

// 操作优先级
export const OperationPriority = {
  IMMEDIATE: 0,    // 立即执行
  HIGH: 1,         // 用户直接交互
  NORMAL: 2,       // 常规操作
  LOW: 3,          // 后台任务
  IDLE: 4          // 空闲时执行
} as const;

export type OperationPriority = typeof OperationPriority[keyof typeof OperationPriority]

// 暂停的Promise
export interface SuspendedPromise<T = any> {
  id: string
  promise: Promise<T>
  type: OperationType
  priority: OperationPriority
  startTime: number
  timeout?: number
  retryCount: number
  maxRetries: number
  state: SuspenseState
  metadata: any
  onProgress?: (progress: number) => void
  onCancel?: () => void
}

// 加载状态
export interface LoadingState {
  isLoading: boolean
  operation: OperationType | null
  progress: number
  message: string
  startTime: number
  estimatedTime?: number
}

// Suspense配置
export interface SuspenseConfig {
  maxConcurrentOperations: number
  defaultTimeout: number
  defaultMaxRetries: number
  enableProgressReporting: boolean
  enableAutoRetry: boolean
}

export class BookmarkSuspense {
  private suspendedPromises = new Map<string, SuspendedPromise>();
  private operationQueue: SuspendedPromise[] = [];
  private activeOperations = new Set<string>();
  private loadingStates = new Map<OperationType, LoadingState>();
  
  private config: SuspenseConfig = {
    maxConcurrentOperations: 3,
    defaultTimeout: 30000,    // 30秒
    defaultMaxRetries: 2,
    enableProgressReporting: true,
    enableAutoRetry: true
  };
  
  // 事件监听器
  private listeners = new Map<string, Function[]>();
  
  // 定时器引用，用于清理
  private timeoutCheckInterval: number | null = null;
  
  constructor(config?: Partial<SuspenseConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // 定期检查超时操作 - 优化版
    this.timeoutCheckInterval = setInterval(this.checkTimeouts.bind(this), 5000);
    
    // 页面卸载时自动清理
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.dispose();
      });
    }
    
    logger.info('BookmarkSuspense', '⏳ Suspense机制初始化完成');
  }
  
  /**
   * 清理资源，停止定时器
   */
  dispose(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
    
    // 清理所有待处理的操作
    this.suspendedPromises.clear();
    this.operationQueue.length = 0;
    this.activeOperations.clear();
    this.loadingStates.clear();
    this.listeners.clear();
    
    logger.info('BookmarkSuspense', '🧹 Suspense机制已清理');
  }
  
  /**
   * 创建可暂停的Promise
   */
  suspend<T>(
    operationType: OperationType,
    promiseFactory: () => Promise<T>,
    options?: {
      priority?: OperationPriority
      timeout?: number
      maxRetries?: number
      metadata?: any
      onProgress?: (progress: number) => void
      onCancel?: () => void
    }
  ): Promise<T> {
    
    const id = this.generateId();
    const priority = options?.priority ?? OperationPriority.NORMAL;
    const timeout = options?.timeout ?? this.config.defaultTimeout;
    const maxRetries = options?.maxRetries ?? this.config.defaultMaxRetries;
    
    // 创建暂停的Promise
    const suspendedPromise: SuspendedPromise<T> = {
      id,
      promise: this.createManagedPromise(promiseFactory, id, operationType),
      type: operationType,
      priority,
      startTime: Date.now(),
      timeout,
      retryCount: 0,
      maxRetries,
      state: SuspenseState.IDLE,
      metadata: options?.metadata || {},
      onProgress: options?.onProgress,
      onCancel: options?.onCancel
    };
    
    this.suspendedPromises.set(id, suspendedPromise);
    
    // 根据优先级添加到队列
    this.enqueueOperation(suspendedPromise);
    
    // 尝试执行下一个操作
    this.processQueue();
    
    return suspendedPromise.promise;
  }
  
  /**
   * 创建受管理的Promise
   */
  private createManagedPromise<T>(
    promiseFactory: () => Promise<T>,
    id: string,
    operationType: OperationType
  ): Promise<T> {
    
    return new Promise<T>((resolve, reject) => {
      const suspendedPromise = this.suspendedPromises.get(id)!;
      
      // 创建实际的Promise
      const actualPromise = promiseFactory();
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        if (suspendedPromise.state === SuspenseState.PENDING) {
          this.handleTimeout(id);
          reject(new Error(`操作超时: ${operationType}`));
        }
      }, suspendedPromise.timeout);
      
      actualPromise
        .then((result) => {
          clearTimeout(timeoutId);
          this.handleResolve(id, result);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          this.handleReject(id, error);
          reject(error);
        });
    });
  }
  
  /**
   * 入队操作
   */
  private enqueueOperation(suspendedPromise: SuspendedPromise): void {
    // 按优先级插入队列
    let insertIndex = this.operationQueue.length;
    
    for (let i = 0; i < this.operationQueue.length; i++) {
      if (this.operationQueue[i].priority > suspendedPromise.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.operationQueue.splice(insertIndex, 0, suspendedPromise);
    
    logger.debug('BookmarkSuspense', `📋 操作入队: ${suspendedPromise.type} (优先级: ${suspendedPromise.priority})`);
  }
  
  /**
   * 处理队列
   */
  private processQueue(): void {
    // 检查是否可以执行更多操作
    while (
      this.operationQueue.length > 0 &&
      this.activeOperations.size < this.config.maxConcurrentOperations
    ) {
      const nextOperation = this.operationQueue.shift()!;
      this.startOperation(nextOperation);
    }
  }
  
  /**
   * 开始执行操作
   */
  private startOperation(suspendedPromise: SuspendedPromise): void {
    suspendedPromise.state = SuspenseState.PENDING;
    this.activeOperations.add(suspendedPromise.id);
    
    // 更新加载状态
    this.updateLoadingState(suspendedPromise.type, {
      isLoading: true,
      operation: suspendedPromise.type,
      progress: 0,
      message: this.getOperationMessage(suspendedPromise.type),
      startTime: suspendedPromise.startTime,
      estimatedTime: this.estimateOperationTime(suspendedPromise.type)
    });
    
    // 触发状态变更事件
    this.emit('operationStart', {
      id: suspendedPromise.id,
      type: suspendedPromise.type,
      priority: suspendedPromise.priority
    });
    
    logger.info('BookmarkSuspense', `🚀 开始执行: ${suspendedPromise.type}`);
  }
  
  /**
   * 处理Promise解决
   */
  private handleResolve<T>(id: string, result: T): void {
    const suspendedPromise = this.suspendedPromises.get(id);
    
    if (!suspendedPromise) return;
    
    suspendedPromise.state = SuspenseState.RESOLVED;
    this.activeOperations.delete(id);
    
    // 更新加载状态
    this.updateLoadingState(suspendedPromise.type, {
      isLoading: false,
      operation: null,
      progress: 100,
      message: '操作完成',
      startTime: suspendedPromise.startTime
    });
    
    // 触发完成事件
    this.emit('operationComplete', {
      id,
      type: suspendedPromise.type,
      result,
      duration: Date.now() - suspendedPromise.startTime
    });
    
    // 清理
    this.suspendedPromises.delete(id);
    
    // 处理下一个操作
    this.processQueue();
    
    logger.info('BookmarkSuspense', `✅ 操作完成: ${suspendedPromise.type}`);
  }
  
  /**
   * 处理Promise拒绝
   */
  private handleReject(id: string, error: any): void {
    const suspendedPromise = this.suspendedPromises.get(id);
    
    if (!suspendedPromise) return;
    
    // 检查是否需要重试
    if (
      this.config.enableAutoRetry &&
      suspendedPromise.retryCount < suspendedPromise.maxRetries &&
      this.isRetryableError(error)
    ) {
      this.retryOperation(suspendedPromise);
      return;
    }
    
    suspendedPromise.state = SuspenseState.REJECTED;
    this.activeOperations.delete(id);
    
    // 更新加载状态
    this.updateLoadingState(suspendedPromise.type, {
      isLoading: false,
      operation: null,
      progress: 0,
      message: `操作失败: ${error.message}`,
      startTime: suspendedPromise.startTime
    });
    
    // 触发错误事件
    this.emit('operationError', {
      id,
      type: suspendedPromise.type,
      error,
      retryCount: suspendedPromise.retryCount,
      duration: Date.now() - suspendedPromise.startTime
    });
    
    // 清理
    this.suspendedPromises.delete(id);
    
    // 处理下一个操作
    this.processQueue();
    
    logger.error('BookmarkSuspense', `❌ 操作失败: ${suspendedPromise.type}`, error);
  }
  
  /**
   * 重试操作
   */
  private retryOperation(suspendedPromise: SuspendedPromise): void {
    suspendedPromise.retryCount++;
    suspendedPromise.state = SuspenseState.IDLE;
    suspendedPromise.startTime = Date.now();
    
    // 计算重试延迟（指数退避）
    const delay = Math.min(1000 * Math.pow(2, suspendedPromise.retryCount - 1), 10000);
    
    logger.info('BookmarkSuspense', `🔁 重试操作: ${suspendedPromise.type} (第${suspendedPromise.retryCount}次)`);
    
    setTimeout(() => {
      this.enqueueOperation(suspendedPromise);
      this.processQueue();
    }, delay);
    
    // 触发重试事件
    this.emit('operationRetry', {
      id: suspendedPromise.id,
      type: suspendedPromise.type,
      retryCount: suspendedPromise.retryCount,
      delay
    });
  }
  
  /**
   * 处理超时
   */
  private handleTimeout(id: string): void {
    const suspendedPromise = this.suspendedPromises.get(id);
    
    if (!suspendedPromise) return;
    
    logger.warn('BookmarkSuspense', `⏰ 操作超时: ${suspendedPromise.type}`);
    
    // 尝试取消操作
    if (suspendedPromise.onCancel) {
      suspendedPromise.onCancel();
    }
    
    // 标记为超时错误
    this.handleReject(id, new Error(`操作超时: ${suspendedPromise.type}`));
  }
  
  /**
   * 检查超时操作
   */
  private checkTimeouts(): void {
    const now = Date.now();
    
    for (const [id, suspendedPromise] of this.suspendedPromises) {
      if (
        suspendedPromise.state === SuspenseState.PENDING &&
        suspendedPromise.timeout &&
        now - suspendedPromise.startTime > suspendedPromise.timeout
      ) {
        this.handleTimeout(id);
      }
    }
  }
  
  /**
   * 取消操作
   */
  cancel(id: string): boolean {
    const suspendedPromise = this.suspendedPromises.get(id);
    
    if (!suspendedPromise) return false;
    
    suspendedPromise.state = SuspenseState.CANCELLED;
    
    // 从队列中移除
    const queueIndex = this.operationQueue.findIndex(op => op.id === id);
    if (queueIndex !== -1) {
      this.operationQueue.splice(queueIndex, 1);
    }
    
    // 从活跃操作中移除
    this.activeOperations.delete(id);
    
    // 触发取消回调
    if (suspendedPromise.onCancel) {
      suspendedPromise.onCancel();
    }
    
    // 触发取消事件
    this.emit('operationCancel', {
      id,
      type: suspendedPromise.type
    });
    
    // 清理
    this.suspendedPromises.delete(id);
    
    // 处理下一个操作
    this.processQueue();
    
    logger.info('BookmarkSuspense', `❌ 操作已取消: ${suspendedPromise.type}`);
    return true;
  }
  
  /**
   * 取消所有操作
   */
  cancelAll(): void {
    const ids = Array.from(this.suspendedPromises.keys());
    ids.forEach(id => this.cancel(id));
    
    logger.info('BookmarkSuspense', '🛑 所有操作已取消');
  }
  
  /**
   * 更新操作进度
   */
  updateProgress(id: string, progress: number): void {
    const suspendedPromise = this.suspendedPromises.get(id);
    
    if (!suspendedPromise || suspendedPromise.state !== SuspenseState.PENDING) return;
    
    // 触发进度回调
    if (suspendedPromise.onProgress) {
      suspendedPromise.onProgress(progress);
    }
    
    // 更新加载状态
    const loadingState = this.loadingStates.get(suspendedPromise.type);
    if (loadingState) {
      loadingState.progress = progress;
    }
    
    // 触发进度事件
    this.emit('operationProgress', {
      id,
      type: suspendedPromise.type,
      progress
    });
  }
  
  /**
   * 获取加载状态
   */
  getLoadingState(operationType?: OperationType): LoadingState | LoadingState[] {
    if (operationType) {
      return this.loadingStates.get(operationType) || {
        isLoading: false,
        operation: null,
        progress: 0,
        message: '',
        startTime: 0
      };
    }
    
    return Array.from(this.loadingStates.values());
  }
  
  /**
   * 获取操作统计
   */
  getOperationStats(): {
    total: number
    pending: number
    active: number
    queued: number
    byType: Record<OperationType, number>
    byPriority: Record<OperationPriority, number>
  } {
    
    const stats = {
      total: this.suspendedPromises.size,
      pending: 0,
      active: this.activeOperations.size,
      queued: this.operationQueue.length,
      byType: {} as Record<OperationType, number>,
      byPriority: {} as Record<OperationPriority, number>
    };
    
    for (const suspendedPromise of this.suspendedPromises.values()) {
      if (suspendedPromise.state === SuspenseState.PENDING) {
        stats.pending++;
      }
      
      stats.byType[suspendedPromise.type] = (stats.byType[suspendedPromise.type] || 0) + 1;
      stats.byPriority[suspendedPromise.priority] = (stats.byPriority[suspendedPromise.priority] || 0) + 1;
    }
    
    return stats;
  }
  
  // === 辅助方法 ===
  
  private generateId(): string {
    return `suspense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private updateLoadingState(operationType: OperationType, state: LoadingState): void {
    this.loadingStates.set(operationType, state);
    
    // 触发状态变更事件
    this.emit('loadingStateChange', {
      operationType,
      state
    });
  }
  
  private getOperationMessage(operationType: OperationType): string {
    const messages = {
      [OperationType.LOAD_BOOKMARKS]: '正在加载书签...',
      [OperationType.SAVE_BOOKMARKS]: '正在保存书签...',
      [OperationType.SEARCH_BOOKMARKS]: '正在搜索书签...',
      [OperationType.BACKUP_BOOKMARKS]: '正在备份书签...',
      [OperationType.RESTORE_BOOKMARKS]: '正在恢复书签...',
      [OperationType.SYNC_BOOKMARKS]: '正在同步书签...'
    };
    
    return messages[operationType] || '正在处理...';
  }
  
  private estimateOperationTime(operationType: OperationType): number {
    const estimates = {
      [OperationType.LOAD_BOOKMARKS]: 2000,     // 2秒
      [OperationType.SAVE_BOOKMARKS]: 5000,     // 5秒
      [OperationType.SEARCH_BOOKMARKS]: 1000,   // 1秒
      [OperationType.BACKUP_BOOKMARKS]: 10000,  // 10秒
      [OperationType.RESTORE_BOOKMARKS]: 15000, // 15秒
      [OperationType.SYNC_BOOKMARKS]: 8000      // 8秒
    };
    
    return estimates[operationType] || 3000;
  }
  
  private isRetryableError(error: any): boolean {
    const retryablePatterns = [
      'network',
      'timeout',
      'temporary',
      'rate limit',
      'quota_bytes_used'
    ];
    
    const errorText = (error.message || '').toLowerCase();
    return retryablePatterns.some(pattern => errorText.includes(pattern));
  }
  
  // === 事件系统 ===
  
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('BookmarkSuspense', `事件监听器错误: ${event}`, error);
        }
      });
    }
  }
}

// 单例导出
export const bookmarkSuspense = new BookmarkSuspense();
