import { createApp } from 'vue'
import DebugManagement from './DebugManagement.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'

createApp(DebugManagement).use(vuetify).mount('#app')