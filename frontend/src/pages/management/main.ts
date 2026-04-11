import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Management from './Management.vue'
import '@/assets/main.css' // Import shared styles
import '@/assets/fonts.css' // Import font system
import '@/assets/smart-fonts.css' // Import smart font system
import { initializeSmartFonts, fontService } from '@/application/font/font-service'
import { notifyInfo } from '@/application/notification/notification-service'
import { installQueryClient } from '@/infrastructure/query/plugin'
import { initializeChromeMessageBridge } from '@/infrastructure/events/chrome-message-bridge'
import { initCrossPageSync } from '@/composables/useCrossPageSync'
import { logger } from '@/infrastructure/logging/logger'

const app = createApp(Management)
const pinia = createPinia()

app.use(pinia)
installQueryClient(app) // 🆕 安装 TanStack Query
initializeChromeMessageBridge() // 🆕 初始化事件桥接

// 初始化应用
async function initializeApp() {
  fontService.injectDynamicFontLink()
  try {
    // 启动基础字体系统（用户界面语言）
    await initializeSmartFonts()

    // 启动智能字体系统（用户内容自动检测）
    initializeSmartFonts()

    // 字体加载已由 Service Worker 统一预取和缓存，无需页面单独请求

    // 挂载应用
    app.mount('#app')

    // ✅ 初始化跨页面同步（需在 Pinia 安装后调用）
    initCrossPageSync()

    logger.info('Management', 'Init', 'AcuityBookmarks 管理页面启动完成')
    logger.info('Management', 'Font', '智能多语言字体系统已激活')
  } catch (error) {
    logger.error('Management', 'Init', '应用启动失败', error)

    // 即使字体初始化失败，也要启动应用
    app.mount('#app')
  }
}

initializeApp()

// 全局替换无确认弹窗
if (typeof window !== 'undefined') {
  const origAlert = window.alert?.bind(window)
  window.alert = (msg?: string | number | boolean | null | undefined) => {
    try {
      notifyInfo(String(msg))
    } catch {}
    if (import.meta.env.DEV && origAlert) origAlert(msg)
  }
}
