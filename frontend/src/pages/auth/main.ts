import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Auth from './Auth.vue'
// 样式导入（main.css 已包含完整设计系统）
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'


const app = createApp(Auth)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
