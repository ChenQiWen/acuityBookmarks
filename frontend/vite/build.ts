/**
 * Vite 构建配置
 */

import type { BuildOptions } from 'vite'
import {
  OUT_DIR,
  FAST_MINIFY,
  SHOULD_DROP_CONSOLE,
  ENABLE_SOURCEMAP
} from './constants'
import { createBuildOptions } from './build-options'

/**
 * 创建构建配置
 */
export function createBuildConfig(): BuildOptions {
  return {
    outDir: OUT_DIR,
    emptyOutDir: true,

    // 禁用模块预加载（Service Worker 不支持 document 操作）
    modulePreload: false,

    // 压缩配置优化（可通过 FAST_MINIFY 切换为 esbuild 更快的压缩）
    minify: FAST_MINIFY ? 'esbuild' : 'terser',
    terserOptions: FAST_MINIFY
      ? undefined
      : {
          format: { 
            comments: false
          },
          compress: {
            // 只有 build:prod 明确的生产构建才删除 console
            // 其他所有构建（build, build:hot, build:analyze）都保留 console
            drop_console: SHOULD_DROP_CONSOLE,
            drop_debugger: true,
            passes: 2,
            // 优化选项
            pure_funcs: SHOULD_DROP_CONSOLE ? ['console.log', 'console.debug', 'console.info'] : [],
            unsafe_arrows: true,
            unsafe_methods: true,
            unsafe_proto: true
          },
          mangle: {
            // 保留类名（用于调试）
            keep_classnames: !SHOULD_DROP_CONSOLE
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

    rollupOptions: createBuildOptions()
  }
}
