/**
 * 应用初始化器
 * 处理IndexedDB架构初始化和应用启动逻辑
 * 注意：迁移功能已移除，现在专注于IndexedDB初始化
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from './logger'

export interface InitializationResult {
  success: boolean
  error?: string
  initTime: number
}

export interface InitializationOptions {
  onInitProgress?: (step: string, progress: number) => void
}

/**
 * 应用初始化器
 * 统一管理IndexedDB初始化
 */
export class AppInitializer {
  constructor() {
    // 统一API通过导入可用
  }

  /**
   * 完整的应用初始化流程
   */
  async initialize(
    options: InitializationOptions = {}
  ): Promise<InitializationResult> {
    const startTime = performance.now()

    const opts: Required<InitializationOptions> = {
      onInitProgress: () => {},
      ...options
    }

    logger.info('🚀 开始应用初始化...')

    try {
      // 第1步：初始化统一API
      opts.onInitProgress('初始化数据管理器', 20)
      // 统一API自动初始化

      // 第2步：初始化Favicon管理器 (暂时禁用，避免阻塞)
      opts.onInitProgress('跳过图标管理器', 40)
      try {
        logger.info('🎨 Favicon管理器暂时禁用，稍后启用')
        // const { domainFaviconManager } = await import('../services/domain-favicon-manager')
        // await domainFaviconManager.initialize()
      } catch (error) {
        logger.warn('⚠️ Favicon管理器初始化失败:', error)
        // 不阻塞主流程
      }

      // 第3步：确保数据可用（仅检查当前数据量；同步由 SW 负责）
      opts.onInitProgress('检查本地数据', 60)
      await indexedDBManager.initialize()
      const all = await indexedDBManager.getAllBookmarks()
      const totalBookmarks = all.filter(b => !!(b as any).url).length

      // 第4步：验证数据完整性（快速统计）
      opts.onInitProgress('验证数据完整性', 90)
      if (totalBookmarks === 0) {
        logger.warn('⚠️ 数据库为空，等待后台同步或首次导入')
      }

      opts.onInitProgress('初始化完成', 100)

      const initTime = performance.now() - startTime
      logger.info(`✅ 应用初始化完成，耗时: ${initTime.toFixed(2)}ms`)
      logger.info(`📊 数据库状态: ${totalBookmarks} 书签项`)

      return {
        success: true,
        initTime
      }
    } catch (error) {
      const initTime = performance.now() - startTime
      logger.error('❌ 应用初始化失败:', error)

      return {
        success: false,
        error: (error as Error).message,
        initTime
      }
    }
  }

  /**
   * 快速初始化（仅初始化必要组件）
   */
  async quickInitialize(): Promise<InitializationResult> {
    const startTime = performance.now()

    try {
      logger.info('🚀 开始快速初始化...')

      // 统一API自动初始化

      const initTime = performance.now() - startTime
      logger.info(`✅ 快速初始化完成，耗时: ${initTime.toFixed(2)}ms`)

      return {
        success: true,
        initTime
      }
    } catch (error) {
      const initTime = performance.now() - startTime
      logger.error('❌ 快速初始化失败:', error)

      return {
        success: false,
        error: (error as Error).message,
        initTime
      }
    }
  }

  /**
   * 检查初始化状态
   */
  async getInitializationStatus(): Promise<{
    isInitialized: boolean
    hasData: boolean
    dataInfo: {
      bookmarkCount: number
      searchHistoryCount: number
      settingsCount: number
    }
  }> {
    try {
      await indexedDBManager.initialize()
      const all = await indexedDBManager.getAllBookmarks()
      const dbStats = await indexedDBManager.getDatabaseStats()

      return {
        isInitialized: true,
        hasData: (all?.length || 0) > 0,
        dataInfo: {
          bookmarkCount: all?.length || 0,
          searchHistoryCount: dbStats?.searchHistoryCount || 0,
          settingsCount: dbStats?.settingsCount || 0
        }
      }
    } catch (error) {
      logger.warn('获取初始化状态失败:', error)
      return {
        isInitialized: false,
        hasData: false,
        dataInfo: {
          bookmarkCount: 0,
          searchHistoryCount: 0,
          settingsCount: 0
        }
      }
    }
  }
}

// 导出单例实例
export const appInitializer = new AppInitializer()
