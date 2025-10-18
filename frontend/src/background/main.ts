/**
 * Chrome Service Worker 入口
 */

import { registerLifecycleHandlers } from './bootstrap'
import { registerMessageHandlers } from './messaging'
import { registerMenusAndShortcuts } from './menus'
import { registerOmniboxHandlers } from './omnibox'

registerLifecycleHandlers()
registerMessageHandlers()
registerMenusAndShortcuts()
registerOmniboxHandlers()
