/**
 * 现代化存储抽象层
 *
 * 充分利用 Chrome 现代特性：
 * - chrome.storage.session (Chrome 102+)：会话级临时数据
 * - chrome.storage.local：持久化数据
 * - IndexedDB：大量结构化数据
 *
 * 架构原则：
 * - 根据数据生命周期选择合适的存储方式
 * - 自动降级到旧版 API（兼容性）
 * - 统一的类型安全接口
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 存储区域类型
 */
export type StorageArea = 'session' | 'local' | 'sync'

/**
 * 存储项配置
 */
export interface StorageItemConfig {
  /** 存储键 */
  key: string
  /** 默认值 */
  defaultValue?: unknown
  /** 是否启用日志 */
  enableLogging?: boolean
}

/**
 * 现代化存储服务
 *
 * 🆕 充分利用 Chrome 102+ 的 storage.session API
 */
export class ModernStorageService {
  /**
   * 检查 storage.session API 是否可用
   */
  private get isSessionStorageAvailable(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage?.session
  }

  /**
   * 设置会话级数据
   *
   * 优先使用 chrome.storage.session（Chrome 102+）
   * 降级到 chrome.storage.local（带前缀）
   *
   * @example
   * ```typescript
   * await storage.setSession('currentTab', { id: '123', title: 'Example' })
   * ```
   */
  async setSession<T = unknown>(key: string, value: T): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        // 🆕 使用 storage.session（自动清理）
        await chrome.storage.session.set({ [key]: value })
        logger.debug('ModernStorage', `✅ Session 存储成功: ${key}`)
      } else {
        // 降级：使用 local 存储（带前缀标记）
        await chrome.storage.local.set({ [`_session_${key}`]: value })
        logger.debug('ModernStorage', `⚠️ Session 降级到 Local: ${key}`)
      }
    } catch (error) {
      logger.error('ModernStorage', `❌ Session 存储失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 获取会话级数据
   */
  async getSession<T = unknown>(
    key: string,
    defaultValue?: T
  ): Promise<T | undefined> {
    try {
      if (this.isSessionStorageAvailable) {
        const result = await chrome.storage.session.get(key)
        return (result[key] as T) ?? defaultValue
      } else {
        // 降级：从 local 读取
        const result = await chrome.storage.local.get(`_session_${key}`)
        return (result[`_session_${key}`] as T) ?? defaultValue
      }
    } catch (error) {
      logger.error('ModernStorage', `❌ Session 读取失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 删除会话级数据
   */
  async removeSession(key: string): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        await chrome.storage.session.remove(key)
      } else {
        await chrome.storage.local.remove(`_session_${key}`)
      }
      logger.debug('ModernStorage', `✅ Session 删除成功: ${key}`)
    } catch (error) {
      logger.error('ModernStorage', `❌ Session 删除失败: ${key}`, error)
    }
  }

  /**
   * 设置持久化数据
   *
   * 使用 chrome.storage.local（浏览器关闭后保留）
   */
  async setLocal<T = unknown>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value })
      logger.debug('ModernStorage', `✅ Local 存储成功: ${key}`)
    } catch (error) {
      logger.error('ModernStorage', `❌ Local 存储失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 获取持久化数据
   */
  async getLocal<T = unknown>(
    key: string,
    defaultValue?: T
  ): Promise<T | undefined> {
    try {
      const result = await chrome.storage.local.get(key)
      return (result[key] as T) ?? defaultValue
    } catch (error) {
      logger.error('ModernStorage', `❌ Local 读取失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 删除持久化数据
   */
  async removeLocal(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key)
      logger.debug('ModernStorage', `✅ Local 删除成功: ${key}`)
    } catch (error) {
      logger.error('ModernStorage', `❌ Local 删除失败: ${key}`, error)
    }
  }

  /**
   * 设置跨设备同步数据
   *
   * 使用 chrome.storage.sync（需要登录 Chrome）
   * 注意：有配额限制（100KB 总量，8KB 单项）
   */
  async setSync<T = unknown>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.sync.set({ [key]: value })
      logger.debug('ModernStorage', `✅ Sync 存储成功: ${key}`)
    } catch (error) {
      logger.error('ModernStorage', `❌ Sync 存储失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 获取跨设备同步数据
   */
  async getSync<T = unknown>(
    key: string,
    defaultValue?: T
  ): Promise<T | undefined> {
    try {
      const result = await chrome.storage.sync.get(key)
      return (result[key] as T) ?? defaultValue
    } catch (error) {
      logger.error('ModernStorage', `❌ Sync 读取失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 批量设置会话数据
   */
  async setBatchSession(items: Record<string, unknown>): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        await chrome.storage.session.set(items)
      } else {
        const prefixedItems = Object.fromEntries(
          Object.entries(items).map(([k, v]) => [`_session_${k}`, v])
        )
        await chrome.storage.local.set(prefixedItems)
      }
      logger.debug(
        'ModernStorage',
        `✅ 批量 Session 存储成功，数量: ${Object.keys(items).length}`
      )
    } catch (error) {
      logger.error('ModernStorage', '❌ 批量 Session 存储失败', error)
      throw error
    }
  }

  /**
   * 清空所有会话数据
   */
  async clearAllSession(): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        await chrome.storage.session.clear()
      } else {
        // 降级：清空所有 _session_ 前缀的键
        const allItems = await chrome.storage.local.get(null)
        const sessionKeys = Object.keys(allItems).filter(k =>
          k.startsWith('_session_')
        )
        if (sessionKeys.length > 0) {
          await chrome.storage.local.remove(sessionKeys)
        }
      }
      logger.info('ModernStorage', '✅ 所有 Session 数据已清空')
    } catch (error) {
      logger.error('ModernStorage', '❌ Session 清空失败', error)
    }
  }

  /**
   * 监听存储变化
   *
   * @param callback - 变化回调
   * @param area - 监听的存储区域（可选）
   */
  onChanged(
    callback: (
      changes: Record<string, chrome.storage.StorageChange>,
      area: StorageArea
    ) => void,
    area?: StorageArea
  ): () => void {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (!area || areaName === area) {
        callback(changes, areaName as StorageArea)
      }
    }

    chrome.storage.onChanged.addListener(listener)

    // 返回取消订阅函数
    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }
}

/**
 * 单例实例
 */
export const modernStorage = new ModernStorageService()

/**
 * 推荐使用场景：
 *
 * ## Session Storage (chrome.storage.session)
 * - ✅ 用户当前会话的 UI 状态（折叠/展开、选中项）
 * - ✅ 搜索历史（会话级别）
 * - ✅ 未保存的表单数据
 * - ✅ 临时缓存（API 响应、计算结果）
 * - ✅ 当前标签页的上下文信息
 *
 * ## Local Storage (chrome.storage.local)
 * - ✅ 用户偏好设置（主题、语言）
 * - ✅ 扩展配置
 * - ✅ 离线数据缓存
 * - ✅ 持久化状态
 *
 * ## IndexedDB
 * - ✅ 大量书签数据（2万+条）
 * - ✅ 复杂查询需求
 * - ✅ 结构化数据存储
 */
