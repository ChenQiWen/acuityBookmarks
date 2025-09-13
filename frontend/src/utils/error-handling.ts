/**
 * 统一错误处理和健壮性增强工具
 * 基于产品文档的高可靠性要求设计
 */

import { ERROR_CONFIG } from '../config/constants';
import { logger } from './logger';

// === 类型定义 ===
export interface ErrorContext {
  operation: string
  component?: string
  metadata?: Record<string, string | number | boolean>
  retryable?: boolean
  userFriendly?: boolean
}

export interface RetryOptions {
  maxAttempts: number
  delay: number
  backoff: boolean
  shouldRetry?: (error: Error) => boolean
}

// === 错误分类 ===
export const ErrorType = {
  NETWORK: 'NETWORK',
  CHROME_API: 'CHROME_API', 
  VALIDATION: 'VALIDATION',
  PERMISSION: 'PERMISSION',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType]

export class AppError extends Error {
  type: ErrorType;
  context?: ErrorContext;
  originalError?: Error;
  
  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.context = context;
    this.originalError = originalError;
  }
}

// === 错误分类器 ===
export function classifyError(error: Error | string): ErrorType {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  if (errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('Cannot access contents') ||
      errorMessage.includes('chrome')) {
    return ErrorType.CHROME_API;
  }
  
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('TimeoutError')) {
    return ErrorType.TIMEOUT;
  }
  
  if (errorMessage.includes('Permission') ||
      errorMessage.includes('Unauthorized') ||
      errorMessage.includes('Forbidden')) {
    return ErrorType.PERMISSION;
  }
  
  if (errorMessage.includes('Network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection')) {
    return ErrorType.NETWORK;
  }
  
  return ErrorType.UNKNOWN;
}

// === 用户友好错误消息映射 ===
export function getUserFriendlyMessage(error: Error | AppError): string {
  const errorType = error instanceof AppError ? error.type : classifyError(error);
  const originalMessage = error.message;
  
  switch (errorType) {
    case ErrorType.CHROME_API:
      return (ERROR_CONFIG.CHROME_ERROR_MESSAGES as Record<string, string>)[originalMessage] || 
             '浏览器扩展遇到问题，请刷新页面后重试';
    
    case ErrorType.NETWORK:
      return '网络连接异常，请检查网络后重试';
    
    case ErrorType.PERMISSION:
      return '权限不足，请检查浏览器扩展权限设置';
    
    case ErrorType.TIMEOUT:
      return '操作超时，请稍后重试';
    
    case ErrorType.VALIDATION:
      return '数据格式错误，请检查输入内容';
    
    default:
      return ERROR_CONFIG.DEFAULT_ERROR_MESSAGE;
  }
}

// === 重试机制 ===
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: ErrorContext
): Promise<T> {
  const {
    maxAttempts = ERROR_CONFIG.MAX_RETRY_ATTEMPTS,
    delay = ERROR_CONFIG.RETRY_DELAY,
    backoff = true,
    shouldRetry = () => true
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info('ErrorHandling', '重试成功', { 
          operation: context?.operation,
          attempt,
          maxAttempts
        });
      }
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // 检查是否应该重试
      if (attempt >= maxAttempts || !shouldRetry(lastError)) {
        break;
      }
      
      logger.warn('ErrorHandling', '操作失败，准备重试', {
        operation: context?.operation,
        attempt,
        maxAttempts,
        error: lastError.message,
        nextRetryIn: backoff ? delay * Math.pow(2, attempt - 1) : delay
      });
      
      // 等待后重试（支持指数退避）
      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // 所有重试失败，抛出增强错误
  if (!lastError) {
    lastError = new Error('操作失败但没有捕获到具体错误');
  }
  
  const errorType = classifyError(lastError);
  const appError = new AppError(
    getUserFriendlyMessage(lastError),
    errorType,
    { operation: context?.operation || 'unknown', ...context, retryable: true },
    lastError
  );

  logger.error('ErrorHandling', '重试最终失败', {
    operation: context?.operation,
    maxAttempts,
    error: lastError.message,
    errorType
  });

  throw appError;
}

// === 竞态条件防护 ===
class OperationQueue {
  private operations = new Map<string, Promise<unknown>>();

  /**
   * 确保同一个key的操作串行执行
   */
  async serialize<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // 等待之前的操作完成
    const previousOperation = this.operations.get(key);
    if (previousOperation) {
      try {
        await previousOperation;
      } catch {
        // 忽略之前操作的错误
      }
    }

    // 执行当前操作
    const currentOperation = operation();
    this.operations.set(key, currentOperation);

