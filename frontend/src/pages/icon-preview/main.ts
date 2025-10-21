import { createApp } from 'vue'
import IconPreview from './IconPreview.vue'
import BaseIcon from '@/components/base/Icon/Icon.vue'

const app = createApp(IconPreview)
app.component('BaseIcon', BaseIcon)
app.mount('#app')
