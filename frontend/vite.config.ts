import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    
    // 压缩配置优化
    minify: 'terser',
    
    // 目标浏览器（Chrome扩展环境）
    target: ['chrome89', 'edge89'],
    
    // 包大小监控
    reportCompressedSize: true,
    chunkSizeWarningLimit: 800, // 降低到800KB
    
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        management: resolve(__dirname, 'management.html'),
        'search-popup': resolve(__dirname, 'search-popup.html'),
        'debug-management': resolve(__dirname, 'debug-management.html'),
        'debug-panel': resolve(__dirname, 'debug-panel.html'),
      },
      output: {
        // 更精细的代码分割
        manualChunks(id) {
          // AI分析相关代码独立打包
          if (id.includes('ai') || id.includes('analysis') || id.includes('llm')) {
            return 'ai-engine';
          }
          // Chrome API相关
          if (id.includes('chrome') || id.includes('extension') || id.includes('webextension')) {
            return 'extension-api';
          }
          // 可视化组件（拖拽等）
          if (id.includes('drag') || id.includes('sortable') || id.includes('vue-draggable')) {
            return 'visual-components';
          }
          // Vuetify组件
          if (id.includes('node_modules')) {
            if (id.includes('vuetify')) {
              return 'vendor-vuetify';
            }
            // 工具库
            if (id.includes('lodash') || id.includes('axios')) {
              return 'vendor-utils';
            }
            return 'vendor'; // 其他第三方库
          }
        },
        
        // 资源文件名优化
        chunkFileNames: 'assets/[name].[hash:8].js',
        entryFileNames: 'assets/[name].[hash:8].js',
        assetFileNames: 'assets/[name].[hash:8].[ext]'
      },
    },
  },
  
  // 开发服务器优化
  server: {
    hmr: {
      overlay: false // 关闭错误覆盖层，提升开发体验
    }
  }
})
