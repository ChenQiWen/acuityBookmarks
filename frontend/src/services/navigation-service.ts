import { logger } from '@/infrastructure/logging/logger'

function getExtensionUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return chrome.runtime.getURL?.(normalized) ?? normalized
}

async function openExtensionUrl(path: string): Promise<void> {
  const url = getExtensionUrl(path)
  try {
    await chrome.tabs.create?.({ url, active: true })
  } catch (error) {
    logger.warn('NavigationService', `tabs.create 调用失败: ${url}`, error)
    throw error
  }
}

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

export const navigationService = {
  openExtensionUrl,
  openSidePanel,
  showChromeNotification,
  clearChromeNotification
}

export type NavigationService = typeof navigationService