    try {
      return await currentOperation;
    } finally {
      // 清理已完成的操作
      if (this.operations.get(key) === currentOperation) {
        this.operations.delete(key);
      }
    }
  }

  /**
   * 取消特定key的操作
   */
  cancel(key: string): boolean {
    return this.operations.delete(key);
  }

  /**
   * 取消所有操作
   */
  cancelAll(): void {
    this.operations.clear();
  }

  /**
   * 获取正在进行的操作数量
   */
  get activeCount(): number {
    return this.operations.size;
  }
}

export const operationQueue = new OperationQueue();

// === 边界错误处理 ===
export class ErrorBoundary {
  private errorCallbacks: Array<(error: AppError) => void> = [];
  private errorCount = 0;
  private lastErrorTime = 0;
  
  /**
   * 注册错误回调
   */
  onError(callback: (error: AppError) => void): () => void {
    this.errorCallbacks.push(callback);
    
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 处理错误
   */
  handleError(error: Error | AppError, context?: ErrorContext): void {
    const now = Date.now();
    this.errorCount++;
    this.lastErrorTime = now;

    // 转换为AppError
    const appError = error instanceof AppError 
      ? error 
      : new AppError(
          getUserFriendlyMessage(error),
          classifyError(error),
          context,
          error
        );

    // 记录错误
    logger.error('ErrorBoundary', '捕获错误', {
      operation: context?.operation,
      component: context?.component,
      errorType: appError.type,
      message: appError.message,
      errorCount: this.errorCount
    });

    // 通知所有回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(appError);
      } catch (callbackError) {
        logger.error('ErrorBoundary', '错误回调执行失败', { callbackError });
      }
    });

    // 检查是否需要降级处理
    if (this.shouldDegrade()) {
      this.handleDegradation(appError);
    }
  }

  /**
   * 检查是否需要降级
   */
  private shouldDegrade(): boolean {
    const now = Date.now();
    const recentErrors = this.errorCount > 5 && (now - this.lastErrorTime) < 30000; // 30秒内超过5个错误
    return recentErrors;
  }

  /**
   * 处理降级
   */
  private handleDegradation(error: AppError): void {
    logger.warn('ErrorBoundary', '启动降级模式', {
      errorCount: this.errorCount,
      errorType: error.type
    });

    // 通知用户系统进入降级模式
    // 这里可以显示全局通知或切换到简化模式
  }

  /**
   * 重置错误计数器
   */
  reset(): void {
    this.errorCount = 0;
    this.lastErrorTime = 0;
  }

  /**
   * 获取错误统计
   */
  getStats(): { errorCount: number; lastErrorTime: number } {
    return {
      errorCount: this.errorCount,
      lastErrorTime: this.lastErrorTime
    };
  }
}

export const errorBoundary = new ErrorBoundary();

// === 安全执行包装器 ===
export async function safeExecute<T>(
  operation: () => Promise<T> | T,
  context: ErrorContext,
  fallback?: T
): Promise<T | undefined> {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    errorBoundary.handleError(error as Error, context);
    
    if (fallback !== undefined) {
      return fallback;
    }
    
    return undefined;
  }
}

/**
 * 同步版本的安全执行
 */
export function safeExecuteSync<T>(
  operation: () => T,
  context: ErrorContext,
  fallback?: T
): T | undefined {
  try {
    return operation();
  } catch (error) {
    errorBoundary.handleError(error as Error, context);
    
    if (fallback !== undefined) {
      return fallback;
    }
    
    return undefined;
  }
}

// === 数据验证工具 ===
export class DataValidator {
  static isBookmarkTreeNode(obj: unknown): obj is chrome.bookmarks.BookmarkTreeNode {
    if (!obj || typeof obj !== 'object') return false;
    const node = obj as Record<string, unknown>;
    return typeof node.id === 'string' && typeof node.title === 'string';
  }

  static isBookmarkArray(arr: unknown): arr is chrome.bookmarks.BookmarkTreeNode[] {
    return Array.isArray(arr) && arr.every(item => this.isBookmarkTreeNode(item));
  }

  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeBookmarkTitle(title: string): string {
    return title.replace(/[<>:"/\\|?*]/g, '').substring(0, 255);
  }
}

// === 导出便利函数 ===
export const handleAsync = (fn: (...args: unknown[]) => Promise<unknown>) => (req: unknown, res: unknown, next: (error?: unknown) => void) => {
  Promise.resolve(fn(req, res, next)).catch((error: unknown) => next(error));
};

export const createErrorHandler = (context: ErrorContext) => {
  return (error: Error) => errorBoundary.handleError(error, context);
};
