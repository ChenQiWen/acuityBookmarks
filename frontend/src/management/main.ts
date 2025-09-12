import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Management from './Management.vue'
import '@/assets/main.css'; // Import shared styles

const app = createApp(Management)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
