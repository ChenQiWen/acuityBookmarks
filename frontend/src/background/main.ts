/**
 * Chrome Service Worker 入口
 */

import { registerLifecycleHandlers } from './bootstrap'
import { registerMessageHandlers } from './messaging'
import { registerMenusAndShortcuts } from './menus'
import { registerOmniboxHandlers } from './omnibox'
import { registerBookmarkChangeListeners } from './bookmarks'
import { runHealthCheckOnDemand } from './data-health-check'
import { backgroundCrawlerManager } from './crawler-manager'

registerLifecycleHandlers()
registerMessageHandlers()
registerMenusAndShortcuts()
registerOmniboxHandlers()
registerBookmarkChangeListeners()

// ✅ 优化：按需健康检查（仅在 Service Worker 启动时执行一次）
// 移除周期性检查，避免浪费资源和误触发同步
runHealthCheckOnDemand(true)

// 初始化后台爬取管理器（自动注册 alarm 和消息监听器）
// 这样爬取任务就可以在 Service Worker 后台持续运行
// 不依赖前端页面是否打开
void backgroundCrawlerManager
