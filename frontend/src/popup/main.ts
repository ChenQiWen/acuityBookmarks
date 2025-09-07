import { createApp } from 'vue'
import Popup from './Popup.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'
import '@/assets/main.css'; // Import shared styles
// 使用CDN加载Material Design Icons，减少扩展包大小
// import '@mdi/font/css/materialdesignicons.css'

createApp(Popup).use(vuetify).mount('#app')
