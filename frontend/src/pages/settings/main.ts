import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './Settings.vue'
import ThemeToggle from '@/components/composite/ThemeToggle/ThemeToggle.vue'
import '@/assets/main.css' // Import shared styles
import '@/assets/fonts.css' // Import font system
import '@/assets/smart-fonts.css' // Import smart font system
import { logger } from '@/infrastructure/logging/logger'

logger.info('Settings', 'Init', '开始初始化应用...')

try {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  // 旧 Icon 组件已移除，使用 LucideIcon 替代
  app.component('ThemeToggle', ThemeToggle)

  // 全局错误处理
  app.config.errorHandler = (err, instance, info) => {
    logger.error('Settings', 'Vue', 'Vue错误', { err, info, instance })
  }

  // 全局警告处理
  app.config.warnHandler = (msg, _instance, trace) => {
    logger.warn('Settings', 'Vue', 'Vue警告', { msg, trace })
  }

  logger.info('Settings', 'Mount', '挂载应用到 #app...')
  app.mount('#app')
  logger.info('Settings', 'Mount', '应用挂载成功')
} catch (error) {
  logger.error('Settings', 'Init', '应用初始化失败', error)
}
