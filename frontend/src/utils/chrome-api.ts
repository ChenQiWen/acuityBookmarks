/**
 * Chrome API 封装工具
 * 提供统一的错误处理、重试机制和性能优化
 */

import { CHROME_CONFIG, ERROR_CONFIG, BOOKMARK_CONFIG } from '../config/constants';
import { logger } from './logger';

// === 类型定义 ===
export interface ChromeAPIResult<T> {
  success: boolean
  data?: T
  error?: string
  retries?: number
}

export interface ChromeAPIOptions {
  retries?: number
  timeout?: number
  skipErrorMapping?: boolean
}

// === Chrome API错误处理 ===
class ChromeAPIError extends Error {
  originalError?: chrome.runtime.LastError;
  retries = 0;

  constructor(
    message: string,
    originalError?: chrome.runtime.LastError,
    retries = 0
  ) {
    super(message);
    this.name = 'ChromeAPIError';
    this.originalError = originalError;
    this.retries = retries;
  }
}

/**
 * 映射Chrome错误到用户友好的消息
 */
function mapChromeError(error: chrome.runtime.LastError): string {
  if (!error?.message) return ERROR_CONFIG.DEFAULT_ERROR_MESSAGE;

  // 检查是否有映射的错误消息
  for (const [key, message] of Object.entries(ERROR_CONFIG.CHROME_ERROR_MESSAGES)) {
    if (error.message.includes(key)) {
      return message;
    }
  }

  return `Chrome API错误: ${error.message}`;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的Chrome API调用包装器
 */
async function withRetry<T>(
  apiCall: () => Promise<T>,
  options: ChromeAPIOptions = {}
): Promise<ChromeAPIResult<T>> {
  const {
    retries = CHROME_CONFIG.API_RETRY_COUNT,
    timeout = CHROME_CONFIG.API_TIMEOUT,
    skipErrorMapping = false
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 超时处理
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('API调用超时')), timeout);
      });

      const result = await Promise.race([apiCall(), timeoutPromise]);

      logger.info('ChromeAPI', 'API调用成功', { attempt, retries });
      return { success: true, data: result, retries: attempt };

    } catch (error) {
      lastError = error as Error;

      if (attempt < retries) {
        logger.warn('ChromeAPI', 'API调用失败，正在重试', {
          attempt: attempt + 1,
          maxRetries: retries,
          error: (error as Error).message
        });

        // 指数退避延迟
        await delay(ERROR_CONFIG.RETRY_DELAY * Math.pow(2, attempt));
        continue;
      }
    }
  }

  // 所有重试都失败
  const errorMessage = skipErrorMapping
    ? lastError?.message || ERROR_CONFIG.DEFAULT_ERROR_MESSAGE
    : (chrome.runtime.lastError
      ? mapChromeError(chrome.runtime.lastError)
      : lastError?.message || ERROR_CONFIG.DEFAULT_ERROR_MESSAGE
    );

  logger.error('ChromeAPI', 'API调用最终失败', { retries, error: errorMessage });

  return { success: false, error: errorMessage, retries };
}

// === Chrome Bookmarks API封装 ===

/**
 * 获取书签树 - 带错误处理和缓存
 */
export async function getBookmarkTree(_options?: ChromeAPIOptions): Promise<ChromeAPIResult<chrome.bookmarks.BookmarkTreeNode[]>> {
  // 🚀 已迁移到IndexedDB架构，此函数已废弃
  console.warn('⚠️ getBookmarkTree已废弃，请使用IndexedDB相关API');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARK_TREE' });

    if (response?.success && Array.isArray(response.data)) {
      // 将IndexedDB扁平数据转换为Chrome API格式的树形结构
      const mockTree: chrome.bookmarks.BookmarkTreeNode[] = [{
        id: '0',
        parentId: undefined,
        title: '',
        syncing: false,
        children: response.data.map((bookmark: any) => ({
          id: bookmark.id,
          parentId: bookmark.parentId,
          title: bookmark.title,
          url: bookmark.url,
          dateAdded: bookmark.dateAdded,
          index: bookmark.index,
          syncing: false
        }))
      }];

      return {
        success: true,
        data: mockTree
      };
    } else {
      throw new ChromeAPIError('IndexedDB书签数据获取失败');
    }
  } catch (error) {
    return {
      success: false,
      error: (error as ChromeAPIError).message || 'Unknown error'
    };
  }
}

/**
 * 获取书签子节点 - 带错误处理
 */
