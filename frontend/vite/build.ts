/**
 * Vite 构建配置
 * 
 * Vite 8 默认使用：
 * - Rolldown（替代 Rollup）
 * - Oxc Minifier（替代 esbuild/terser）
 * - Lightning CSS（替代 esbuild CSS minifier）
 */

import type { BuildOptions } from 'vite'
import {
  OUT_DIR,
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

    /**
     * 🚀 Vite 8 默认压缩器：Oxc Minifier（Rust 实现，比 terser 快 10-20 倍）
     * 
     * 可选值：
     * - 'oxc'（默认）：Rust 实现，速度最快
     * - 'terser'：JavaScript 实现，压缩率最高
     * - 'esbuild'：Go 实现，速度快但已弃用
     * 
     * 注意：Oxc Minifier 不支持 property mangling
     */
    minify: 'oxc',

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

    /**
     * 🎨 CSS 压缩器：Lightning CSS（Rust 实现，比 esbuild 快 100 倍）
     * 
     * Vite 8 默认使用 Lightning CSS，支持：
     * - 更好的语法降级
     * - 自动添加浏览器前缀
     * - CSS 模块
     * - 现代 CSS 特性转换
     */
    cssTarget: 'chrome100',
    cssCodeSplit: true, // 启用 CSS 分割，为 popup/management 等生成独立 CSS
    cssMinify: 'lightningcss', // Vite 8 默认值

    // 关闭压缩大小报告（ANALYZE 时会生成可视化报告）
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,

    // SourceMap 配置：调试模式生成 sourcemap，生产模式不生成
    sourcemap: ENABLE_SOURCEMAP,

    // 资源处理优化 - 小资源内联以减少请求；字体仍按文件输出
    assetsInlineLimit: 4096,

    // Vite 8: 使用 rolldownOptions（rollupOptions 已弃用）
    rolldownOptions: createBuildOptions()
  }
}
