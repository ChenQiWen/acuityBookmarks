/**
 * Chrome Service Worker 入口
 */

import { registerLifecycleHandlers } from './bootstrap'
import { registerMessageHandlers } from './messaging'
import { registerMenusAndShortcuts } from './menus'
import { registerOmniboxHandlers } from './omnibox'
import { registerBookmarkChangeListeners } from './bookmarks'
import {
  startPeriodicHealthCheck,
  registerHealthCheckAlarmListener
} from './data-health-check'
import { backgroundCrawlerManager } from './crawler-manager'

registerLifecycleHandlers()
registerMessageHandlers()
registerMenusAndShortcuts()
registerOmniboxHandlers()
registerBookmarkChangeListeners()

// 注册健康检查 alarm 监听器（必须先注册）
registerHealthCheckAlarmListener()

// 启动定期健康检查（每 5 分钟检查一次）
startPeriodicHealthCheck(5)

// 初始化后台爬取管理器（自动注册 alarm 和消息监听器）
// 这样爬取任务就可以在 Service Worker 后台持续运行
// 不依赖前端页面是否打开
void backgroundCrawlerManager
