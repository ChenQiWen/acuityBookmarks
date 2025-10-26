import { injectDynamicFontLink } from '@/application'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Popup from './Popup.vue'
// Popup 专属样式已在 popup.html 中通过 link 标签引入
import '@/design-system/tokens.css'
import '@/design-system/typography.css'
import '@/design-system/base.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { initializeSmartFonts } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import { notifyInfo } from '@/application/notification/notification-service'
import Icon from '@/components/base/Icon/Icon.vue'

/**
 * Popup 页面根应用实例。
 */
const app = createApp(Popup)
/**
 * Popup 页面使用的 Pinia 实例。
 */
const pinia = createPinia()

app.use(pinia)
// eslint-disable-next-line vue/multi-word-component-names
app.component('Icon', Icon)

/**
 * 初始化并挂载 Popup 应用，确保字体资源加载完成。
 */
async function initializePopup(): Promise<void> {
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
