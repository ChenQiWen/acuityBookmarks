/**
 * 导航服务
 *
 * 职责：
 * - 管理扩展内页面的导航
 * - 处理侧边栏的打开和关闭
 * - 管理 Chrome 通知的显示和清除
 *
 * 功能：
 * - 打开扩展内页面
 * - 打开侧边栏
 * - 显示系统通知
 * - 清除通知
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 获取扩展内资源的完整URL
 *
 * @param path - 资源路径（相对于扩展根目录）
 * @returns 完整的扩展资源URL
 */
function getExtensionUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return chrome.runtime.getURL?.(normalized) ?? normalized
}

/**
 * 在新标签页中打开扩展内页面
 *
 * @param path - 页面路径
 * @throws 当标签页创建失败时抛出错误
 */
async function openExtensionUrl(path: string): Promise<void> {
  const url = getExtensionUrl(path)
  try {
    await chrome.tabs.create?.({ url, active: true })
  } catch (error) {
    logger.warn('NavigationService', `tabs.create 调用失败: ${url}`, error)
    throw error
  }
}

/**
 * 打开侧边栏
 *
 * 优先使用 Chrome 134+ 的原生 sidePanel API，
 * 降级为在新标签页中打开
 *
 * @throws 当打开失败时抛出错误
 */
async function openSidePanel(): Promise<void> {
  if (chrome.sidePanel?.open) {
    try {
      await chrome.sidePanel.open({
        windowId: chrome.windows.WINDOW_ID_CURRENT
      })
      return
    } catch (error) {
      logger.warn('NavigationService', 'sidePanel.open 调用失败', error)
      throw error
    }
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const activeTabId = tabs[0]?.id
  if (!activeTabId) {
    logger.warn('NavigationService', '无法获取当前标签页 ID')
    return
  }

  const url = getExtensionUrl('side-panel.html')
  try {
    await chrome.tabs.create?.({ url, active: true })
  } catch (error) {
    logger.warn('NavigationService', '创建侧边栏标签失败', error)
    throw error
  }
}

/**
 * 显示 Chrome 系统通知
 *
 * @param options - 通知选项
 * @param options.title - 通知标题
 * @param options.message - 通知内容
 * @param options.iconUrl - 可选的图标URL
 * @returns 通知ID，用于后续清除通知
 */
async function showChromeNotification(options: {
  title: string
  message: string
  iconUrl?: string
}): Promise<string> {
  if (!chrome.notifications?.create) {
    logger.debug('NavigationService', '浏览器不支持 notifications.create')
    return ''
  }

  return await new Promise(resolve => {
    try {
      chrome.notifications.create(
        {
          type: 'basic',
          title: options.title,
          message: options.message,
          iconUrl: options.iconUrl ?? getExtensionUrl('logo.png')
        },
        id => resolve(id ?? '')
      )
    } catch (error) {
      logger.warn('NavigationService', '创建通知失败', error)
      resolve('')
    }
  })
}

/**
 * 清除指定的 Chrome 系统通知
 *
 * @param id - 通知ID
 */
async function clearChromeNotification(id: string): Promise<void> {
  if (!id) return
  if (!chrome.notifications?.clear) {
    logger.debug('NavigationService', '浏览器不支持 notifications.clear')
    return
  }

  await new Promise<void>(resolve => {
    try {
      chrome.notifications.clear(id, () => resolve())
    } catch (error) {
      logger.warn('NavigationService', '清除通知失败', { id, error })
      resolve()
    }
  })
}

/**
 * 导航服务对象
 *
 * 提供扩展内导航和通知功能的统一接口
 */
export const navigationService = {
  openExtensionUrl,
  openSidePanel,
  showChromeNotification,
  clearChromeNotification
}

/**
 * 导航服务类型
 */
export type NavigationService = typeof navigationService
