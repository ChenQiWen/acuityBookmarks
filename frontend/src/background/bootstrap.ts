/**
 * 背景脚本生命周期管理
 *
 * 负责响应 chrome.runtime.onInstalled、onStartup 等事件，
 * 根据当前扩展状态执行首次安装、架构升级、数据恢复等流程。
 */

import { logger } from '@/infrastructure/logging/logger'
import type { ExtensionState } from './state'
import {
  CURRENT_SCHEMA_VERSION,
  getExtensionState,
  updateExtensionState
} from './state'
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { crawlMultipleBookmarks } from '@/services/local-bookmark-crawler'
import { CRAWLER_CONFIG } from '@/config/constants'
import { showSystemNotification } from './notification'

/**
 * 首次安装流程处理
 *
 * 执行步骤：
 * 1. 打开引导页
 * 2. 初始化 IndexedDB
 * 3. 同步所有书签（同时广播进度）
 * 4. 更新扩展状态
 *
 * @param reason - 安装原因（install/update等）
 */
async function handleFirstInstall(reason: string): Promise<void> {
  logger.info('Bootstrap', '首次安装：开始全量同步')

  // 1. 打开引导页
  chrome.tabs.create({ url: 'onboarding.html' })

  // 2. 监听并广播进度
  // 注意：这里的 unsubscribe 需要在同步完成后调用
  const unsubscribe = bookmarkSyncService.onProgress(progress => {
    // 广播进度给前端页面（引导页）
    chrome.runtime
      .sendMessage({
        type: 'acuity-bookmarks-sync-progress',
        data: progress
      })
      .catch(() => {
        // 忽略错误（例如没有页面在监听）
      })
  })

  try {
    await indexedDBManager.initialize()
    await bookmarkSyncService.syncAllBookmarks()

    const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
    const totalBookmarks = rootBookmarks.reduce(
      (sum: number, node: BookmarkRecord) => sum + (node.bookmarksCount || 0),
      0
    )

    await updateExtensionState({
      initialized: true,
      dbReady: true,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      bookmarkCount: totalBookmarks,
      lastSyncedAt: Date.now(),
      installReason: reason
    })

    logger.info('Bootstrap', '首次安装完成', { totalBookmarks })

    // ✅ 初始化爬取：爬取所有已有书签（异步执行，不阻塞安装流程）
    // 只在配置启用时执行自动爬取
    if (CRAWLER_CONFIG.AUTO_CRAWL_ON_STARTUP) {
      logger.info('Bootstrap', '🚀 开始初始化爬取已有书签...')
      initializeCrawlForExistingBookmarks().catch(err => {
        logger.warn('Bootstrap', '初始化爬取失败（非致命）', err)
      })
    } else {
      logger.info(
        'Bootstrap',
        '⏸️ 自动爬取已禁用（设置 VITE_CRAWLER_AUTO_STARTUP=true 启用）'
      )
    }
  } finally {
    unsubscribe()
  }
}

/**
 * 架构升级流程处理
 *
 * 当检测到 schema 版本更新时执行升级操作
 *
 * @param state - 当前扩展状态
 */
async function handleSchemaUpgrade(state: ExtensionState): Promise<void> {
  logger.info(
    'Bootstrap',
    `架构升级：v${state.schemaVersion} → v${CURRENT_SCHEMA_VERSION}`
  )

  // ✅ 直接执行升级操作，移除无意义的固定延迟
  await indexedDBManager.initialize()

  const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
  let totalBookmarks = rootBookmarks.reduce(
    (sum: number, node: BookmarkRecord) => sum + (node.bookmarksCount || 0),
    0
  )

  if (totalBookmarks === 0) {
    logger.warn('Bootstrap', '升级后书签为空，执行全量重建')
    await bookmarkSyncService.syncAllBookmarks()
    const refreshed = await bookmarkSyncService.getRootBookmarks()
    totalBookmarks = refreshed.reduce(
      (sum: number, node: BookmarkRecord) => sum + (node.bookmarksCount || 0),
      0
    )
  }

  await updateExtensionState({
    dbReady: true,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    bookmarkCount: totalBookmarks,
    lastSyncedAt: Date.now()
  })

  logger.info('Bootstrap', '架构升级完成', { totalBookmarks })
}

/**
 * 数据丢失恢复流程
 *
 * 当检测到书签数据丢失时，重新同步所有书签
 */
async function handleDataRecovery(): Promise<void> {
  logger.warn('Bootstrap', '检测到数据丢失，重新同步')

  // ✅ 直接执行恢复操作，移除无意义的固定延迟
  await indexedDBManager.initialize()
  await bookmarkSyncService.syncAllBookmarks()

  const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
  const totalBookmarks = rootBookmarks.reduce(
    (sum: number, node: BookmarkRecord) => sum + (node.bookmarksCount || 0),
    0
  )

  await updateExtensionState({
    dbReady: true,
    bookmarkCount: totalBookmarks,
    lastSyncedAt: Date.now()
  })

  logger.info('Bootstrap', '数据恢复完成', { totalBookmarks })
}

/**
 * 初始化爬取所有已有书签
 *
 * 在首次安装时，爬取所有已有书签的元数据
 */
