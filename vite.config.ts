import { defineConfig, type ConfigEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
// visualizer is an optional dependency, loaded only during ANALYZE to avoid mandatory installation
// Removed visualizer import and conditional loading
// If bundle analysis is needed: run `ANALYZE=true bun run build:analyze` and manually install
// rollup-plugin-visualizer, then temporarily enable injection in this file.

// https://vitejs.dev/config/
export default defineConfig((_env: ConfigEnv) => {
  const plugins: any[] = [vue()]

  // If bundle analysis is needed: run `ANALYZE=true bun run build:analyze` and manually install
  // rollup-plugin-visualizer, then temporarily enable injection in this file.

  return {
    base: './',
    plugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'frontend/src')
      }
    },

    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,

      // 压缩配置优化
      minify: 'terser',
      terserOptions: {
        format: { comments: false },
        // Allow preserving console output when FONT_DEBUG=true so we can debug runtime loader behavior.
        compress: {
          drop_console: process.env.FONT_DEBUG === 'true' ? false : true,
          drop_debugger: true,
          passes: 2
        }
      },

      // 目标浏览器 - 使用较新的语法以减少 polyfill
      target: ['es2020'],

      // 关闭压缩大小报告（ANALYZE 时会生成可视化报告）
      reportCompressedSize: false,
      chunkSizeWarningLimit: 300,

      // 禁用生产 sourcemap
      sourcemap: false,

      // 资源处理优化 - 确保字体文件不被内联
      assetsInlineLimit: 0,

      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'frontend/popup.html'),
          management: resolve(__dirname, 'frontend/management.html'),
          'side-panel': resolve(__dirname, 'frontend/side-panel.html'),
          settings: resolve(__dirname, 'frontend/settings.html'),
          auth: resolve(__dirname, 'frontend/auth.html')
        },
        output: {
          // 更精确的第三方拆包策略
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('vue')) return 'vendor-vue'
              if (id.includes('pinia')) return 'vendor-pinia'
              if (id.includes('fuse.js')) return 'vendor-fuse'
              // SVG 图标本地映射不再打入独立 vendor-mdi chunk
              const nm = id.split('node_modules/')[1]
              if (nm) {
                const pkg = nm.split('/')[0]
                return `vendor-${pkg}`
              }
              return 'vendor'
            }
            return undefined
          },

          // 资源文件名优化
          chunkFileNames: 'assets/[name].[hash:8].js',
          entryFileNames: 'assets/[name].[hash:8].js',
          assetFileNames: (assetInfo: { name?: string }) => {
            if (
              assetInfo.name &&
              /\.(woff2?|ttf|eot|otf)$/.test(assetInfo.name)
            ) {
              return 'fonts/[name].[ext]'
            }
            return 'assets/[name].[hash:8].[ext]'
          }
        }
      }
    },

    // 开发服务器优化
    server: {
      hmr: {
        overlay: false // 关闭错误覆盖层，提升开发体验
      }
    }
  }
})
