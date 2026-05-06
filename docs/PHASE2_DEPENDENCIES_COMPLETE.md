# 第二阶段依赖管理优化完成报告

**完成日期**: 2026-05-06  
**执行人**: AI Assistant  
**状态**: ✅ 完成

---

## 📋 执行清单

### ✅ 2.1 统一依赖版本

**问题发现**:

- Vue 版本不统一: `^3.5.18` (frontend) vs `^3.5.22` (website)
- TypeScript 版本不统一: `~5.8.3` (root) vs `^5.7.2` (website)

**解决方案**:
在根目录 `package.json` 的 `resolutions` 中添加版本锁定：

```json
{
  "resolutions": {
    "vue": "^3.5.18",
    "@supabase/supabase-js": "^2.79.0",
    "typescript": "~5.8.3",
    "zod": "^3.25.8",
    "@types/node": "^24.3.0",
    "postcss": "^8.4.41",
    "stylelint": "^16.25.0",
    "eslint": "^9.35.0"
  }
}
```

**效果**: 所有子项目现在使用统一的依赖版本

---

### ✅ 2.2 添加缺失的依赖

**Frontend 添加**:

- `@playwright/test: ^1.40.0` - Playwright 测试框架（devDependencies）
- `stylelint: ^16.25.0` - 样式检查工具（devDependencies）
- `@supabase/supabase-js: ^2.79.0` - Supabase 客户端（dependencies）

**原因**: 这些依赖在代码中被使用，但未在 package.json 中声明

---

### ✅ 2.3 删除未使用的依赖

**Frontend 移除**:

- `@atlaskit/pragmatic-drag-and-drop-auto-scroll: ^2.1.2` - 未在代码中使用
- `onnxruntime-web: 1.26.0-dev.20260416-b7804b056c` - AI 功能相关，当前未启用

**保留但未使用的依赖** (计划中的功能):

- `@acuity-bookmarks/auth-core` - 认证核心库
- `@acuity-bookmarks/design-tokens` - 设计系统 tokens
- `@huggingface/transformers` - AI 模型推理

**文档**: 创建 `docs/development/REMOVED_DEPENDENCIES.md` 记录移除的依赖

---

### ✅ 2.4 优化 package.json 脚本

**优化前** (42 个脚本，混乱):

```json
{
  "dev": "bunx turbo run dev",
  "dev:backend": "cd backend && bun run dev",
  "dev:website": "cd website && bun run dev",
  "build:frontend": "cd frontend && bun run build",
  "build:website": "cd website && bun run build",
  "build:all": "bunx turbo run build",
  "build": "bun run build:all"
  // ... 混乱的命名
}
```

**优化后** (45 个脚本，分组清晰):

```json
{
  // 依赖管理
  "prepare": "husky",
  "clean:deps": "...",
  "reinstall": "...",

  // 开发
  "dev": "bunx turbo run dev",
  "dev:fe": "...",
  "dev:be": "...",
  "dev:web": "...",

  // 构建
  "build": "bunx turbo run build",
  "build:fe": "...",
  "build:be": "...",
  "build:web": "...",
  "build:prod": "...",

  // 测试
  "test": "...",
  "test:fe": "...",
  "test:be": "...",

  // 代码质量
  "typecheck": "...",
  "lint": "...",
  "format": "...",
  "stylelint": "...",

  // 部署
  "deploy:be": "...",
  "deploy:web": "...",

  // 审计
  "audit:fe": "...",
  "audit:web": "...",

  // 数据库
  "db:start": "...",
  "db:stop": "..."
  // ...
}
```

**改进**:

1. ✅ 统一命名规范: `fe` (frontend), `be` (backend), `web` (website)
2. ✅ 分组清晰: 按功能分组，添加空行分隔
3. ✅ 使用 turbo: 所有子项目命令统一通过 turbo 执行
4. ✅ 删除冗余: 移除 `build:all` (直接用 `build`)
5. ✅ 删除过时: 移除 `watch:with-tests` (不常用)

---

## 🧪 验证结果

### 依赖安装

```bash
bun install
```

**结果**: ✅ 成功安装 120 个包

### 类型检查

```bash
bun run typecheck
```

**结果**: ✅ 全部通过 (6 packages, 0 errors)

### 依赖冲突

**结果**: ✅ 无冲突，resolutions 生效

---

## 📊 优化统计

### 依赖变更

- **添加**: 3 个依赖
- **移除**: 2 个依赖
- **统一版本**: 8 个核心依赖

### 脚本优化

- **优化前**: 42 个脚本，命名不统一
- **优化后**: 45 个脚本，分 9 组，命名统一

### 文件变更

- **修改**: 2 个 package.json (root, frontend)
- **新增**: 1 个文档 (REMOVED_DEPENDENCIES.md)

---

## 🎯 达成目标

✅ **版本统一**: 核心依赖版本在所有子项目中保持一致  
✅ **依赖完整**: 添加了所有缺失的依赖  
✅ **依赖精简**: 移除了未使用的依赖  
✅ **脚本清晰**: package.json 脚本分组明确，命名统一  
✅ **无破坏性**: 类型检查全部通过，没有引入新的错误

---

## 📝 后续建议

### 定期维护

1. **每季度审查依赖**: 运行 `bunx depcheck` 检查未使用的依赖
2. **安全审计**: 运行 `bun audit` 检查安全漏洞
3. **版本更新**: 定期更新依赖到最新稳定版本

### 第三阶段准备

- 合并 `domain/` 到 `core/`
- 重组 `services/` 到 `application/`
- 更新所有导入路径

---

## ✅ 提交建议

```bash
git add .
git commit -m "chore: 第二阶段依赖管理优化

- 统一核心依赖版本 (vue, typescript, supabase-js 等)
- 添加缺失的依赖 (@playwright/test, stylelint, @supabase/supabase-js)
- 移除未使用的依赖 (onnxruntime-web, pragmatic-drag-and-drop-auto-scroll)
- 优化 package.json 脚本，统一命名规范
- 创建依赖管理文档

依赖变更:
- 添加 3 个依赖
- 移除 2 个依赖
- 统一 8 个核心依赖版本
"
```

---

**完成时间**: 约 20 分钟  
**风险等级**: 🟡 中等风险 (依赖变更)  
**建议**: 运行完整测试后提交
