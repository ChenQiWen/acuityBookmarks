/**
 * 设置应用服务
 *
 * 职责：
 * - 管理应用的全局设置
 * - 协调全局状态管理器和 IndexedDB 存储
 * - 提供设置的读取、保存和删除接口
 * - 处理设置的同步和降级
 *
 * 设计：
 * - 全局状态（主题、语言等）双写到全局状态管理器和 IndexedDB
 * - 全局状态优先从内存读取，降级到 IndexedDB
 * - 其他设置仅使用 IndexedDB
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import {
  globalStateManager,
  type GlobalState
} from '@/infrastructure/global-state/global-state-manager'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 全局设置键名枚举
 *
 * 定义所有全局设置的标准键名
 */
export const GLOBAL_SETTING_KEYS = {
  /** 主题设置 */
  THEME: 'theme',
  /** 语言设置 */
  LANGUAGE: 'language',
  /** 自动同步开关 */
  AUTO_SYNC: 'autoSync',
  /** 显示图标开关 */
  SHOW_FAVICONS: 'showFavicons',
  /** 紧凑模式开关 */
  COMPACT_MODE: 'compactMode',
  /** 搜索引擎选择 */
  SEARCH_ENGINE: 'searchEngine',
  /** 自动跟随系统主题开关 */
  AUTO_FOLLOW_SYSTEM_THEME: 'autoFollowSystemTheme'
} as const

/**
 * 设置应用服务类
 */
export class SettingsAppService {
  /**
   * 确保依赖服务已初始化
   *
   * @private
   */
  private async ensureInit() {
    await Promise.all([
      indexedDBManager.initialize(),
      globalStateManager.initialize()
    ])
  }

  /**
   * 获取设置值
   *
   * 对于全局状态（主题、语言等），优先从全局状态管理器获取，
   * 失败时降级到 IndexedDB。其他设置直接从 IndexedDB 获取。
   *
   * @param key - 设置键名
   * @returns 设置值，不存在时返回 null
   */
  async getSetting<T>(key: string): Promise<T | null> {
    await this.ensureInit()

    // 全局状态优先从全局状态管理器获取
    if (this.isGlobalSetting(key)) {
      try {
        const state = globalStateManager.getState()
        if (!state) {
          logger.warn(
            'SettingsAppService',
            '全局状态为空，尝试从 IndexedDB 获取',
            { key }
          )
          return indexedDBManager.getSetting<T>(key)
        }

        switch (key) {
          case GLOBAL_SETTING_KEYS.THEME:
            return (state.theme ?? null) as T
          case GLOBAL_SETTING_KEYS.LANGUAGE:
            return (state.language ?? null) as T
          case GLOBAL_SETTING_KEYS.AUTO_SYNC:
            return (state.autoSync ?? null) as T
          case GLOBAL_SETTING_KEYS.SHOW_FAVICONS:
            return (state.showFavicons ?? null) as T
          case GLOBAL_SETTING_KEYS.COMPACT_MODE:
            return (state.compactMode ?? null) as T
          case GLOBAL_SETTING_KEYS.SEARCH_ENGINE:
            return (state.searchEngine ?? null) as T
          case GLOBAL_SETTING_KEYS.AUTO_FOLLOW_SYSTEM_THEME:
            return (state.autoFollowSystemTheme ?? null) as T
        }
      } catch (error) {
        logger.error('SettingsAppService', '从全局状态管理器获取设置失败', {
          key,
          error
        })
        // 降级到 IndexedDB
        return indexedDBManager.getSetting<T>(key)
      }
    }

    // 其他设置从IndexedDB获取
    return indexedDBManager.getSetting<T>(key)
  }

  /**
   * 保存设置
   *
   * 对于全局状态，同时保存到全局状态管理器和 IndexedDB（双写）。
   * 其他设置只保存到 IndexedDB。
   *
   * @param key - 设置键名
   * @param value - 设置值
   * @param type - 可选的类型标识
   * @param description - 可选的描述信息
   */
  async saveSetting(
    key: string,
    value: unknown,
    type?: string,
    description?: string
  ): Promise<void> {
    await this.ensureInit()

    // 全局状态同时保存到两个地方
    if (this.isGlobalSetting(key)) {
      await this.saveGlobalSetting(key, value)
    }

    // 所有设置都保存到IndexedDB（保持向后兼容）
    return indexedDBManager.saveSetting(key, value, type, description)
  }

