import { createApp } from 'vue'
import Popup from './Popup.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'

createApp(Popup).use(vuetify).mount('#app')
