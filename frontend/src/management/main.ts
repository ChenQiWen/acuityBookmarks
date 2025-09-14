import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Management from './Management.vue';
import '@/assets/main.css'; // Import shared styles
import '@/assets/fonts.css'; // Import font system
import '@/assets/smart-fonts.css'; // Import smart font system
import { initializeFonts } from '@/utils/font-switcher';
import { initializeSmartFonts } from '@/utils/smart-font-manager';

const app = createApp(Management);
const pinia = createPinia();

app.use(pinia);

// 初始化应用
async function initializeApp() {
  try {
    // 启动基础字体系统（用户界面语言）
    await initializeFonts();

    // 启动智能字体系统（用户内容自动检测）
    initializeSmartFonts();

    // 挂载应用
    app.mount('#app');

    console.log('🎉 AcuityBookmarks 管理页面启动完成');
    console.log('🧠 智能多语言字体系统已激活');

  } catch (error) {
    console.error('❌ 应用启动失败:', error);

    // 即使字体初始化失败，也要启动应用
    app.mount('#app');
  }
}

initializeApp();