  /**
   * 删除设置
   */
  async deleteSetting(key: string): Promise<void> {
    await this.ensureInit()

    // 全局状态同时从两个地方删除
    if (this.isGlobalSetting(key)) {
      await this.deleteGlobalSetting(key)
    }

    return indexedDBManager.deleteSetting(key)
  }

  /**
   * 判断是否为全局设置
   */
  private isGlobalSetting(
    key: string
  ): key is (typeof GLOBAL_SETTING_KEYS)[keyof typeof GLOBAL_SETTING_KEYS] {
    return Object.values(GLOBAL_SETTING_KEYS).includes(
      key as (typeof GLOBAL_SETTING_KEYS)[keyof typeof GLOBAL_SETTING_KEYS]
    )
  }

  /**
   * 保存全局设置到全局状态管理器
   */
  private async saveGlobalSetting(key: string, value: unknown): Promise<void> {
    try {
      switch (key) {
        case GLOBAL_SETTING_KEYS.THEME:
          await globalStateManager.setTheme(value as 'light' | 'dark')
          break
        case GLOBAL_SETTING_KEYS.LANGUAGE:
          await globalStateManager.setLanguage(value as string)
          break
        case GLOBAL_SETTING_KEYS.AUTO_SYNC:
          await globalStateManager.setAutoSync(value as boolean)
          break
        case GLOBAL_SETTING_KEYS.SHOW_FAVICONS:
          await globalStateManager.setShowFavicons(value as boolean)
          break
        case GLOBAL_SETTING_KEYS.COMPACT_MODE:
          await globalStateManager.setCompactMode(value as boolean)
          break
        case GLOBAL_SETTING_KEYS.SEARCH_ENGINE:
          await globalStateManager.setSearchEngine(
            value as 'fuse' | 'vector' | 'hybrid'
          )
          break
        case GLOBAL_SETTING_KEYS.AUTO_FOLLOW_SYSTEM_THEME:
          await globalStateManager.setAutoFollowSystemTheme(value as boolean)
          break
      }
    } catch (error) {
      logger.error('SettingsAppService', `保存全局设置失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 删除全局设置
   */
  private async deleteGlobalSetting(key: string): Promise<void> {
    // 对于全局设置，删除意味着重置为默认值
    try {
      switch (key) {
        case GLOBAL_SETTING_KEYS.THEME:
          await globalStateManager.setTheme('light') // 删除主题时重置为明亮主题
          break
        case GLOBAL_SETTING_KEYS.LANGUAGE:
          await globalStateManager.setLanguage('en')
          break
        case GLOBAL_SETTING_KEYS.AUTO_SYNC:
          await globalStateManager.setAutoSync(true)
          break
        case GLOBAL_SETTING_KEYS.SHOW_FAVICONS:
          await globalStateManager.setShowFavicons(true)
          break
        case GLOBAL_SETTING_KEYS.COMPACT_MODE:
          await globalStateManager.setCompactMode(false)
          break
        case GLOBAL_SETTING_KEYS.SEARCH_ENGINE:
          await globalStateManager.setSearchEngine('hybrid')
          break
        case GLOBAL_SETTING_KEYS.AUTO_FOLLOW_SYSTEM_THEME:
          await globalStateManager.setAutoFollowSystemTheme(false)
          break
      }
    } catch (error) {
      logger.error('SettingsAppService', `删除全局设置失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 获取所有全局设置（便捷方法）
   */
  async getGlobalSettings() {
    await this.ensureInit()
    return globalStateManager.getState()
  }

  /**
   * 批量保存全局设置（便捷方法）
   */
  async saveGlobalSettings(settings: Partial<GlobalState>): Promise<void> {
    await this.ensureInit()

    try {
      if (settings.theme !== undefined) {
        await globalStateManager.setTheme(settings.theme)
      }
      if (settings.language !== undefined) {
        await globalStateManager.setLanguage(settings.language)
      }
      if (settings.autoSync !== undefined) {
        await globalStateManager.setAutoSync(settings.autoSync)
      }
      if (settings.showFavicons !== undefined) {
        await globalStateManager.setShowFavicons(settings.showFavicons)
      }
      if (settings.compactMode !== undefined) {
        await globalStateManager.setCompactMode(settings.compactMode)
      }
      if (settings.searchEngine !== undefined) {
        await globalStateManager.setSearchEngine(settings.searchEngine)
      }
    } catch (error) {
      logger.error('SettingsAppService', '批量保存全局设置失败', error)
      throw error
    }
  }
}

export const settingsAppService = new SettingsAppService()
