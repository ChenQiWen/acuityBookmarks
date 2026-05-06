import { defineConfig, type ConfigEnv, type Plugin, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve } from 'path'
import { execSync } from 'child_process'
// 注意：rollup-plugin-visualizer 已移除，如需构建分析请先安装：
// bun add -D rollup-plugin-visualizer
// 然后在下方 plugins 数组中添加 visualizer() 插件

// https://vitejs.dev/config/
export default defineConfig((_env: ConfigEnv) => {
  // 🔒 使用 loadEnv 读取环境变量，并强制将 HTTP URL 转换为 HTTPS
  // 确保 import.meta.env 中的 URL 始终是 HTTPS
  const envDir = resolve(__dirname, '../')
  const env = loadEnv(_env.mode, envDir, '')

  const forceHttpsEnvVars = () => {
    const envVars = ['VITE_API_BASE_URL', 'VITE_CLOUDFLARE_WORKER_URL']
    envVars.forEach(key => {
      const value = env[key] || process.env[key]
      if (value?.startsWith('http://')) {
        const httpsValue = value.replace('http://', 'https://')
        // 更新 process.env（Vite 会从这里读取）
        process.env[key] = httpsValue
        // 更新 env 对象
        env[key] = httpsValue
        console.warn(
          `⚠️  构建时转换: ${key} 从 HTTP 转换为 HTTPS: ${value} → ${httpsValue}`
        )
      }
    })
  }

  // 在配置加载前执行转换
  forceHttpsEnvVars()

  const plugins = [
    vue({
      template: {
        compilerOptions: {
          // 忽略自定义元素警告
          isCustomElement: _tag => false
        }
      }
    }),
    // 🔒 启用 HTTPS 开发服务器
    basicSsl(),
    // 🧹 构建完成后自动清理和整理 dist 目录
    {
      name: 'clean-dist-plugin',
      closeBundle() {
        console.log('🧹 构建完成，运行清理脚本...')
        try {
          execSync('bun scripts/clean-dist.cjs', {
            stdio: 'inherit',
            cwd: __dirname
          })
          // ✅ 构建后验证 background.js 不包含 DOM API
          execSync('node scripts/validate-background.cjs', {
            stdio: 'inherit',
            cwd: __dirname
          })
        } catch (error) {
          console.error('❌ 清理脚本执行失败:', error)
        }
      }
    } as Plugin,
    {
      name: 'force-https-env-vars',
      configResolved(config: { env: Record<string, string> }) {
        // 在配置解析后，再次检查并转换环境变量
        const envVars = ['VITE_API_BASE_URL', 'VITE_CLOUDFLARE_WORKER_URL']
        envVars.forEach(key => {
          const value = process.env[key]
          if (value?.startsWith('http://')) {
            const httpsValue = value.replace('http://', 'https://')
            process.env[key] = httpsValue
            // 同时更新 config.env 中的值
            if (config.env[key]) {
              config.env[key] = httpsValue
            }
            console.warn(
              `⚠️  插件转换: ${key} 从 HTTP 转换为 HTTPS: ${value} → ${httpsValue}`
            )
          }
        })
      }
    } as Plugin
  ]

  // 构建开关：FAST_MINIFY=true 使用 esbuild 以提升构建速度
  const FAST_MINIFY = process.env.FAST_MINIFY === 'true'

  // Console 删除策略：只有明确设置 NODE_ENV=production 且没有调试标志时才删除 console
  // - build:prod (NODE_ENV=production) → 删除 console
  // - build (CRAWLER_DEBUG=true) → 保留 console
  // - build:hot, build:analyze → 保留 console（默认）
  const SHOULD_DROP_CONSOLE =
    process.env.NODE_ENV === 'production' &&
    process.env.CRAWLER_DEBUG !== 'true' &&
    process.env.FONT_DEBUG !== 'true' &&
    process.env.KEEP_CONSOLE !== 'true'

  // 开发调试模式标识（用于日志输出）
  const DEBUG_MODE = !SHOULD_DROP_CONSOLE

  // SourceMap 策略：开发/调试时生成 sourcemap，生产环境不生成
  // - build (CRAWLER_DEBUG=true) → 生成 sourcemap（方便调试）
  // - build:prod (NODE_ENV=production) → 不生成 sourcemap（减小体积）
  const ENABLE_SOURCEMAP = DEBUG_MODE

  console.log('🔧 构建配置:', {
    FAST_MINIFY,
    DEBUG_MODE,
    SHOULD_DROP_CONSOLE,
    ENABLE_SOURCEMAP,
    NODE_ENV: process.env.NODE_ENV,
    CRAWLER_DEBUG: process.env.CRAWLER_DEBUG,
    KEEP_CONSOLE: process.env.KEEP_CONSOLE
  })

  return {
    base: './',
    // ⚠️ 重要：强制从项目根目录读取环境变量文件，与 watch-build.js 保持一致
    // 默认情况下，Vite 会从 vite.config.ts 所在目录读取 .env 文件
    // 但我们需要从项目根目录读取，确保环境变量一致
    // 注意：.env.local 也应该放在项目根目录，而不是 frontend/ 目录
    envDir: resolve(__dirname, '../'),
    plugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },

    build: {
      outDir: resolve(__dirname, '../dist'),
      emptyOutDir: true,

      // 禁用模块预加载（Service Worker 不支持 document 操作）
      modulePreload: false,

      // 压缩配置优化（可通过 FAST_MINIFY 切换为 esbuild 更快的压缩）
      minify: FAST_MINIFY ? 'esbuild' : 'terser',
      terserOptions: FAST_MINIFY
        ? undefined
        : {
            format: { comments: false },
            compress: {
              // 只有 build:prod 明确的生产构建才删除 console
              // 其他所有构建（build, build:hot, build:analyze）都保留 console
              drop_console: SHOULD_DROP_CONSOLE,
              drop_debugger: true,
              passes: 2
            }
          },

      /**
       * 🎯 目标浏览器：针对欧美市场优化
       *
       * Chrome 100+：2022年3月发布，欧美市场用户自动更新普及率 >95%
       *
       * 优势：
       * - 支持所有现代 ES2022 特性（Top-level await、私有字段等）
       * - 更小的 bundle 体积（无需 polyfill）
       * - 更快的执行速度
       * - 支持现代 CSS 特性（容器查询、:has() 等）
       */
      target: ['chrome100', 'es2022'],
      // CSS 目标浏览器：支持现代 CSS 特性
      cssTarget: 'chrome100',
      // CSS 代码分割：为每个入口生成独立的 CSS 文件
      // background.js (Service Worker) 通过 external 配置已排除 CSS，不会有问题
      cssCodeSplit: true, // 启用 CSS 分割，为 popup/management 等生成独立 CSS
      cssMinify:
        process.env.CSS_MINIFIER === 'lightningcss'
          ? 'lightningcss'
          : 'esbuild',

      // 关闭压缩大小报告（ANALYZE 时会生成可视化报告）
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1000,

      // SourceMap 配置：调试模式生成 sourcemap，生产模式不生成
      sourcemap: ENABLE_SOURCEMAP,

      // 资源处理优化 - 小资源内联以减少请求；字体仍按文件输出
      assetsInlineLimit: 4096,

      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/pages/popup/index.html'),
          management: resolve(__dirname, 'src/pages/management/index.html'),
          'side-panel': resolve(__dirname, 'src/pages/side-panel/index.html'),
          settings: resolve(__dirname, 'src/pages/settings/index.html'),
          background: resolve(__dirname, 'src/background/main.ts'),
          offscreen: resolve(__dirname, 'src/offscreen/main.ts'),
          onboarding: resolve(__dirname, 'src/pages/onboarding/index.html'),
          'content/inject-quick-add-dialog': resolve(
            __dirname,
            'src/content/inject-quick-add-dialog.ts'
          )
        },
        // Service Worker 特殊处理：background.js 不能包含 CSS
        // 注意：这个 external 配置在 Vite 的 HTML 处理中不起作用
        // 实际上 background.js 本身就不导入任何 CSS，所以这个配置可以移除
        // external: (id: string) => {
        //   // 已确认 background.js 不导入 CSS，无需此配置
        //   return false
        // },
        output: {
          // 更智能的分包策略（严格按 1.md 建议）
          manualChunks(id: string) {
            // Service Worker 特殊处理：background.js 和 offscreen.js 不能有依赖分割
            if (id.includes('/background/') || id.includes('/offscreen/')) {
              return undefined
            }

            if (id.includes('node_modules')) {
              // 核心框架 - 单独分包，缓存友好
              if (
                id.includes('/vue/') ||
                id.includes('/vue-demi/') ||
                id.includes('@vue/')
              )
                return 'vendor-vue'
              if (id.includes('/pinia/')) return 'vendor-pinia'

              // 图标库 - 按需导入但仍单独分包
              if (id.includes('lucide-vue-next')) return 'vendor-lucide'

              // 搜索库
              if (id.includes('fuse.js')) return 'vendor-fuse'

              // 虚拟滚动
              if (id.includes('@tanstack/vue-virtual')) return 'vendor-virtual'

              // 查询库
              if (
                id.includes('@tanstack/vue-query') ||
                id.includes('@tanstack/query-core')
              )
                return 'vendor-query'

              // 工具库：vueuse + immer + mitt（体积小，合并）
              if (
                id.includes('@vueuse/') ||
                id.includes('immer') ||
                id.includes('mitt')
              )
                return 'vendor-utils'

              // 数据校验
              if (id.includes('zod')) return 'vendor-zod'

              // 拖拽库
              if (id.includes('@atlaskit/')) return 'vendor-dnd'

              // 其他依赖归入 vendor
              return 'vendor'
            }

            // 应用代码分割
            if (id.includes('/stores/')) return 'app-stores'
            if (id.includes('/application/')) return 'app-services'
            if (id.includes('/services/')) return 'app-services'
            if (id.includes('/infrastructure/')) return 'app-services'
            if (id.includes('/core/')) return 'app-services'
            if (id.includes('/domain/')) return 'app-services'
            if (id.includes('/config/')) return 'app-services'
            if (id.includes('/types/')) return 'app-services'
            if (id.includes('/utils/')) return 'app-services'
            if (id.includes('/components/')) return 'app-components'

            return undefined
          },

          // 资源文件名优化
          chunkFileNames: 'assets/[name].[hash:8].js',
          entryFileNames: chunkInfo => {
            if (['background', 'offscreen'].includes(chunkInfo.name)) {
              return '[name].js'
            }
            // Content script 也需要固定文件名（manifest 中引用）
            if (chunkInfo.name === 'content/inject-quick-add-dialog') {
              return 'content/inject-quick-add-dialog.js'
            }
            return 'assets/[name].[hash:8].js'
          },
          assetFileNames: (assetInfo: { name?: string }) => {
            const name = assetInfo.name || ''
            const ext = name.split('.').pop() || ''
            // WASM 文件：不加哈希，保持原始文件名（ONNX Runtime 需要）
            if (ext === 'wasm') {
              return 'assets/[name].[ext]'
            }
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
        // Rollup treeshake：只对 node_modules 禁用副作用检测，应用代码保留副作用
        // ⚠️ 不能对整个项目设置 moduleSideEffects: false，因为项目有大量顶层单例初始化
        treeshake: {
          moduleSideEffects: id => !id.includes('node_modules'),
          propertyReadSideEffects: false
        }
      }
    },

    // 依赖预构建优化：多入口页面需要显式声明
    optimizeDeps: {
      entries: [
        resolve(__dirname, 'src/pages/popup/index.html'),
        resolve(__dirname, 'src/pages/management/index.html'),
        resolve(__dirname, 'src/pages/side-panel/index.html'),
        resolve(__dirname, 'src/pages/settings/index.html'),
        resolve(__dirname, 'src/pages/onboarding/index.html')
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
      // 🔒 HTTPS 由 basicSsl() 插件自动配置
      // basicSsl() 插件会自动生成自签名证书并配置 HTTPS
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
