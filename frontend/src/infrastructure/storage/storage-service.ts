/**
 * 存储服务 - 基础设施层
 *
 * 职责：
 * - 封装 Chrome Storage API
 * - 提供统一的存储访问接口
 * - 处理存储操作的错误
 *
 * 设计：
 * - 使用 chrome.storage.local 作为底层存储
 * - 所有操作均为异步
 * - 错误会被日志记录并向上抛出
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 存储服务对象
 *
 * 提供对 Chrome 本地存储的简化访问接口
 */
export const storageService = {
  /**
   * 从本地存储读取数据
   *
   * @param keys - 要读取的键名数组
   * @returns 包含请求键值对的对象
   * @throws 当存储访问失败时抛出错误
   *
   * @example
   * const data = await storageService.read(['theme', 'language'])
   * // 返回: { theme: 'dark', language: 'zh-CN' }
   */
  async read(keys: string[]): Promise<Record<string, unknown>> {
    try {
      return await chrome.storage.local.get(keys)
    } catch (error) {
      logger.error('StorageService', '读取 storage.local 失败', error)
      throw error
    }
  },

  /**
   * 向本地存储写入数据
   *
   * @param payload - 要写入的键值对对象
   * @returns Promise，写入完成后 resolve
   * @throws 当存储访问失败时抛出错误
   *
   * @example
   * await storageService.write({ theme: 'dark', language: 'zh-CN' })
   */
  async write(payload: Record<string, unknown>): Promise<void> {
    try {
      await chrome.storage.local.set(payload)
    } catch (error) {
      logger.error('StorageService', '写入 storage.local 失败', error)
      throw error
    }
  }
}
