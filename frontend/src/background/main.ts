/**
 * Chrome Service Worker 入口
 */

import { registerLifecycleHandlers } from './bootstrap'
import { registerMessageHandlers } from './messaging'
import { registerMenusAndShortcuts } from './menus'
import { registerOmniboxHandlers } from './omnibox'
import { registerBookmarkChangeListeners } from './bookmarks'
import { startPeriodicHealthCheck } from './data-health-check'

registerLifecycleHandlers()
registerMessageHandlers()
registerMenusAndShortcuts()
registerOmniboxHandlers()
registerBookmarkChangeListeners()

// 启动定期健康检查（每 5 分钟检查一次）
startPeriodicHealthCheck(5 * 60 * 1000)
