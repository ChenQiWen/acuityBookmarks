import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './Onboarding.vue'
import '@/design-system/tokens.css'
import '@/design-system/typography.css'
import '@/design-system/base.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { initializeSmartFonts, fontService } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import Icon from '@/components/base/Icon/Icon.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
// eslint-disable-next-line vue/multi-word-component-names
app.component('Icon', Icon)

async function initializeOnboarding() {
  fontService.injectDynamicFontLink()
  try {
    await initializeSmartFonts()
    app.mount('#app')
    logger.info('Onboarding', '🎉 引导页启动完成')
  } catch (error) {
    logger.error('Onboarding', '❌ 引导页启动失败:', error)
    app.mount('#app')
  }
}

initializeOnboarding()
