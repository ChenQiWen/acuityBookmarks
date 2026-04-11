import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Account from './Account.vue'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'

const app = createApp(Account)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
