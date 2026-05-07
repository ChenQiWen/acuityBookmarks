# 构建优化指南

本文档说明 AcuityBookmarks 项目的构建优化策略和最佳实践。

## 目录

- [构建配置](#构建配置)
- [性能优化](#性能优化)
- [分包策略](#分包策略)
- [缓存策略](#缓存策略)
- [监控和分析](#监控和分析)

---

## 构建配置

### Vite 配置

项目使用 Vite 作为构建工具，配置文件位于 `frontend/vite.config.ts`。

**配置模块化：**
- `vite/constants.ts` - 常量定义
- `vite/plugins.ts` - 插件配置
- `vite/build.ts` - 构建配置
- `vite/build-options.ts` - Rolldown 配置（输入、分包、输出）
- `vite/server.ts` - 开发服务器配置

**注意**: Vite 8 使用 Rolldown（Rust 编写）替代了 Rollup 和 esbuild，提供 10-30x 的性能提升。

### Turbo 配置

项目使用 Turbo 作为 Monorepo 构建工具，配置文件位于 `turbo.json`。

**缓存策略：**
- `build` - 启用缓存
- `lint` - 启用缓存
- `typecheck` - 启用缓存
- `test` - 启用缓存
- `dev` - 禁用缓存（持久化任务）

---

## 性能优化

### 1. 压缩优化

**Terser 配置：**
```typescript
{
  format: { 
    comments: false,
    keep_fnames: !SHOULD_DROP_CONSOLE
  },
  compress: {
    drop_console: SHOULD_DROP_CONSOLE,
    drop_debugger: true,
    passes: 2,
    pure_funcs: SHOULD_DROP_CONSOLE ? ['console.log', 'console.debug', 'console.info'] : [],
    unsafe_arrows: true,
    unsafe_methods: true,
    unsafe_proto: true
  },
  mangle: {
    keep_classnames: !SHOULD_DROP_CONSOLE,
    keep_fnames: !SHOULD_DROP_CONSOLE
  }
}
```

**快速压缩模式：**
```bash
# 使用 esbuild 压缩（更快，但体积稍大）
FAST_MINIFY=1 bun run build
```

### 2. 目标浏览器

**Chrome 100+ (ES2022)：**
- 支持所有现代 ES2022 特性
- 更小的 bundle 体积（无需 polyfill）
- 更快的执行速度

```typescript
{
  target: ['chrome100', 'es2022'],
  cssTarget: 'chrome100'
}
```

### 3. 依赖预构建

**优化策略：**
```typescript
{
  optimizeDeps: {
    include: [
      'vue',
      'pinia',
      'flexsearch',
      '@tanstack/vue-virtual',
      '@vueuse/core',
      'immer',
      'mitt',
      'zod'
    ],
    exclude: [
      '@huggingface/transformers',  // 大型库，按需加载
      'qrcode'                       // 按需加载
    ]
  }
}
```

---

## 分包策略

### Vendor Chunks

**核心框架：**
- `vendor-vue` - Vue 核心
- `vendor-pinia` - Pinia 状态管理

**功能库：**
- `vendor-lucide` - 图标库
- `vendor-flexsearch` - 搜索引擎
- `vendor-transformers` - AI/ML 库（最大）
- `vendor-virtual` - 虚拟滚动
- `vendor-query` - 查询库
- `vendor-utils` - 工具库（vueuse + immer + mitt）
- `vendor-zod` - 数据校验
- `vendor-dnd` - 拖拽库
- `vendor-supabase` - Supabase 客户端
- `vendor-trpc` - tRPC 客户端

### App Chunks

**应用代码：**
- `app-stores` - Pinia stores
- `app-services` - 业务逻辑
- `app-infrastructure` - 基础设施层
- `app-core` - 核心领域
- `app-domain` - 领域模型
- `app-config` - 配置
- `app-types` - 类型定义
- `app-utils` - 工具函数
- `app-components` - Vue 组件
- `app-composables` - Vue composables

### 特殊处理

**Service Worker：**
- `background.js` - 不分包（Service Worker 限制）
- `offscreen.js` - 不分包（Service Worker 限制）

**Content Script：**
- `content/inject-quick-add-dialog.js` - 固定文件名（manifest 引用）

---

## 缓存策略

### 文件名哈希

**策略：**
```typescript
{
  chunkFileNames: 'assets/[name].[hash:8].js',
  entryFileNames: (chunkInfo) => {
    // Service Worker 和 Content Script 不加哈希
    if (['background', 'offscreen'].includes(chunkInfo.name)) {
      return '[name].js'
    }
    if (chunkInfo.name === 'content/inject-quick-add-dialog') {
      return 'content/inject-quick-add-dialog.js'
    }
    return 'assets/[name].[hash:8].js'
  },
  assetFileNames: (assetInfo) => {
    const ext = assetInfo.name.split('.').pop()
    // WASM 文件不加哈希（ONNX Runtime 需要）
    if (ext === 'wasm') return 'assets/[name].[ext]'
    // 其他资源加哈希
    return 'assets/[name].[hash:8].[ext]'
  }
}
```

### 缓存优化

**长期缓存：**
- Vendor chunks - 很少变化，长期缓存
- App chunks - 按功能分包，独立缓存

**缓存失效：**
- 文件内容变化 → 哈希变化 → 缓存失效
- 依赖更新 → Vendor chunk 哈希变化

---

## 监控和分析

### 构建性能监控

**运行性能监控：**
```bash
bun run build:perf
```

**输出示例：**
```
📊 性能报告:
   类型检查: 3.45s (25.3%)
   构建: 10.21s (74.7%)
   总时间: 13.66s
```

### Bundle 分析

**分析 Bundle 大小：**
```bash
bun run analyze:bundle
```

**输出示例：**
```
📦 JS 文件 (45 个)
   总大小: 2.34 MB
   - assets/vendor-vue.a1b2c3d4.js: 456.78 KB
   - assets/vendor-transformers.e5f6g7h8.js: 1.23 MB
   - assets/app-components.i9j0k1l2.js: 234.56 KB

⚠️  大文件警告 (> 500KB):
   - assets/vendor-transformers.e5f6g7h8.js: 1.23 MB
```

### Vite Bundle Analyzer

**可视化分析：**
```bash
bun run build:analyze
```

这会生成一个交互式的 Bundle 分析报告。

---

## 最佳实践

### 1. 开发环境

**快速构建：**
```bash
# 使用 watch 模式
bun run build:watch

# 使用快速压缩
FAST_MINIFY=1 bun run build
```

### 2. 生产环境

**完整构建：**
```bash
# 完整的生产构建
bun run build:prod

# 分析 Bundle
bun run analyze:bundle
```

### 3. 性能优化

**检查大文件：**
1. 运行 `bun run analyze:bundle`
2. 检查 > 500KB 的文件
3. 考虑按需加载或代码分割

**优化依赖：**
1. 检查是否有重复依赖
2. 使用 `peerDependencies` 共享依赖
3. 考虑使用更轻量的替代库

### 4. 缓存优化

**Vendor chunks：**
- 将稳定的依赖放入 vendor chunks
- 避免频繁更新的依赖污染 vendor chunks

**App chunks：**
- 按功能模块分包
- 避免循环依赖

---

## 环境变量

### 构建相关

- `NODE_ENV` - 环境模式（development/production）
- `VITE_RUNTIME_ENV` - 运行时环境（dev/prod）
- `FAST_MINIFY` - 启用快速压缩（esbuild）
- `CSS_MINIFIER` - CSS 压缩器（esbuild/lightningcss）
- `ANALYZE` - 启用 Bundle 分析
- `CRAWLER_DEBUG` - 启用爬虫调试

### 使用示例

```bash
# 快速开发构建
FAST_MINIFY=1 bun run build

# 生产构建 + 分析
ANALYZE=true bun run build:prod

# 使用 lightningcss 压缩 CSS
CSS_MINIFIER=lightningcss bun run build
```

---

## 故障排查

### 构建慢

**问题：** 构建时间 > 60s

**解决方案：**
1. 使用 `FAST_MINIFY=1` 启用 esbuild 压缩
2. 检查是否有大型依赖可以按需加载
3. 使用增量构建（`build:watch`）

### Bundle 大

**问题：** Bundle 体积 > 5MB

**解决方案：**
1. 运行 `bun run analyze:bundle` 找出大文件
2. 考虑按需加载大型库（如 @huggingface/transformers）
3. 检查是否有重复依赖

### 缓存失效

**问题：** Vendor chunks 频繁变化

**解决方案：**
1. 检查 `package.json` 中的依赖版本
2. 使用精确版本号（不使用 `^` 或 `~`）
3. 锁定依赖版本（`bun.lockb`）

---

## 参考资料

- [Vite 官方文档](https://vitejs.dev/)
- [Vite 8 发布公告](https://vite.dev/blog/announcing-vite8)
- [Rolldown 官方文档](https://rolldown.rs/)
- [Turbo 官方文档](https://turbo.build/)
- [Terser 官方文档](https://terser.org/)

**注意**: Vite 8 使用 Rolldown 替代了 Rollup，但保持了 Rollup 插件 API 的兼容性。

---

**最后更新**: 2026-05-07  
**版本**: 1.0.0
