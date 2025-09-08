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
      },
      output: {
        // 安全的代码分割 - 只分割第三方库
        manualChunks(id) {
          // 只分割 node_modules 中的第三方库
          if (id.includes('node_modules')) {
            if (id.includes('vuetify')) {
              return 'vendor-vuetify';
            }
            if (id.includes('vue')) {
              return 'vendor-vue';
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
