import { logger } from './frontend/scripts/logger.cjs'
import { openManagementPage, openSettingsPage } from './background.js'

function createContextMenus() {
  try {
    logger.info('ServiceWorker', '🎯 [Service Worker] 创建上下文菜单...')

    // 清除现有菜单项（如果有的话）
    chrome.contextMenus.removeAll()

    // 创建主菜单项 - 切换侧边栏
    chrome.contextMenus.create({
      id: 'toggle-sidepanel',
      title: '📋 切换书签侧边栏',
      contexts: ['page', 'selection', 'link', 'image']
    })

    // 创建分隔符
    chrome.contextMenus.create({
      id: 'separator-1',
      type: 'separator',
      contexts: ['page', 'selection', 'link', 'image']
    })

    // 创建其他书签功能菜单
    chrome.contextMenus.create({
      id: 'open-management',
      title: '🔧 管理书签',
      contexts: ['page', 'selection', 'link', 'image']
    })

    chrome.contextMenus.create({
      id: 'open-settings',
      title: '⚙️ 设置',
      contexts: ['page', 'selection', 'link', 'image']
    })

    // 解析当前页元数据
    chrome.contextMenus.create({
      id: 'extract-page-meta',
      title: '🧩 解析当前页元数据',
      contexts: ['page']
    })

    logger.info('ServiceWorker', '✅ [Service Worker] 上下文菜单创建完成')
  } catch (error) {
    logger.error(
      'ServiceWorker',
      '❌ [Service Worker] 创建上下文菜单失败:',
      error
    )
  }
}

chrome.contextMenus.onClicked.addListener(async info => {
  try {
    logger.info(
      'ServiceWorker',
      `🎯 [Service Worker] 上下文菜单点击:`,
      info.menuItemId
    )

    switch (info.menuItemId) {
      case 'toggle-sidepanel':
        // 🎯 右键菜单侧边栏切换 - 发送消息给 background.js 处理
        logger.info('ServiceWorker', '📋 [右键菜单] 请求切换侧边栏...')
        chrome.runtime.sendMessage({ type: 'TOGGLE_SIDEBAR' })
        break

      case 'open-management':
        await openManagementPage()
        break

      case 'open-settings':
        await openSettingsPage()
        break

      default:
        logger.warn(
          'ServiceWorker',
          `⚠️ [Service Worker] 未知菜单项: ${info.menuItemId}`
        )
    }
  } catch (error) {
    logger.error(
      'ServiceWorker',
      '❌ [Service Worker] 处理上下文菜单点击失败:',
      error
    )

    chrome.notifications.create('contextMenuError', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: 'AcuityBookmarks',
      message: `操作失败: ${error.message}`
    })
  }
})

export function initializeContextMenus() {
  createContextMenus()
}
