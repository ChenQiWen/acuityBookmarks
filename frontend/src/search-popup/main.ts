import { createApp } from 'vue'
import SearchPopup from './SearchPopup.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'
// 使用CDN加载Material Design Icons，减少扩展包大小
// import '@mdi/font/css/materialdesignicons.css'

createApp(SearchPopup).use(vuetify).mount('#app')
