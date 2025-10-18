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

/**
 * 注入原生 alert 提示（开发阶段通知用户安装/同步状态）
 */
async function injectAlert(message: string): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTabId = tabs[0]?.id
    if (!activeTabId) return
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: msg => {
        alert(msg)
      },
      args: [message]
    })
  } catch (error) {
    logger.warn('Bootstrap', '注入安装提示失败', error)
  }
}

/**
 * 首次安装流程
 */
async function handleFirstInstall(reason: string): Promise<void> {
  logger.info('Bootstrap', '首次安装：开始全量同步')

  await new Promise(resolve => setTimeout(resolve, 500))
  await injectAlert('AcuityBookmarks：首次安装，正在同步书签...')

  await indexedDBManager.initialize()
  await bookmarkSyncService.syncAllBookmarks()

  const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
  const totalBookmarks = rootBookmarks.reduce(
    (sum, node) => sum + (node.bookmarksCount || 0),
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
  await injectAlert(`AcuityBookmarks：同步完成 (${totalBookmarks} 条书签)`)
}

/**
 * 架构升级流程
 */
async function handleSchemaUpgrade(state: ExtensionState): Promise<void> {
  logger.info(
    'Bootstrap',
    `架构升级：v${state.schemaVersion} → v${CURRENT_SCHEMA_VERSION}`
  )

  await new Promise(resolve => setTimeout(resolve, 1000))
  await indexedDBManager.initialize()

  const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
  let totalBookmarks = rootBookmarks.reduce(
    (sum, node) => sum + (node.bookmarksCount || 0),
    0
  )

  if (totalBookmarks === 0) {
    logger.warn('Bootstrap', '升级后书签为空，执行全量重建')
    await bookmarkSyncService.syncAllBookmarks()
    const refreshed = await bookmarkSyncService.getRootBookmarks()
    totalBookmarks = refreshed.reduce(
      (sum, node) => sum + (node.bookmarksCount || 0),
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
 */
async function handleDataRecovery(): Promise<void> {
  logger.warn('Bootstrap', '检测到数据丢失，重新同步')

  await new Promise(resolve => setTimeout(resolve, 1000))
  await indexedDBManager.initialize()
  await bookmarkSyncService.syncAllBookmarks()

  const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
  const totalBookmarks = rootBookmarks.reduce(
    (sum, node) => sum + (node.bookmarksCount || 0),
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
 * 常规重新加载路径
 */
async function handleRegularReload(reason: string): Promise<void> {
  logger.info('Bootstrap', '正常重新加载，标记 DB 已就绪')
  await updateExtensionState({ dbReady: true, installReason: reason })
}

/**
 * 注册生命周期事件处理
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
      await injectAlert('AcuityBookmarks：初始化失败，请查看扩展控制台')
    }
  })

  chrome.runtime.onStartup?.addListener(async () => {
    try {
      logger.info('Bootstrap', '浏览器启动：进行幂等同步')
      await bookmarkSyncService.syncAllBookmarks()
    } catch (error) {
      logger.warn('Bootstrap', '浏览器启动同步失败', error)
    }
  })
}
