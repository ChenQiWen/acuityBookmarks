import { createApp } from 'vue'
import Popup from './Popup.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'
import '@mdi/font/css/materialdesignicons.css'

createApp(Popup).use(vuetify).mount('#app')
