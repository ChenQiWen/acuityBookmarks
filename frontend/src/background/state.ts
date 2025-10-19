/**
 * 扩展状态管理模块
 *
 * 负责：
 * 1. 定义 Service Worker 需要持久化的关键状态字段
 * 2. 提供读取与部分更新的便捷方法
 * 3. 统一当前数据库架构版本，方便生命周期逻辑引用
 */

import { logger } from '@/infrastructure/logging/logger'
import { storageService } from '@/infrastructure/storage/storage-service'

/**
 * 本地存储键位常量
 * 使用常量而非字符串字面量，避免各处拼写不一致导致的状态偏差
 */
export const STATE_KEYS = {
  INITIALIZED: 'AB_INITIALIZED',
  DB_READY: 'AB_DB_READY',
  SCHEMA_VERSION: 'AB_SCHEMA_VERSION',
  BOOKMARK_COUNT: 'AB_BOOKMARK_COUNT',
  LAST_SYNCED_AT: 'AB_LAST_SYNCED_AT',
  INSTALL_REASON: 'AB_INSTALL_REASON'
} as const

export type StateKey = (typeof STATE_KEYS)[keyof typeof STATE_KEYS]

/**
 * 当前 IndexedDB 架构版本
 * 每次 schema 演进都需要同步更新该常量，以便 onInstalled/onStartup 判定是否需要迁移
 */
export const CURRENT_SCHEMA_VERSION = 8

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
 * 从 chrome.storage.local 读取扩展状态
 */
export async function getExtensionState(): Promise<ExtensionState> {
  try {
    const raw = await storageService.read(Object.values(STATE_KEYS))
    return {
      initialized: Boolean(raw[STATE_KEYS.INITIALIZED]),
      dbReady: Boolean(raw[STATE_KEYS.DB_READY]),
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
 */
export async function updateExtensionState(
  updates: Partial<ExtensionState>
): Promise<void> {
  const payload: Partial<Record<StateKey, unknown>> = {}

  if (updates.initialized !== undefined) {
    payload[STATE_KEYS.INITIALIZED] = updates.initialized
  }
  if (updates.dbReady !== undefined) {
    payload[STATE_KEYS.DB_READY] = updates.dbReady
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
