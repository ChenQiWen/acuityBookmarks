import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Popup from './Popup.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'
import '@/assets/main.css'; // Import shared styles
// 使用CDN加载Material Design Icons，减少扩展包大小
// import '@mdi/font/css/materialdesignicons.css'

const app = createApp(Popup)
const pinia = createPinia()

app.use(pinia)
app.use(vuetify)
app.mount('#app')
