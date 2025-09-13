import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 自定义插件：只保留woff2格式的MDI字体
function mdiOptimizer() {
  return {
    name: 'mdi-optimizer',
    generateBundle(_options: any, bundle: any) {
      // 删除除了woff2之外的所有MDI字体文件
      Object.keys(bundle).forEach(fileName => {
        if (fileName.includes('materialdesignicons-webfont') && 
            !fileName.includes('.woff2')) {
          delete bundle[fileName]
        }
      })
      
      // 修复CSS中的字体路径，只保留woff2
      Object.keys(bundle).forEach(fileName => {
        const chunk = bundle[fileName]
        if (chunk.type === 'asset' && fileName.includes('.css') && 
            typeof chunk.source === 'string' && 
            chunk.source.includes('materialdesignicons-webfont')) {
          
          // 找到现有的woff2文件名（带hash）
          const woff2Match = chunk.source.match(/materialdesignicons-webfont\.[^.]+\.woff2/)
          if (woff2Match) {
            const woff2FileName = woff2Match[0]
            
            // 删除所有已存在的@font-face声明
            chunk.source = chunk.source.replace(
              /@font-face\{[^}]*\}/g,
              ''
            )
            
            // 在CSS开头添加正确的@font-face声明
            const fontFaceDeclaration = `@font-face{font-family:"Material Design Icons";src:url(./${woff2FileName}) format("woff2");font-weight:normal;font-style:normal}@font-face{font-family:"mdi";src:url(./${woff2FileName}) format("woff2");font-weight:normal;font-style:normal}.mdi:before,.mdi-set{display:inline-block;font:normal normal normal 24px/1 "Material Design Icons";font-size:inherit;text-rendering:auto;line-height:inherit;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}`
            
            chunk.source = fontFaceDeclaration + chunk.source
          }
        }
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    mdiOptimizer(),
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
    
    // 资源处理优化 - 确保字体文件不被内联
    assetsInlineLimit: 0, // 禁用内联，确保字体文件被复制到fonts目录
    
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
            if (id.includes('vue')) {
              return 'vendor-vue';
            }
            return 'vendor'; // 其他第三方库
          }
        },
        
        // 资源文件名优化
        chunkFileNames: 'assets/[name].[hash:8].js',
        entryFileNames: 'assets/[name].[hash:8].js',
        assetFileNames: (assetInfo) => {
          // 字体文件放到fonts目录，其他资源放到assets目录
          if (assetInfo.name && /\.(woff2?|ttf|eot|otf)$/.test(assetInfo.name)) {
            return 'fonts/[name].[ext]'
          }
          return 'assets/[name].[hash:8].[ext]'
        }
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
