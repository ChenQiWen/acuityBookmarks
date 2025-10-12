import { injectDynamicFontLink } from '@/application'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Popup from './Popup.vue'
import '@/design-system/tokens.css'
import '@/design-system/base.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { initializeSmartFonts } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import { notifyInfo } from '@/application/notification/notification-service'
// import { loadFontForLanguage } from '@/utils/fontLoader';
// 使用CDN加载Material Design Icons，减少扩展包大小
// import '@mdi/font/css/materialdesignicons.css'

const app = createApp(Popup)
const pinia = createPinia()

app.use(pinia)

// 初始化Popup应用
async function initializePopup() {
  injectDynamicFontLink()
  try {
    // 启动基础字体系统（用户界面语言）
    await initializeSmartFonts()

    // 启动智能字体系统（用户内容自动检测）
    initializeSmartFonts()

    // 字体加载已由 Service Worker 统一预取和缓存，无需页面单独请求

    // 挂载应用
    app.mount('#app')

    logger.info('Popup', '🎉 AcuityBookmarks Popup 启动完成')
    logger.info('Popup', '🧠 智能多语言字体系统已激活')
  } catch (error) {
    logger.error('Popup', '❌ Popup启动失败:', error)

    // 即使字体初始化失败，也要启动应用
    app.mount('#app')
  }
}

initializePopup()

// 全局替换无确认弹窗
// 仅限无需确认的提示，尽量不要用于错误阻断流程
if (typeof window !== 'undefined') {
  const origAlert = window.alert?.bind(window)
  window.alert = (msg?: string | number | boolean | null | undefined) => {
    try {
      notifyInfo(String(msg))
    } catch {
      /* ignore */
    }
    if (import.meta.env.DEV && origAlert) origAlert(msg)
  }
}
