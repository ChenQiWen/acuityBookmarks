import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Auth from './Auth.vue'
// 引入全局样式
import '@/design-system/tokens.css'
import '@/design-system/typography.css'
import '@/design-system/base.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'


const app = createApp(Auth)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
