import { createApp } from 'vue'
import SearchPopup from './SearchPopup.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'
import '@mdi/font/css/materialdesignicons.css'

createApp(SearchPopup).use(vuetify).mount('#app')
