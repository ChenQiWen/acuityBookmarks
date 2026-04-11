import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Subscription from './Subscription.vue'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'

const app = createApp(Subscription)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
