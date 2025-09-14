import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Popup from './Popup.vue';
import '@/design-system/tokens.css';
import '@/design-system/base.css';
import '@/assets/main.css';
import '@/assets/fonts.css';
import '@/assets/smart-fonts.css';
import { initializeFonts } from '@/utils/font-switcher';
import { initializeSmartFonts } from '@/utils/smart-font-manager';
// 使用CDN加载Material Design Icons，减少扩展包大小
// import '@mdi/font/css/materialdesignicons.css'

const app = createApp(Popup);
const pinia = createPinia();

app.use(pinia);

// 初始化Popup应用
async function initializePopup() {
  try {
    // 启动基础字体系统（用户界面语言）
    await initializeFonts();

    // 启动智能字体系统（用户内容自动检测）
    initializeSmartFonts();

    // 挂载应用
    app.mount('#app');

    console.log('🎉 AcuityBookmarks Popup 启动完成');
    console.log('🧠 智能多语言字体系统已激活');

  } catch (error) {
    console.error('❌ Popup启动失败:', error);

    // 即使字体初始化失败，也要启动应用
    app.mount('#app');
  }
}

initializePopup();
