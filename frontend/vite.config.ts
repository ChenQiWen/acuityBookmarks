import { defineConfig, type ConfigEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
// visualizer is an optional dependency, loaded only during ANALYZE to avoid mandatory installation
// Removed visualizer import and conditional loading
// If bundle analysis is needed: run `ANALYZE=true bun run build:analyze` and manually install
// rollup-plugin-visualizer, then temporarily enable injection in this file.

// https://vitejs.dev/config/
export default defineConfig((_env: ConfigEnv) => {
  const plugins = [vue()]

  // 构建开关：FAST_MINIFY=true 使用 esbuild 以提升构建速度
  const FAST_MINIFY = process.env.FAST_MINIFY === 'true'

  // If bundle analysis is needed: run `ANALYZE=true bun run build:analyze` and manually install
  // rollup-plugin-visualizer, then temporarily enable injection in this file.

  return {
    base: './',
    plugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },

    build: {
      outDir: resolve(__dirname, '../dist'),
      emptyOutDir: true,

      // 压缩配置优化（可通过 FAST_MINIFY 切换为 esbuild 更快的压缩）
      minify: FAST_MINIFY ? 'esbuild' : 'terser',
      terserOptions: FAST_MINIFY
        ? undefined
        : {
            format: { comments: false },
            // 当 FONT_DEBUG=true 时保留 console，便于调试字体加载行为
            compress: {
              drop_console: process.env.FONT_DEBUG === 'true' ? false : true,
              drop_debugger: true,
              passes: 2
            }
          },

      // 目标浏览器 - 使用较新的语法以减少 polyfill
      target: ['es2020'],
      // CSS 目标浏览器（Chrome 扩展场景）
      cssTarget: 'chrome100',
      // CSS 代码分割与压缩器（按文档建议；无依赖时回退 esbuild）
      cssCodeSplit: true,
      cssMinify:
        process.env.CSS_MINIFIER === 'lightningcss'
          ? 'lightningcss'
          : 'esbuild',

      // 关闭压缩大小报告（ANALYZE 时会生成可视化报告）
      reportCompressedSize: false,
      chunkSizeWarningLimit: 300,

      // 禁用生产 sourcemap
      sourcemap: false,

      // 资源处理优化 - 小资源内联以减少请求；字体仍按文件输出
      assetsInlineLimit: 4096,

      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'popup.html'),
          management: resolve(__dirname, 'management.html'),
          'side-panel': resolve(__dirname, 'side-panel.html'),
          settings: resolve(__dirname, 'settings.html'),
          auth: resolve(__dirname, 'auth.html')
        },
        output: {
          // 更智能的分包策略（严格按 1.md 建议）
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              // 核心框架
              if (id.includes('vue')) return 'vendor-vue'
              if (id.includes('pinia')) return 'vendor-pinia'

              // 大型库
              if (id.includes('fuse.js')) return 'vendor-fuse'
              if (id.includes('@tanstack/vue-virtual')) return 'vendor-virtual'

              // UI 组件库（如果存在）
              if (
                id.includes('element-plus') ||
                id.includes('ant-design-vue')
              ) {
                return 'vendor-ui'
              }

              // 工具库合并
              if (id.includes('lodash') || id.includes('date-fns')) {
                return 'vendor-utils'
              }

              // 其他依赖归入 vendor
              return 'vendor'
            }

            // 应用代码分割
            if (id.includes('/stores/')) return 'app-stores'
            if (id.includes('/services/')) return 'app-services'
            if (id.includes('/components/ui/')) return 'app-ui-components'

            return undefined
          },

          // 资源文件名优化
          chunkFileNames: 'assets/[name].[hash:8].js',
          entryFileNames: 'assets/[name].[hash:8].js',
          assetFileNames: (assetInfo: { name?: string }) => {
            const name = assetInfo.name || ''
            const ext = name.split('.').pop() || ''
            // 字体文件：加哈希，进入 fonts/
            if (/woff2?|ttf|eot|otf/i.test(ext)) {
              return 'fonts/[name].[hash:8].[ext]'
            }
            // 图片文件：进入 images/
            if (/png|jpe?g|svg|gif|webp|avif/i.test(ext)) {
              return 'images/[name].[hash:8].[ext]'
            }
            // CSS 文件：进入 styles/
            if (ext === 'css') {
              return 'styles/[name].[hash:8].[ext]'
            }
            // 其他资源
            return 'assets/[name].[hash:8].[ext]'
          }
          // Rollup 3 treeshake 建议
          // 注意：此配置位于 output 上，但 treeshake 是 rollupOptions 顶层；在下方 rollupOptions.treeshake 中设置
        },
        // Rollup treeshake（按文档建议）
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false
        }
      }
    },

    // 依赖预构建优化：多入口页面需要显式声明
    optimizeDeps: {
      entries: [
        resolve(__dirname, 'popup.html'),
        resolve(__dirname, 'management.html'),
        resolve(__dirname, 'side-panel.html'),
        resolve(__dirname, 'settings.html'),
        resolve(__dirname, 'auth.html')
      ],
      include: ['vue', 'pinia', 'fuse.js', '@tanstack/vue-virtual'],
      exclude: []
    },

    // 通过 define 精简 Vue 产物（移除 Options API 与 Prod Devtools）
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false
    },

    // 开发服务器优化
    server: {
      hmr: {
        overlay: false, // 关闭错误覆盖层，提升开发体验
        protocol: 'ws',
        timeout: 30000
      },
      watch: {
        ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      },
      fs: {
        strict: false
      }
    }
  }
})
