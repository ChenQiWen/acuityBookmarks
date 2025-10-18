/**
 * 上下文菜单与快捷键注册
 */

import { logger } from '@/infrastructure/logging/logger'
import {
  openManagementPage,
  openSettingsPage,
  toggleSidePanel
} from './navigation'

export function registerMenusAndShortcuts(): void {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.contextMenus?.removeAll?.(() => {
        chrome.contextMenus?.create?.({
          id: 'ab-open-management',
          title: '打开书签管理',
          contexts: ['action']
        })
        chrome.contextMenus?.create?.({
          id: 'ab-open-settings',
          title: '打开设置',
          contexts: ['action']
        })
      })
    } catch (error) {
      logger.warn('Menus', '创建上下文菜单失败', error)
    }
  })

  chrome.contextMenus?.onClicked?.addListener(info => {
    if (info.menuItemId === 'ab-open-management') {
      openManagementPage()
      return
    }
    if (info.menuItemId === 'ab-open-settings') {
      openSettingsPage()
    }
  })

  chrome.commands?.onCommand?.addListener(command => {
    switch (command) {
      case 'open-management':
        openManagementPage()
        break
      case 'open-settings':
        openSettingsPage()
        break
      case 'open-side-panel':
        toggleSidePanel()
        break
      default:
        logger.debug('Menus', '收到未知快捷键命令', command)
    }
  })
}
