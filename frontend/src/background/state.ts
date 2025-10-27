/**
 * 扩展状态管理模块
 *
 * 负责：
 * 1. 定义 Service Worker 需要持久化的关键状态字段
 * 2. 提供读取与部分更新的便捷方法
 * 3. 统一当前数据库架构版本，方便生命周期逻辑引用
 *
 * 🔴 Session Storage Migration:
 * - `dbReady` 已迁移到 chrome.storage.session（临时运行状态）
 */

import { logger } from '@/infrastructure/logging/logger'
import { storageService } from '@/infrastructure/storage/storage-service'
import { modernStorage } from '@/infrastructure/storage/modern-storage'

/**
 * 本地存储键位常量
 * 使用常量而非字符串字面量，避免各处拼写不一致导致的状态偏差
 */
export const STATE_KEYS = {
  INITIALIZED: 'AB_INITIALIZED',
  SCHEMA_VERSION: 'AB_SCHEMA_VERSION',
  BOOKMARK_COUNT: 'AB_BOOKMARK_COUNT',
  LAST_SYNCED_AT: 'AB_LAST_SYNCED_AT',
  INSTALL_REASON: 'AB_INSTALL_REASON'
} as const

/**
 * Session Storage 键位常量
 */
const SESSION_KEYS = {
  DB_READY: 'ab_db_ready' // 🔴 迁移：数据库就绪状态（会话级别）
} as const

export type StateKey = (typeof STATE_KEYS)[keyof typeof STATE_KEYS]

/**
 * 当前 IndexedDB 架构版本
 * 每次 schema 演进都需要同步更新该常量，以便 onInstalled/onStartup 判定是否需要迁移
 */
export const CURRENT_SCHEMA_VERSION = 9

/**
 * Service Worker 关心的扩展状态结构
 */
export interface ExtensionState {
  initialized: boolean
  dbReady: boolean
  schemaVersion: number
  bookmarkCount: number
  lastSyncedAt: number
  installReason: string | null
}

const DEFAULT_STATE: ExtensionState = {
  initialized: false,
  dbReady: false,
  schemaVersion: 0,
  bookmarkCount: 0,
  lastSyncedAt: 0,
  installReason: null
}

/**
 * 🔴 获取数据库就绪状态（Session Storage）
 *
 * 迁移说明：
 * - dbReady 是临时运行状态，会话结束后应重新检查
 * - 从 chrome.storage.local 迁移到 chrome.storage.session
 */
export async function getDatabaseReady(): Promise<boolean> {
  try {
    const ready = await modernStorage.getSession<boolean>(
      SESSION_KEYS.DB_READY,
      false
    )
    return ready ?? false
  } catch (error) {
    logger.error('BackgroundState', '读取 DB_READY 失败', error)
    return false
  }
}

/**
 * 🔴 设置数据库就绪状态（Session Storage）
 */
export async function setDatabaseReady(ready: boolean): Promise<void> {
  try {
    await modernStorage.setSession(SESSION_KEYS.DB_READY, ready)
    logger.debug('BackgroundState', `DB_READY 已更新: ${ready}`)
  } catch (error) {
    logger.error('BackgroundState', '设置 DB_READY 失败', error)
  }
}

/**
 * 从 chrome.storage.local + session 读取扩展状态
 *
 * ⚠️ dbReady 已迁移到 session storage
 */
export async function getExtensionState(): Promise<ExtensionState> {
  try {
    const raw = await storageService.read(Object.values(STATE_KEYS))

    // 🔴 dbReady 从 session storage 读取
    const dbReady = await getDatabaseReady()

    return {
      initialized: Boolean(raw[STATE_KEYS.INITIALIZED]),
      dbReady, // 从 session storage
      schemaVersion: Number(raw[STATE_KEYS.SCHEMA_VERSION] ?? 0),
      bookmarkCount: Number(raw[STATE_KEYS.BOOKMARK_COUNT] ?? 0),
      lastSyncedAt: Number(raw[STATE_KEYS.LAST_SYNCED_AT] ?? 0),
      installReason:
        typeof raw[STATE_KEYS.INSTALL_REASON] === 'string'
          ? (raw[STATE_KEYS.INSTALL_REASON] as string)
          : null
    }
  } catch (error) {
    logger.error('BackgroundState', '读取扩展状态失败，返回默认值', error)
    return { ...DEFAULT_STATE }
  }
}

/**
 * 更新部分扩展状态字段
 * 仅会写入调用方显式传递的键，避免覆盖其他异步流程正在维护的字段
 *
 * ⚠️ dbReady 已迁移到 session storage，使用 setDatabaseReady()
 */
export async function updateExtensionState(
  updates: Partial<ExtensionState>
): Promise<void> {
  const payload: Partial<Record<StateKey, unknown>> = {}

  if (updates.initialized !== undefined) {
    payload[STATE_KEYS.INITIALIZED] = updates.initialized
  }

  // 🔴 dbReady 写入 session storage
  if (updates.dbReady !== undefined) {
    await setDatabaseReady(updates.dbReady)
  }

  if (updates.schemaVersion !== undefined) {
    payload[STATE_KEYS.SCHEMA_VERSION] = updates.schemaVersion
  }
  if (updates.bookmarkCount !== undefined) {
    payload[STATE_KEYS.BOOKMARK_COUNT] = updates.bookmarkCount
  }
  if (updates.lastSyncedAt !== undefined) {
    payload[STATE_KEYS.LAST_SYNCED_AT] = updates.lastSyncedAt
  }
  if (updates.installReason !== undefined) {
    payload[STATE_KEYS.INSTALL_REASON] = updates.installReason
  }

  if (Object.keys(payload).length === 0) {
    return
  }

  await storageService.write(payload)
  logger.debug('BackgroundState', '扩展状态已更新', payload)
}
