import { createApp } from 'vue'
import Management from './Management.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'

createApp(Management).use(vuetify).mount('#app')
