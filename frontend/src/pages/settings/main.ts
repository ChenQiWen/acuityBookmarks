import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './settings-app.vue'
import Icon from '@/components/base/Icon/Icon.vue'
import ThemeToggle from '@/components/base/ThemeToggle/ThemeToggle.vue'

console.log('[Settings] 开始初始化应用...')

try {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.component('BaseIcon', Icon)
  app.component('ThemeToggle', ThemeToggle)

  // 全局错误处理
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Settings] Vue错误:', err)
    console.error('[Settings] 错误信息:', info)
    console.error('[Settings] 组件实例:', instance)
  }

  // 全局警告处理
  app.config.warnHandler = (msg, _instance, trace) => {
    console.warn('[Settings] Vue警告:', msg)
    console.warn('[Settings] 组件追踪:', trace)
  }

  console.log('[Settings] 挂载应用到 #app...')
  app.mount('#app')
  console.log('[Settings] 应用挂载成功')
} catch (error) {
  console.error('[Settings] 应用初始化失败:', error)
}
