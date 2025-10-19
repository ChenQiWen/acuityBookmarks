import { logger } from '@/infrastructure/logging/logger'

export const storageService = {
  async read(keys: string[]): Promise<Record<string, unknown>> {
    try {
      return await chrome.storage.local.get(keys)
    } catch (error) {
      logger.error('StorageService', '读取 storage.local 失败', error)
      throw error
    }
  },

  async write(payload: Record<string, unknown>): Promise<void> {
    try {
      await chrome.storage.local.set(payload)
    } catch (error) {
      logger.error('StorageService', '写入 storage.local 失败', error)
      throw error
    }
  }
}