export async function getBookmarkChildren(parentId: string, options?: ChromeAPIOptions): Promise<ChromeAPIResult<chrome.bookmarks.BookmarkTreeNode[]>> {
  return withRetry(
    () => new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve, reject) => {
      try {
        chrome.bookmarks.getChildren(parentId, (children) => {
          if (chrome.runtime.lastError) {
            reject(new ChromeAPIError(mapChromeError(chrome.runtime.lastError), chrome.runtime.lastError));
          } else {
            resolve(children || []);
          }
        });
      } catch (error) {
        reject(new ChromeAPIError('调用getChildren失败', error as chrome.runtime.LastError));
      }
    }),
    options
  );
}

/**
 * 创建书签 - 带错误处理
 */
export async function createBookmark(
  bookmark: { parentId?: string; index?: number; title?: string; url?: string; },
  options?: ChromeAPIOptions
): Promise<ChromeAPIResult<chrome.bookmarks.BookmarkTreeNode>> {
  return withRetry(
    () => new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
      try {
        chrome.bookmarks.create(bookmark, (result) => {
          if (chrome.runtime.lastError) {
            reject(new ChromeAPIError(mapChromeError(chrome.runtime.lastError), chrome.runtime.lastError));
          } else if (!result) {
            reject(new ChromeAPIError('创建书签失败：返回结果为空'));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(new ChromeAPIError('调用create失败', error as chrome.runtime.LastError));
      }
    }),
    options
  );
}

/**
 * 移动书签 - 带错误处理
 */
export async function moveBookmark(
  id: string,
  destination: { parentId?: string; index?: number; },
  options?: ChromeAPIOptions
): Promise<ChromeAPIResult<chrome.bookmarks.BookmarkTreeNode>> {
  return withRetry(
    () => new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
      try {
        chrome.bookmarks.move(id, destination, (result) => {
          if (chrome.runtime.lastError) {
            reject(new ChromeAPIError(mapChromeError(chrome.runtime.lastError), chrome.runtime.lastError));
          } else if (!result) {
            reject(new ChromeAPIError('移动书签失败：返回结果为空'));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(new ChromeAPIError('调用move失败', error as chrome.runtime.LastError));
      }
    }),
    options
  );
}

/**
 * 删除书签 - 带错误处理
 */
export async function removeBookmark(id: string, options?: ChromeAPIOptions): Promise<ChromeAPIResult<void>> {
  return withRetry(
    () => new Promise<void>((resolve, reject) => {
      try {
        chrome.bookmarks.remove(id, () => {
          if (chrome.runtime.lastError) {
            reject(new ChromeAPIError(mapChromeError(chrome.runtime.lastError), chrome.runtime.lastError));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(new ChromeAPIError('调用remove失败', error as chrome.runtime.LastError));
      }
    }),
    options
  );
}

/**
 * 删除书签树 - 带错误处理
 */
export async function removeBookmarkTree(id: string, options?: ChromeAPIOptions): Promise<ChromeAPIResult<void>> {
  return withRetry(
    () => new Promise<void>((resolve, reject) => {
      try {
        chrome.bookmarks.removeTree(id, () => {
          if (chrome.runtime.lastError) {
            reject(new ChromeAPIError(mapChromeError(chrome.runtime.lastError), chrome.runtime.lastError));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(new ChromeAPIError('调用removeTree失败', error as chrome.runtime.LastError));
      }
    }),
    options
  );
}

// === Chrome Storage API封装 ===

// Chrome Storage API 废弃函数已移除 - 请使用 IndexedDBCore

// === Chrome Runtime API封装 ===

/**
 * 发送消息 - 带错误处理和超时
 */
export async function sendMessage<T>(message: Record<string, unknown>, options?: ChromeAPIOptions): Promise<ChromeAPIResult<T>> {
  return withRetry(
    () => new Promise<T>((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new ChromeAPIError(mapChromeError(chrome.runtime.lastError), chrome.runtime.lastError));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(new ChromeAPIError('调用sendMessage失败', error as chrome.runtime.LastError));
      }
    }),
    options
  );
}

// === 批量操作优化 ===

/**
 * 批量处理书签操作 - 避免阻塞UI
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize = BOOKMARK_CONFIG.BATCH_PROCESS_SIZE
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );

    // 处理批次结果
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.warn('ChromeAPI', '批处理项失败', { error: result.reason });
      }
    }

    // 让出控制权，避免阻塞UI
    if (i + batchSize < items.length) {
      await delay(10); // 10ms延迟
    }
  }

  return results;
}

// === 并发控制 ===
class ConcurrencyController {
  private running = 0;
  private queue: Array<() => Promise<void>> = [];

  private maxConcurrent: number;

  constructor(maxConcurrent = CHROME_CONFIG.MAX_CONCURRENT_CALLS) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.running++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });

      this.processQueue();
    });
  }

  private processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const fn = this.queue.shift();
    if (fn) {
      fn();
    }
  }
}

export const concurrencyController = new ConcurrencyController();
