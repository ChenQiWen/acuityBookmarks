/**
 * 上下文菜单与快捷键注册
 *
 * 职责：
 * - 注册扩展图标的右键菜单
 * - 处理菜单点击事件
 * - 注册键盘快捷键
 * - 处理快捷键命令
 *
 * 功能：
 * - 提供快速访问书签管理页面的菜单
 * - 提供快速访问设置页面的菜单
 * - 支持键盘快捷键操作
 */

import { logger } from '@/infrastructure/logging/logger'
import { openManagementPage, openSettingsPage } from './navigation'

/**
 * 注册上下文菜单和快捷键
 *
 * 在扩展安装时创建菜单项，并注册相应的事件监听器
 */
export function registerMenusAndShortcuts(): void {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.contextMenus?.removeAll?.(() => {
        // 扩展图标右键菜单
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

        // 页面右键菜单 - 添加书签
        chrome.contextMenus?.create?.({
          id: 'ab-add-bookmark',
          title: '添加到书签...',
          contexts: ['page', 'link']
        })
      })
    } catch (error) {
      logger.warn('Menus', '创建上下文菜单失败', error)
    }
  })

  chrome.contextMenus?.onClicked?.addListener(async (info, tab) => {
    if (info.menuItemId === 'ab-open-management') {
      openManagementPage()
      return
    }
    if (info.menuItemId === 'ab-open-settings') {
      openSettingsPage()
      return
    }
    if (info.menuItemId === 'ab-add-bookmark') {
      await handleQuickAddBookmark(tab, info.linkUrl)
    }
  })

  chrome.commands?.onCommand?.addListener(async command => {
    logger.info('Menus', '收到快捷键命令', { command })

    switch (command) {
      case 'open-management':
        openManagementPage()
        break
      case 'open-settings':
        openSettingsPage()
        break
      case 'quick-add-bookmark':
        {
          logger.info('Menus', '🎯 触发快速添加书签快捷键')
          // 获取当前活动标签页
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (activeTab) {
            logger.info('Menus', '找到活动标签页', {
              url: activeTab.url,
              title: activeTab.title
            })
            await handleQuickAddBookmark(activeTab)
          } else {
            logger.warn('Menus', '未找到活动标签页')
          }
        }
        break
      default:
        logger.debug('Menus', '收到未知快捷键命令', command)
    }
  })
}

/**
 * 处理快速添加书签
 *
 * @param tab - 当前标签页信息
 * @param linkUrl - 如果是右键链接触发，这是链接 URL
 */
async function handleQuickAddBookmark(
  tab: chrome.tabs.Tab | undefined,
  linkUrl?: string
): Promise<void> {
  if (!tab) {
    logger.warn('Menus', '无法获取当前标签页')
    return
  }

  try {
    // 准备书签数据
    const bookmarkData = {
      title: tab.title || '未命名书签',
      url: linkUrl || tab.url || '',
      favIconUrl: tab.favIconUrl
    }

    // ✅ 验证 URL
    if (!bookmarkData.url || bookmarkData.url.trim() === '') {
      logger.error('Menus', 'URL 为空，无法添加书签', bookmarkData)
      return
    }

    logger.info('Menus', '触发快速添加书签', bookmarkData)

    // ✅ 方案：注入 content script 在页面内显示对话框（模拟 Chrome 原生样式）
    try {
      // 注入 content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        files: ['content/inject-quick-add-dialog.js']
      })

      // 发送消息显示对话框
      await chrome.tabs.sendMessage(tab.id!, {
        type: 'SHOW_QUICK_ADD_DIALOG',
        data: bookmarkData
      })
    } catch (error) {
      logger.error('Menus', '注入 content script 失败', error)
      // Fallback: 如果注入失败，使用原来的窗口方式
      logger.warn('Menus', '降级到窗口方式')
      await chrome.windows.create({
        url: `popup.html?action=add-bookmark&title=${encodeURIComponent(bookmarkData.title)}&url=${encodeURIComponent(bookmarkData.url)}&favIconUrl=${encodeURIComponent(bookmarkData.favIconUrl || '')}`,
        type: 'popup',
        width: 480,
        height: 360,
        focused: true
      })
    }
  } catch (error) {
    logger.error('Menus', '处理添加书签失败', error)
  }
}
