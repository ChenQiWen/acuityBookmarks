/**
 * Chrome Service Worker 入口
 */

import { logger } from '@/infrastructure/logging/logger'
import { registerLifecycleHandlers } from './bootstrap'
import { registerMessageHandlers } from './messaging'
import { registerMenusAndShortcuts } from './menus'
import { registerOmniboxHandlers } from './omnibox'
import { registerBookmarkChangeListeners } from './bookmarks'
import { backgroundCrawlerManager } from './crawler-manager'
import { initializeBookmarkTraitAutoSync } from '@/services/bookmark-trait-auto-sync'

// ✅ 注册所有 background 功能
try {
  logger.info('Background', '🚀 开始初始化 background script...')

  registerLifecycleHandlers()
  registerMessageHandlers()
  registerMenusAndShortcuts()
  registerOmniboxHandlers()
  registerBookmarkChangeListeners()
  
  // ✅ 初始化书签特征自动同步服务
  // 监听全量同步和爬虫完成事件，自动触发特征检测
  initializeBookmarkTraitAutoSync()

  logger.info('Background', '✅ Background script 初始化完成')
} catch (error) {
  logger.error('Background', '❌ Background script 初始化失败', error)
  throw error
}

// 初始化后台爬取管理器（自动注册 alarm 和消息监听器）
// 这样爬取任务就可以在 Service Worker 后台持续运行
// 不依赖前端页面是否打开
void backgroundCrawlerManager