async function initializeCrawlForExistingBookmarks(): Promise<void> {
  try {
    await indexedDBManager.initialize()

    // 获取所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()

    // 过滤出有 URL 的书签（排除文件夹）
    const bookmarksToCrawl = allBookmarks.filter(
      bookmark => bookmark.url && !bookmark.url.startsWith('chrome://')
    )

    if (bookmarksToCrawl.length === 0) {
      logger.info('Bootstrap', '没有需要爬取的书签')
      return
    }

    logger.info(
      'Bootstrap',
      `准备爬取 ${bookmarksToCrawl.length} 个书签的元数据...`
    )

    // 转换为 Chrome 书签格式
    const chromeBookmarks: chrome.bookmarks.BookmarkTreeNode[] =
      bookmarksToCrawl.map(b => ({
        id: b.id,
        title: b.title,
        url: b.url!,
        dateAdded: b.dateAdded,
        parentId: b.parentId,
        index: b.index,
        syncing: false // Chrome API 需要的字段
      }))

    // 批量爬取（跳过已有元数据的书签，避免重复爬取）
    await crawlMultipleBookmarks(chromeBookmarks, {
      skipExisting: true, // 跳过已有元数据的书签
      respectRobots: true,
      priority: 'normal',
      onComplete: async (stats) => {
        // ✅ 爬取完成，发送通知
        const total = stats.total
        const completed = stats.completed
        const failed = stats.failed
        const successRate =
          total > 0 ? Math.round((completed / total) * 100) : 0

        let message = `已完成 ${completed} 个书签的元数据爬取`
        if (failed > 0) {
          message += `，失败 ${failed} 个`
        }
        message += `（成功率 ${successRate}%）`

        // 发送系统通知
        await showSystemNotification(message, {
          title: '书签元数据爬取完成'
        })

        logger.info('Bootstrap', `✅ 爬取完成: ${message}`, stats)
      }
    })

    logger.info(
      'Bootstrap',
      `✅ 初始化爬取任务已启动（${bookmarksToCrawl.length} 个书签）`
    )
  } catch (error) {
    logger.error('Bootstrap', '初始化爬取失败', error)
    throw error
  }
}

/**
 * 常规重新加载流程
 *
 * 处理扩展的正常重新加载（如用户手动重载扩展）
 *
 * @param reason - 重载原因
 */
async function handleRegularReload(reason: string): Promise<void> {
  logger.info('Bootstrap', '正常重新加载，标记 DB 已就绪')
  await updateExtensionState({ dbReady: true, installReason: reason })

  // ✅ 如果 crawlMetadata 为空，初始化爬取所有书签（仅在配置启用时）
  if (CRAWLER_CONFIG.AUTO_CRAWL_ON_RELOAD) {
    try {
      await indexedDBManager.initialize()
      const allCrawlMetadata = await indexedDBManager.getAllCrawlMetadata()

      if (allCrawlMetadata.length === 0) {
        logger.info('Bootstrap', '检测到 crawlMetadata 为空，开始初始化爬取...')
        initializeCrawlForExistingBookmarks().catch(err => {
          logger.warn('Bootstrap', '重载时初始化爬取失败（非致命）', err)
        })
      } else {
        logger.debug(
          'Bootstrap',
          `crawlMetadata 已有 ${allCrawlMetadata.length} 条记录，跳过初始化爬取`
        )
      }
    } catch (error) {
      logger.warn('Bootstrap', '检查 crawlMetadata 失败（非致命）', error)
    }
  } else {
    logger.debug(
      'Bootstrap',
      '⏸️ 重载时自动爬取已禁用（设置 VITE_CRAWLER_AUTO_RELOAD=true 启用）'
    )
  }
  
  // ✅ 同步收藏书签数据（IndexedDB ↔ chrome.storage.local）
  try {
    const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')
    await favoriteAppService.syncFavoriteData()
  } catch (error) {
    logger.warn('Bootstrap', '同步收藏数据失败（非致命错误）', error)
  }
}

/**
 * 注册生命周期事件处理器
 *
 * 监听 chrome.runtime 的生命周期事件：
 * - onInstalled: 首次安装、更新、重载
 * - onStartup: 浏览器启动
 *
 * 根据不同情况执行相应的初始化流程
 */
export function registerLifecycleHandlers(): void {
  chrome.runtime.onInstalled.addListener(async details => {
    try {
      const reason = details.reason || 'unknown'
      const state = await getExtensionState()

      if (!state.initialized) {
        await handleFirstInstall(reason)
        return
      }

      if (state.schemaVersion < CURRENT_SCHEMA_VERSION) {
        await handleSchemaUpgrade(state)
        return
      }

      if (state.bookmarkCount === 0) {
        await handleDataRecovery()
        return
      }

      await handleRegularReload(reason)
    } catch (error) {
      logger.error('Bootstrap', 'onInstalled 流程失败', error)
    }
  })

  chrome.runtime.onStartup?.addListener(async () => {
    try {
      logger.info('Bootstrap', '浏览器启动：进行幂等同步')
      await bookmarkSyncService.syncAllBookmarks()
      
      // ✅ 同步收藏书签数据（IndexedDB ↔ chrome.storage.local）
      const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')
      await favoriteAppService.syncFavoriteData()
    } catch (error) {
      logger.warn('Bootstrap', '浏览器启动同步失败', error)
    }
  })
}
