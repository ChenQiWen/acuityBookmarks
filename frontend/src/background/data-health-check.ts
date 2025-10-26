/**
 * 数据健康检查模块
 *
 * 职责：
 * - 定期检查 IndexedDB 数据完整性
 * - 检测数据丢失并自动恢复
 * - 提供手动检查接口
 *
 * 触发场景：
 * - 页面启动时检查
 * - 定期后台检查（可选）
 * - 手动触发检查
 */

import { logger } from '@/infrastructure/logging/logger'
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { getExtensionState, updateExtensionState } from './state'

/**
 * 健康检查结果
 */
interface HealthCheckResult {
  /** 是否健康 */
  healthy: boolean
  /** 书签总数 */
  bookmarkCount: number
  /** 是否需要恢复 */
  needsRecovery: boolean
  /** 问题描述 */
  issues: string[]
}

/**
 * 正在恢复的标志，防止并发恢复
 */
let isRecovering = false

/**
 * 上次检查时间
 */
let lastCheckTime = 0

/**
 * 检查间隔（毫秒）- 避免频繁检查
 */
const CHECK_THROTTLE_MS = 30000 // 30秒

/**
 * 执行数据健康检查
 *
 * @param force - 是否强制检查（忽略节流）
 * @returns 健康检查结果
 */
export async function checkDataHealth(
  force = false
): Promise<HealthCheckResult> {
  const now = Date.now()

  // 节流检查：避免短时间内多次检查
  if (!force && now - lastCheckTime < CHECK_THROTTLE_MS) {
    logger.debug('DataHealthCheck', '跳过检查（节流中）')
    return {
      healthy: true,
      bookmarkCount: 0,
      needsRecovery: false,
      issues: []
    }
  }

  lastCheckTime = now

  const issues: string[] = []
  let bookmarkCount = 0

  try {
    logger.info('DataHealthCheck', '开始数据健康检查...')

    // 1. 检查 IndexedDB 是否可访问
    try {
      await indexedDBManager.initialize()
    } catch (error) {
      issues.push('IndexedDB 初始化失败')
      logger.error('DataHealthCheck', 'IndexedDB 初始化失败', error)
      return {
        healthy: false,
        bookmarkCount: 0,
        needsRecovery: true,
        issues
      }
    }

    // 2. 检查书签数据是否存在
    try {
      const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
      bookmarkCount = rootBookmarks.reduce(
        (sum, node) => sum + (node.bookmarksCount || 0),
        0
      )

      if (bookmarkCount === 0) {
        issues.push('书签数据为空')
        logger.warn('DataHealthCheck', '检测到书签数据为空')
      }
    } catch (error) {
      issues.push('无法读取书签数据')
      logger.error('DataHealthCheck', '读取书签数据失败', error)
      return {
        healthy: false,
        bookmarkCount: 0,
        needsRecovery: true,
        issues
      }
    }

    // 3. 对比扩展状态中的书签数量
    const state = await getExtensionState()
    if (state.bookmarkCount > 0 && bookmarkCount === 0) {
      issues.push(`扩展状态记录有 ${state.bookmarkCount} 条书签，但数据库为空`)
      logger.warn(
        'DataHealthCheck',
        `数据不一致：状态=${state.bookmarkCount}, 实际=${bookmarkCount}`
      )
    }

    // 4. 判断是否需要恢复
    const needsRecovery = bookmarkCount === 0
    const healthy = issues.length === 0

    logger.info('DataHealthCheck', '健康检查完成', {
      healthy,
      bookmarkCount,
      needsRecovery,
      issues: issues.length
    })

    return {
      healthy,
      bookmarkCount,
      needsRecovery,
      issues
    }
  } catch (error) {
    logger.error('DataHealthCheck', '健康检查失败', error)
    return {
      healthy: false,
      bookmarkCount: 0,
      needsRecovery: true,
      issues: ['健康检查异常']
    }
  }
}

/**
 * 执行数据恢复
 *
 * 从 Chrome 书签 API 重新同步所有数据
 *
 * @returns 恢复后的书签数量
 */
export async function recoverData(): Promise<number> {
  // 防止并发恢复
  if (isRecovering) {
    logger.warn('DataHealthCheck', '数据恢复已在进行中，跳过')
    return 0
  }

  isRecovering = true

  try {
    logger.warn('DataHealthCheck', '⚠️ 开始数据恢复流程...')

    // 1. 初始化数据库
    await indexedDBManager.initialize()

    // 2. 从 Chrome API 重新同步所有书签
    await bookmarkSyncService.syncAllBookmarks()

    // 3. 统计恢复后的书签数量
    const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
    const totalBookmarks = rootBookmarks.reduce(
      (sum, node) => sum + (node.bookmarksCount || 0),
      0
    )

    // 4. 更新扩展状态
    await updateExtensionState({
      dbReady: true,
      bookmarkCount: totalBookmarks,
      lastSyncedAt: Date.now()
    })

    logger.info('DataHealthCheck', '✅ 数据恢复完成', { totalBookmarks })

    // 5. 广播恢复完成消息
    chrome.runtime
      .sendMessage({
        type: 'acuity-data-recovered',
        bookmarkCount: totalBookmarks,
        timestamp: Date.now()
      })
      .catch(() => {
        logger.debug('DataHealthCheck', '广播恢复消息失败（可能没有活动页面）')
      })

    return totalBookmarks
  } catch (error) {
    logger.error('DataHealthCheck', '❌ 数据恢复失败', error)
    throw error
  } finally {
    isRecovering = false
  }
}

/**
 * 自动健康检查与恢复
 *
 * 如果检测到数据问题，自动执行恢复
 *
 * @param force - 是否强制检查
 * @returns 是否执行了恢复
 */
export async function autoCheckAndRecover(force = false): Promise<boolean> {
  try {
    const result = await checkDataHealth(force)

    if (result.needsRecovery) {
      logger.warn(
        'DataHealthCheck',
        '检测到数据问题，自动执行恢复',
        result.issues
      )
      await recoverData()
      return true
    }

    return false
  } catch (error) {
    logger.error('DataHealthCheck', '自动检查与恢复失败', error)
    return false
  }
}

/**
 * 启动定期健康检查（可选）
 *
 * @param intervalMs - 检查间隔（毫秒），默认 5 分钟
 */
export function startPeriodicHealthCheck(intervalMs = 5 * 60 * 1000): void {
  logger.info('DataHealthCheck', `启动定期健康检查，间隔：${intervalMs}ms`)

  // 立即执行一次检查
  void autoCheckAndRecover(true)

  // 设置定期检查
  setInterval(() => {
    void autoCheckAndRecover(false)
  }, intervalMs)
}
