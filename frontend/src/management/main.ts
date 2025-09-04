import { createApp } from 'vue'
import Management from './Management.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'
import '@mdi/font/css/materialdesignicons.css'

createApp(Management).use(vuetify).mount('#app')
