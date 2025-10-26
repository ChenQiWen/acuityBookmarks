/**
 * 数据健康检查客户端
 *
 * 职责：
 * - 为前端页面提供数据健康检查接口
 * - 与 background script 通信执行检查和恢复
 *
 * 使用场景：
 * - 页面加载时自动检查
 * - 用户手动触发检查
 * - 检测到异常时自动恢复
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
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
 * 检查数据健康状态
 *
 * @returns 健康检查结果
 */
export async function checkDataHealth(): Promise<HealthCheckResult | null> {
  try {
    if (!chrome?.runtime?.sendMessage) {
      logger.warn('DataHealthClient', 'Chrome runtime API 不可用')
      return null
    }

    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_DATA_HEALTH'
    })

    if (response?.success) {
      logger.info('DataHealthClient', '健康检查完成', response.result)
      return response.result as HealthCheckResult
    }

    logger.warn('DataHealthClient', '健康检查失败', response)
    return null
  } catch (error) {
    logger.error('DataHealthClient', '健康检查异常', error)
    return null
  }
}

/**
 * 手动触发数据恢复
 *
 * @returns 恢复后的书签数量
 */
export async function recoverData(): Promise<number> {
  try {
    if (!chrome?.runtime?.sendMessage) {
      logger.warn('DataHealthClient', 'Chrome runtime API 不可用')
      return 0
    }

    logger.info('DataHealthClient', '开始手动恢复数据...')

    const response = await chrome.runtime.sendMessage({
      type: 'RECOVER_DATA'
    })

    if (response?.success) {
      logger.info(
        'DataHealthClient',
        '数据恢复完成',
        `恢复了 ${response.bookmarkCount} 条书签`
      )
      return response.bookmarkCount as number
    }

    logger.warn('DataHealthClient', '数据恢复失败', response)
    return 0
  } catch (error) {
    logger.error('DataHealthClient', '数据恢复异常', error)
    return 0
  }
}

/**
 * 自动检查并恢复（如果需要）
 *
 * @returns 是否执行了恢复操作
 */
export async function autoCheckAndRecover(): Promise<boolean> {
  try {
    if (!chrome?.runtime?.sendMessage) {
      logger.warn('DataHealthClient', 'Chrome runtime API 不可用')
      return false
    }

    const response = await chrome.runtime.sendMessage({
      type: 'AUTO_CHECK_AND_RECOVER'
    })

    if (response?.success) {
      const recovered = response.recovered as boolean
      if (recovered) {
        logger.info('DataHealthClient', '检测到数据问题并已自动恢复')
      } else {
        logger.debug('DataHealthClient', '数据健康，无需恢复')
      }
      return recovered
    }

    return false
  } catch (error) {
    logger.error('DataHealthClient', '自动检查与恢复异常', error)
    return false
  }
}

/**
 * 在页面加载时执行健康检查
 *
 * 建议在关键页面（如 Management）的 onMounted 中调用
 *
 * @param options - 配置选项
 * @param options.autoRecover - 是否自动恢复（默认 true）
 * @param options.showNotification - 是否显示通知（默认 false）
 */
export async function checkOnPageLoad(options?: {
  autoRecover?: boolean
  showNotification?: boolean
}): Promise<void> {
  const { autoRecover = true, showNotification = false } = options || {}

  try {
    logger.info('DataHealthClient', '页面加载时检查数据健康...')

    if (autoRecover) {
      const recovered = await autoCheckAndRecover()
      if (recovered && showNotification) {
        // 可以在这里显示恢复成功的通知
        logger.info('DataHealthClient', '✅ 数据已自动恢复')
      }
    } else {
      const result = await checkDataHealth()
      if (result && !result.healthy && showNotification) {
        logger.warn('DataHealthClient', '⚠️ 检测到数据问题', result.issues)
      }
    }
  } catch (error) {
    logger.error('DataHealthClient', '页面加载健康检查失败', error)
  }
}
