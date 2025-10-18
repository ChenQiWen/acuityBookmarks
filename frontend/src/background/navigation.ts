/**
 * 页面导航工具
 *
 * 封装扩展内页面打开逻辑，避免在多个模块中重复字符串拼接。
 */

import { logger } from '@/infrastructure/logging/logger'

export function openManagementPage(): void {
  try {
    const url = chrome.runtime.getURL?.('management.html') ?? 'management.html'
    chrome.tabs.create?.({ url })
  } catch (error) {
    logger.warn('Navigation', '打开书签管理页面失败', error)
  }
}

export function openSettingsPage(): void {
  try {
    const url = chrome.runtime.getURL?.('settings.html') ?? 'settings.html'
    chrome.tabs.create?.({ url })
  } catch (error) {
    logger.warn('Navigation', '打开设置页面失败', error)
  }
}

export function toggleSidePanel(): void {
  try {
    if (chrome.sidePanel?.open) {
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
      return
    }

    chrome.tabs.query?.({ active: true, currentWindow: true }, tabs => {
      const activeTabId = tabs[0]?.id
      if (!activeTabId) return
      const url =
        chrome.runtime.getURL?.('side-panel.html') ?? 'side-panel.html'
      chrome.tabs.create?.({ url })
    })
  } catch (error) {
    logger.warn('Navigation', '切换侧边栏失败', error)
  }
}
