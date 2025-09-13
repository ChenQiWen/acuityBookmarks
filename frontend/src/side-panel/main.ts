import { createApp } from 'vue';
import { createPinia } from 'pinia';
import SidePanel from './SidePanel.vue';
import '../design-system/tokens.css';
import '../design-system/base.css';
import '@/assets/main.css';
import '@/assets/fonts.css';
import '@/assets/smart-fonts.css';
import { initializeFonts } from '../utils/font-switcher';
import { initializeSmartFonts } from '../utils/smart-font-manager';

const app = createApp(SidePanel);
const pinia = createPinia();

app.use(pinia);

// 初始化Side Panel应用
async function initializeSidePanel() {
  try {
    // 启动基础字体系统
    await initializeFonts();
    
    // 启动智能字体系统
    initializeSmartFonts();
    
    // 挂载应用
    app.mount('#app');
    
    console.log('🎉 AcuityBookmarks Side Panel 启动完成');
    console.log('📌 侧边栏模式已激活');
    
  } catch (error) {
    console.error('❌ Side Panel启动失败:', error);
    
    // 即使初始化失败，也要启动应用
    app.mount('#app');
  }
}

initializeSidePanel();
