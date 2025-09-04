import { createApp } from 'vue'
import ManagementFixed from './ManagementFixed.vue'
import vuetify from '../plugins/vuetify'
import 'vuetify/dist/vuetify.min.css'

createApp(ManagementFixed).use(vuetify).mount('#app')