# 📊 打包体积分析报告

生成时间：2026-05-07

## 📈 总体积分布

### 最大的文件（Top 10）

| 文件 | 大小 | 类型 | 优化建议 |
|------|------|------|---------|
| `ort-wasm-simd-threaded.asyncify.wasm` | 23.5 MB | WASM | ✅ 已优化（ONNX Runtime，必需） |
| `app-components.js` | 854.78 KB | JS | ⚠️ 需要优化 |
| `vendor-transformers.js` | 417.08 KB | JS | ⚠️ 需要优化 |
| `vendor.js` | 151.39 KB | JS | ✅ 合理 |
| `app-infrastructure.js` | 65.97 KB | JS | ✅ 合理 |
| `management.js` | 54.25 KB | JS | ✅ 合理 |
| `query-worker.js` | 52.41 KB | JS | ✅ 合理 |
| `app-services.js` | 43.89 KB | JS | ✅ 合理 |
| `content/inject-quick-add-dialog.js` | 28.49 KB | JS | ✅ 合理 |
| `app-stores.js` | 24.79 KB | JS | ✅ 合理 |

### CSS 文件分布

| 文件 | 大小 | 说明 |
|------|------|------|
| `app-components.css` | 110.07 KB | 组件样式 |
| `smart-fonts.css` | 44.15 KB | 字体样式 |
| `base.css` | 30.90 KB | 基础样式 |
| `management.css` | 10.50 KB | 管理页面 |
| `onboarding.css` | 9.64 KB | 引导页面 |
| `popup.css` | 8.95 KB | 弹窗页面 |

## 🎯 优化建议

### 1. app-components.js (854.78 KB) - 🔴 高优先级

**问题**：组件库打包过大

**可能原因**：
- Vue 组件全部打包在一起
- 包含了大量图标组件（lucide-vue-next）
- 可能包含未使用的组件

**优化方案**：
1. ✅ 按页面分割组件（已部分实现）
2. 🔄 图标按需导入（需要检查）
3. 🔄 检查是否有未使用的组件

### 2. vendor-transformers.js (417.08 KB) - 🔴 高优先级

**问题**：Hugging Face Transformers 库体积大

**当前状态**：
- 已在 `optimizeDeps.exclude` 中排除
- 但仍然被打包

**优化方案**：
1. ✅ 确认是否真的需要在所有页面加载
2. 🔄 考虑只在 AI 设置页面动态导入
3. 🔄 检查是否可以使用更轻量的替代方案

### 3. 图标库优化

**当前使用**：`lucide-vue-next`

**优化方案**：
1. 🔄 检查是否按需导入
2. 🔄 考虑使用 unplugin-icons 实现真正的按需导入

## 📊 代码分割分析

### 当前分割策略

```typescript
// vendor 分包
- vendor-vue: Vue 核心
- vendor-pinia: Pinia 状态管理
- vendor-lucide: 图标库
- vendor-flexsearch: 搜索库
- vendor-transformers: AI/ML 库
- vendor-virtual: 虚拟滚动
- vendor-query: 查询库
- vendor-utils: 工具库
- vendor-zod: 数据校验
- vendor-dnd: 拖拽库
- vendor-supabase: Supabase 客户端
- vendor-trpc: tRPC 客户端
- vendor: 其他依赖

// 应用代码分包
- app-stores: Pinia stores
- app-services: 应用服务
- app-infrastructure: 基础设施
- app-core: 核心逻辑
- app-types: 类型定义
- app-utils: 工具函数
- app-components: Vue 组件
- app-composables: Vue composables
```

### 优化建议

1. **app-components 过大**：
   - 当前：854.78 KB
   - 建议：按页面进一步分割
   - 目标：< 300 KB

2. **vendor-transformers 独立**：
   - 当前：417.08 KB
   - 建议：只在需要时加载
   - 目标：延迟加载

## 🔍 未使用代码检测

### 需要检查的模块

1. **Hugging Face Transformers**
   - 检查是否所有页面都需要
   - 是否可以延迟加载

2. **图标库**
   - 检查是否有未使用的图标
   - 是否可以按需导入

3. **工具库**
   - 检查 lodash 等工具库的使用
   - 是否可以使用原生方法替代

## 📈 优化目标

| 指标 | 当前 | 目标 | 优化空间 |
|------|------|------|---------|
| 总 JS 体积 | ~1.7 MB | ~1.2 MB | -30% |
| 最大 chunk | 854 KB | < 300 KB | -65% |
| 首屏加载 | ~200 KB | ~150 KB | -25% |

## 🚀 下一步行动

1. ✅ 安装 bundle analyzer
2. 🔄 分析 app-components 组成
3. 🔄 优化图标导入
4. 🔄 延迟加载 Transformers
5. 🔄 检查未使用的依赖
