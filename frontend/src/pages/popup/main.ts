import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import Popup from './Popup.vue'
// 样式导入（main.css 已包含完整设计系统：layers + tokens + typography + base + utilities）
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { initializeSmartFonts, fontService } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import { notifyInfo } from '@/application/notification/notification-service'
import { initCrossPageSync } from '@/composables/useCrossPageSync'

/**
 * Popup 页面根应用实例。
 */
const app = createApp(Popup)
/**
 * Popup 页面使用的 Pinia 实例。
 */
const pinia = createPinia()

app.use(pinia)
app.use(VueQueryPlugin)
// 旧 Icon 组件已移除，使用 LucideIcon 替代

/**
 * 初始化并挂载 Popup 应用，确保字体资源加载完成。
 */
async function initializePopup(): Promise<void> {
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
