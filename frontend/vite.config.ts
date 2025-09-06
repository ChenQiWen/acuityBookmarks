import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  // 移除字体文件assetsInclude，因为现在使用CDN加载
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    // 移除PWA相关的文件，减少扩展包大小
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        management: resolve(__dirname, 'management.html'),
        'search-popup': resolve(__dirname, 'search-popup.html'),
        'debug-management': resolve(__dirname, 'debug-management.html'),
        'debug-panel': resolve(__dirname, 'debug-panel.html'),
        'management-fixed': resolve(__dirname, 'management-fixed.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vuetify')) {
              return 'vendor-vuetify';
            }
            return 'vendor'; // all other vendors
          }
        },
      },
    },
  },
})
