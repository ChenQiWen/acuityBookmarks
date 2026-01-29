import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SidePanel from './SidePanel.vue'
import '@/design-system/tokens.css'
import '@/design-system/typography.css'
import '@/design-system/base.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { initializeSmartFonts, fontService } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import { notifyInfo } from '@/application/notification/notification-service'
import { initializeChromeMessageBridge } from '@/infrastructure/events/chrome-message-bridge'
import { initCrossPageSync } from '@/composables/useCrossPageSync'

console.log('🔍 测试 7: 恢复完整的初始化逻辑')

const app = createApp(SidePanel)
const pinia = createPinia()

app.use(pinia)
initializeChromeMessageBridge() // 书签变更事件桥接（data:synced 等）

// 初始化Side Panel应用
async function initializeSidePanel() {
  fontService.injectDynamicFontLink()
  try {
    // 启动基础字体系统
    await initializeSmartFonts()

    // 字体加载已由 Service Worker 统一预取和缓存，无需页面单独请求

    // 挂载应用
    app.mount('#app')

    // ✅ 初始化跨页面同步（需在 Pinia 安装后调用）
    initCrossPageSync()

    logger.info('SidePanel', '🎉 AcuityBookmarks Side Panel 启动完成')
    logger.info('SidePanel', '📌 侧边栏模式已激活')
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ Side Panel启动失败', error)

    // 即使初始化失败，也要启动应用
    app.mount('#app')
  }
}

initializeSidePanel()

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
