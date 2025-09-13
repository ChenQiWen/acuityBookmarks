import { createApp } from 'vue';
import { createPinia } from 'pinia';
import SearchPopup from './SearchPopup.vue';
import '../design-system/tokens.css';
import '../design-system/base.css';
// 使用CDN加载Material Design Icons，减少扩展包大小
// import '@mdi/font/css/materialdesignicons.css'

const app = createApp(SearchPopup);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');
