# Vite 8 升级方案

**制定时间**: 2026-05-07  
**当前版本**: Vite 7.2.4  
**目标版本**: Vite 8.0.10

---

## 📋 目录

- [升级概述](#升级概述)
- [核心变化](#核心变化)
- [升级前准备](#升级前准备)
- [升级步骤](#升级步骤)
- [配置迁移](#配置迁移)
- [依赖更新](#依赖更新)
- [测试验证](#测试验证)
- [回滚方案](#回滚方案)
- [风险评估](#风险评估)
- [时间规划](#时间规划)

---

## 升级概述

### 为什么升级到 Vite 8？

Vite 8 是 Vite 自 2.0 以来最重大的架构变化，主要优势：

1. **性能提升 10-30x**
   - 使用 Rolldown（Rust 编写）替代 Rollup 和 esbuild
   - Linear 公司：生产构建时间从 46s 降至 6s
   - Beehiiv 公司：构建时间减少 64%

2. **统一的构建工具链**
   - 开发和生产使用同一个 bundler（Rolldown）
   - 消除双 bundler 带来的不一致性
   - 更好的插件兼容性

3. **更好的 TypeScript 支持**
   - 内置 tsconfig paths 支持
   - 内置 emitDecoratorMetadata 支持

4. **新功能**
   - 集成开发者工具（Vite Devtools）
   - WebAssembly SSR 支持
   - 浏览器控制台转发

### 升级风险

⚠️ **中等风险**

- Rolldown 替代 Rollup/esbuild 可能导致构建行为变化
- 部分 Rollup 插件可能不兼容
- CommonJS 互操作性变化可能影响某些依赖
- 配置需要迁移（esbuild → oxc）

---

## 核心变化

### 1. Rolldown 替代 Rollup 和 esbuild

**之前（Vite 7）**:
- 开发环境：esbuild（依赖预构建 + TypeScript/JSX 转换）
- 生产环境：Rollup（打包优化）

**现在（Vite 8）**:
- 开发 + 生产：Rolldown（统一的 Rust bundler）

**影响**:
- ✅ 构建速度提升 10-30x
- ✅ 开发和生产行为一致
- ⚠️ 部分 Rollup 插件可能需要更新

### 2. Oxc 替代 esbuild（JavaScript 转换）

**之前**: esbuild 处理 TypeScript/JSX 转换  
**现在**: Oxc（Rust 编写）处理 JavaScript 转换

**影响**:
- ✅ 转换速度提升 30x+
- ⚠️ `esbuild` 配置需要迁移到 `oxc`
- ⚠️ 原生装饰器暂不支持降级（需要 Babel/SWC）

### 3. Lightning CSS 默认用于 CSS 压缩

**之前**: esbuild 压缩 CSS  
**现在**: Lightning CSS 压缩 CSS（默认）

**影响**:
- ✅ 更好的语法降级
- ⚠️ Bundle 大小可能略微增加

### 4. CommonJS 互操作性变化

**影响**:
- ⚠️ 从 CJS 模块导入的默认导出行为变化
- ⚠️ 可能影响某些依赖包

### 5. Node.js 版本要求

**要求**: Node.js 20.19+ 或 22.12+

**当前项目**: ✅ 已满足（使用 Node.js 22.22.2）

---

## 升级前准备

### 1. 备份当前代码

```bash
# 创建备份分支
git checkout -b backup/vite-7-stable
git push origin backup/vite-7-stable

# 创建升级分支
git checkout -b feat/upgrade-vite-8
```

### 2. 记录当前构建性能

```bash
# 记录当前构建时间
bun run build:prod

# 记录输出
# ✓ built in X.XXs
# 📦 最终dist文件夹大小: XXM
```

**当前基准**:
- 构建时间: ~5.69s（开发构建）
- Bundle 大小: 33M
- 模块数量: 2374

### 3. 检查依赖兼容性

需要检查的关键依赖：

| 依赖 | 当前版本 | Vite 8 兼容性 | 需要更新 |
|------|---------|--------------|---------|
| `@vitejs/plugin-vue` | 需检查 | ✅ 兼容 | 可能需要 |
| `vite-plugin-*` | 各种 | ⚠️ 需验证 | 可能需要 |
| `rollup-plugin-*` | 各种 | ⚠️ 需验证 | 可能需要 |

### 4. 阅读官方文档

- ✅ [Vite 8 发布公告](https://vite.dev/blog/announcing-vite8)
- ✅ [Vite 8 迁移指南](https://vite.dev/guide/migration)
- ✅ [Rolldown 文档](https://rolldown.rs/)

---

## 升级步骤

### 阶段 1: 渐进式迁移（推荐）

**目标**: 先迁移到 `rolldown-vite`（Vite 7 + Rolldown），隔离 Rolldown 相关问题

#### 步骤 1.1: 安装 rolldown-vite

```bash
# 更新 package.json
cd frontend
```

```json
{
  "devDependencies": {
    "vite": "npm:rolldown-vite@7.2.2"
  }
}
```

```bash
# 安装依赖
bun install
```

#### 步骤 1.2: 测试构建

```bash
# 开发构建
bun run build

# 生产构建
bun run build:prod

# 类型检查
bun run typecheck
```

#### 步骤 1.3: 修复 Rolldown 相关问题

如果出现问题，参考 [配置迁移](#配置迁移) 部分。

#### 步骤 1.4: 验证功能

- [ ] 开发服务器启动正常
- [ ] 热更新工作正常
- [ ] 生产构建成功
- [ ] 扩展在浏览器中加载正常
- [ ] 所有功能正常工作

### 阶段 2: 升级到 Vite 8

**前提**: 阶段 1 完成，rolldown-vite 运行稳定

#### 步骤 2.1: 更新依赖

```bash
cd frontend
```

更新 `package.json`:

```json
{
  "devDependencies": {
    "vite": "^8.0.10",
    "@vitejs/plugin-vue": "^6.0.0",
    "vue-tsc": "^3.0.5"
  }
}
```

```bash
# 安装依赖
bun install
```

#### 步骤 2.2: 迁移配置

参考 [配置迁移](#配置迁移) 部分，更新 Vite 配置。

#### 步骤 2.3: 测试构建

```bash
# 类型检查
bun run typecheck

# 开发构建
bun run build

# 生产构建
bun run build:prod
```

#### 步骤 2.4: 运行测试

```bash
# 单元测试
bun run test:run

# E2E 测试
bun run test:visual

# 完整测试
bun run test:all:complete
```

#### 步骤 2.5: 验证功能

- [ ] 所有测试通过
- [ ] 开发服务器启动正常
- [ ] 热更新工作正常
- [ ] 生产构建成功
- [ ] 扩展在浏览器中加载正常
- [ ] 所有功能正常工作
- [ ] 性能指标符合预期

---

## 配置迁移

### 1. esbuild → oxc（JavaScript 转换）

#### 之前（Vite 7）

```typescript
// vite.config.ts
export default defineConfig({
  esbuild: {
    jsxInject: `import React from 'react'`,
    jsx: 'automatic',
    jsxImportSource: 'react',
    jsxDev: true,
    define: {
      __DEV__: 'true'
    }
  }
})
```

#### 之后（Vite 8）

```typescript
// vite.config.ts
export default defineConfig({
  oxc: {
    jsxInject: `import React from 'react'`,
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
      development: true,
      pure: false
    },
    define: {
      __DEV__: 'true'
    }
  }
})
```

**自动转换**: Vite 8 会自动转换 `esbuild` 配置到 `oxc`，但建议手动迁移。

### 2. optimizeDeps.esbuildOptions → optimizeDeps.rolldownOptions

#### 之前（Vite 7）

```typescript
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      minify: true,
      treeShaking: true,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      loader: {
        '.txt': 'text'
      }
    }
  }
})
```

#### 之后（Vite 8）

```typescript
export default defineConfig({
  optimizeDeps: {
    rolldownOptions: {
      output: {
        minify: true,
        keepNames: false
      },
      treeshake: true,
      transform: {
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      },
      moduleTypes: {
        '.txt': 'text'
      }
    }
  }
})
```

**自动转换**: Vite 8 会自动转换，但建议手动迁移。

### 3. build.rollupOptions → build.rolldownOptions

#### 之前（Vite 7）

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'pinia']
        }
      }
    }
  }
})
```

#### 之后（Vite 8）

```typescript
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // manualChunks 对象形式不再支持
        // 使用 codeSplitting 代替
      },
      codeSplitting: {
        strategy: 'auto',
        groups: [
          {
            name: 'vendor',
            test: /node_modules\/(vue|pinia)/
          }
        ]
      }
    }
  }
})
```

### 4. Worker 配置

#### 当前配置

```typescript
// vite.config.ts
export default defineConfig({
  worker: {
    format: 'es' as const
  }
})
```

**Vite 8**: 保持不变，继续使用。

### 5. CSS 压缩

#### 之前（Vite 7）

```typescript
export default defineConfig({
  build: {
    cssMinify: 'esbuild'
  }
})
```

#### 之后（Vite 8）

```typescript
export default defineConfig({
  build: {
    // Lightning CSS 是默认值
    cssMinify: 'lightningcss', // 或 'esbuild'（需要安装 esbuild）
    cssTarget: 'chrome100'
  }
})
```

### 6. 项目特定配置迁移

#### frontend/vite.config.ts

**需要修改的部分**:

1. ✅ `worker.format` - 保持不变
2. ⚠️ `optimizeDeps.disabled` - 删除（Vite 5.1 已移除）
3. ⚠️ `build.rollupOptions` - 重命名为 `build.rolldownOptions`
4. ⚠️ `esbuild` - 迁移到 `oxc`（如果有）

#### frontend/vite/build.ts

**需要修改的部分**:

1. ⚠️ `terserOptions` - 检查兼容性
2. ⚠️ `rollupOptions` - 重命名为 `rolldownOptions`

#### frontend/vite/rollup.ts

**需要修改的部分**:

1. ⚠️ 导入类型从 `vite` 而非 `rollup`
2. ⚠️ `manualChunks` - 迁移到 `codeSplitting`

---

## 依赖更新

### 核心依赖

```json
{
  "devDependencies": {
    "vite": "^8.0.10",
    "@vitejs/plugin-vue": "^6.0.0",
    "vue-tsc": "^3.0.5",
    "vitest": "^4.0.17"
  }
}
```

### 可选依赖

如果需要使用 esbuild（降级方案）:

```bash
bun add -D esbuild
```

### 插件更新

检查并更新所有 Vite 插件：

```bash
# 检查过时的依赖
bun outdated

# 更新插件
bun update @vitejs/plugin-vue
bun update vite-plugin-*
```

### 新增依赖（如果需要）

#### 原生装饰器降级（如果使用）

**使用 Babel**:

```bash
bun add -D @rolldown/plugin-babel @babel/plugin-proposal-decorators
```

```typescript
// vite.config.ts
import babel from '@rolldown/plugin-babel'

function decoratorPreset(options: Record<string, unknown>) {
  return {
    preset: () => ({
      plugins: [['@babel/plugin-proposal-decorators', options]],
    }),
    rolldown: {
      filter: {
        code: '@',
      },
    },
  }
}

export default defineConfig({
  plugins: [babel({ presets: [decoratorPreset({ version: '2023-11' })] })],
})
```

**使用 SWC**:

```bash
bun add -D @rollup/plugin-swc @swc/core
```

---

## 测试验证

### 1. 构建测试

```bash
# 开发构建
bun run build

# 生产构建
bun run build:prod

# 分析构建
bun run build:analyze
```

**验证指标**:
- [ ] 构建成功（无错误）
- [ ] 构建时间（预期：减少 30-60%）
- [ ] Bundle 大小（预期：略微增加 ~15MB）
- [ ] 所有入口点正常生成

### 2. 功能测试

```bash
# 类型检查
bun run typecheck

# 单元测试
bun run test:run

# E2E 测试
bun run test:visual

# 完整测试
bun run test:all:complete
```

**验证清单**:
- [ ] 所有测试通过
- [ ] 无类型错误
- [ ] 无运行时错误

### 3. 手动测试

#### 开发环境

```bash
bun run build:watch
```

**验证**:
- [ ] 开发服务器启动正常
- [ ] 热更新工作正常
- [ ] 无控制台错误
- [ ] 性能符合预期

#### 生产环境

```bash
bun run build:prod
# 在浏览器中加载扩展
```

**验证**:
- [ ] 扩展加载成功
- [ ] Popup 页面正常
- [ ] Management 页面正常
- [ ] Settings 页面正常
- [ ] Background Script 正常
- [ ] Content Script 正常
- [ ] 所有功能正常工作

### 4. 性能测试

#### 构建性能

```bash
# 运行性能测试
bun run build:perf
```

**对比指标**:

| 指标 | Vite 7 | Vite 8 | 提升 |
|------|--------|--------|------|
| 构建时间 | ~5.69s | 预期 ~2-3s | 50-60% |
| 模块转换 | 2374 | 预期相同 | - |
| Bundle 大小 | 33M | 预期 ~35M | +6% |

#### 运行时性能

使用性能监控工具：

```typescript
import { performanceMonitor } from '@/utils/performance-monitor'

performanceMonitor.initialize()
performanceMonitor.printReport()
```

**验证指标**:
- [ ] FCP < 1.8s
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] 内存使用 < 50MB

---

## 回滚方案

### 快速回滚

如果升级后出现严重问题，可以快速回滚：

```bash
# 1. 切换回备份分支
git checkout backup/vite-7-stable

# 2. 或者回滚 package.json
cd frontend
```

```json
{
  "devDependencies": {
    "vite": "^7.2.4",
    "@vitejs/plugin-vue": "^5.0.0"
  }
}
```

```bash
# 3. 重新安装依赖
bun install

# 4. 测试构建
bun run build
```

### 部分回滚

如果只是 Rolldown 有问题，可以回滚到 esbuild:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'esbuild', // 使用 esbuild 压缩
    cssMinify: 'esbuild' // 使用 esbuild 压缩 CSS
  }
})
```

**注意**: 需要安装 esbuild:

```bash
bun add -D esbuild
```

---

## 风险评估

### 高风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Rolldown 构建失败 | 🔴 高 | 🟡 中 | 使用渐进式迁移，先测试 rolldown-vite |
| 插件不兼容 | 🔴 高 | 🟡 中 | 提前检查插件兼容性，准备替代方案 |
| CommonJS 互操作性问题 | 🟡 中 | 🟡 中 | 使用 `legacy.inconsistentCjsInterop: true` 临时修复 |

### 中风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 配置迁移错误 | 🟡 中 | 🟢 低 | 仔细阅读迁移指南，逐步迁移 |
| 性能不如预期 | 🟡 中 | 🟢 低 | 使用性能监控工具，优化配置 |
| Bundle 大小增加 | 🟢 低 | 🟡 中 | 可接受（+15MB），主要来自 Lightning CSS |

### 低风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 类型错误 | 🟢 低 | 🟢 低 | 运行 typecheck，修复错误 |
| 测试失败 | 🟢 低 | 🟢 低 | 运行测试，修复失败用例 |

---

## 时间规划

### 总体时间: 2-3 天

#### 第 1 天: 准备和渐进式迁移

- **上午（2-3 小时）**
  - [ ] 创建备份分支
  - [ ] 记录当前性能基准
  - [ ] 检查依赖兼容性
  - [ ] 阅读官方文档

- **下午（3-4 小时）**
  - [ ] 安装 rolldown-vite
  - [ ] 测试构建
  - [ ] 修复 Rolldown 相关问题
  - [ ] 验证功能

#### 第 2 天: 升级到 Vite 8

- **上午（3-4 小时）**
  - [ ] 更新依赖到 Vite 8
  - [ ] 迁移配置（esbuild → oxc）
  - [ ] 迁移配置（rollupOptions → rolldownOptions）
  - [ ] 测试构建

- **下午（3-4 小时）**
  - [ ] 运行所有测试
  - [ ] 修复测试失败
  - [ ] 手动功能测试
  - [ ] 性能测试

#### 第 3 天: 验证和优化

- **上午（2-3 小时）**
  - [ ] 完整功能测试
  - [ ] 性能优化
  - [ ] 文档更新

- **下午（2-3 小时）**
  - [ ] 代码审查
  - [ ] 创建 PR
  - [ ] 团队评审

---

## 成功标准

### 必须满足

- [ ] ✅ 所有构建成功（开发 + 生产）
- [ ] ✅ 所有测试通过（单元 + E2E）
- [ ] ✅ 无类型错误
- [ ] ✅ 扩展在浏览器中正常加载
- [ ] ✅ 所有功能正常工作

### 期望达到

- [ ] 🎯 构建时间减少 30-60%
- [ ] 🎯 开发服务器启动更快
- [ ] 🎯 热更新更快
- [ ] 🎯 无明显性能退化

### 可接受的权衡

- [ ] ⚠️ Bundle 大小增加 ~15MB（Lightning CSS）
- [ ] ⚠️ 部分插件需要更新
- [ ] ⚠️ 配置文件需要调整

---

## 参考资料

### 官方文档

- [Vite 8 发布公告](https://vite.dev/blog/announcing-vite8)
- [Vite 8 迁移指南](https://vite.dev/guide/migration)
- [Vite 8 变更日志](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md)
- [Rolldown 文档](https://rolldown.rs/)
- [Oxc 文档](https://oxc.rs/)

### 社区资源

- [Vite Discord](https://chat.vite.dev/)
- [Vite GitHub Discussions](https://github.com/vitejs/vite/discussions)
- [Rolldown GitHub](https://github.com/rolldown/rolldown)

### 相关文章

- [Vite 8, in Eight Lines of Config](https://anjack.io/blog/vite-8-in-eight-lines)
- [Vite 8, Rolldown & Oxc 2026](https://www.alexcloudstar.com/blog/vite-8-rolldown-oxc-2026/)
- [Everything You Need to Know about Vite 8](https://www.builder.io/blog/vite-8-vite-plus-void)

---

## 附录

### A. 常见问题

#### Q1: Vite 8 是否向后兼容？

**A**: 大部分情况下是的。Vite 8 提供了兼容层，自动转换 `esbuild` 和 `rollupOptions` 配置。但建议手动迁移以获得最佳性能。

#### Q2: 是否必须升级？

**A**: 不是必须的。Vite 7 仍然稳定且受支持。但 Vite 8 提供了显著的性能提升，建议在项目稳定后升级。

#### Q3: 升级后性能没有提升怎么办？

**A**: 
1. 检查配置是否正确迁移
2. 使用 `build:perf` 脚本分析性能
3. 检查是否有插件拖慢构建
4. 参考官方性能优化指南

#### Q4: 如果插件不兼容怎么办？

**A**:
1. 检查插件是否有 Vite 8 兼容版本
2. 寻找替代插件
3. 临时回滚到 Vite 7
4. 向插件作者报告问题

### B. 配置模板

#### 完整的 Vite 8 配置示例

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  
  // Oxc 配置（替代 esbuild）
  oxc: {
    jsx: {
      runtime: 'automatic',
      development: true
    }
  },
  
  // 依赖优化
  optimizeDeps: {
    rolldownOptions: {
      output: {
        minify: true
      },
      treeshake: true
    }
  },
  
  // 构建配置
  build: {
    target: 'chrome111', // Vite 8 默认目标
    cssMinify: 'lightningcss', // 默认
    rolldownOptions: {
      output: {
        manualChunks: undefined // 使用 codeSplitting 代替
      },
      codeSplitting: {
        strategy: 'auto'
      }
    }
  },
  
  // Worker 配置
  worker: {
    format: 'es' as const
  }
})
```

---

**最后更新**: 2026-05-07  
**版本**: 1.0.0  
**作者**: Kiro AI Assistant
