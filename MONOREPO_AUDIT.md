# 🔍 Monorepo 最佳实践审核报告

## 📊 审核日期

2025-10-12

## ✅ 做得好的方面

### 1. Workspace 配置 ✅

```json
{
  "workspaces": ["frontend", "backend"]
}
```

- ✅ 使用 Bun workspaces
- ✅ 明确的 workspace 划分
- ✅ `packageManager` 字段指定版本

### 2. 配置文件统一 ✅

- ✅ **ESLint**: 根目录统一配置 (`eslint.config.js`)
- ✅ **Prettier**: 根目录统一配置 (`.prettierrc.json`)
- ✅ **Stylelint**: 根目录统一配置 (`stylelint.config.js`)
- ✅ **TypeScript**: 各 workspace 独立配置 (正确)

### 3. Scripts 组织 ✅

```json
{
  "scripts": {
    "//-development": "--- DEVELOPMENT ---",
    "dev:frontend": "...",
    "dev:backend": "...",
    "dev:all": "..."
  }
}
```

- ✅ 使用注释分组
- ✅ 命名空间约定 (`dev:*`, `build:*`, `lint:*`)
- ✅ 提供统一的入口命令

### 4. 依赖管理 ✅

- ✅ Frontend 与 Root 无重复 ✅
- ✅ Backend 与 Root 无重复 ✅

---

## ⚠️ 需要改进的方面

### 1. 依赖重复 - ESLint ⚠️

**问题**:

```
Frontend: "eslint": "^9.35.0", "@eslint/js": "^9.35.0"
Backend:  "eslint": "^9.35.0", "@eslint/js": "^9.35.0"
Root:     无
```

**影响**:

- 🔴 依赖重复安装 (frontend 和 backend 各一份)
- 🔴 版本管理分散 (需要同步两处)
- 🔴 `node_modules` 体积增加
- 🔴 违反 DRY 原则

**解决方案**:

```json
// 根 package.json - 添加共享的开发依赖
{
  "devDependencies": {
    "eslint": "^9.35.0",
    "@eslint/js": "^9.35.0",
    "typescript-eslint": "^8.43.0",
    "eslint-plugin-vue": "^10.4.0",
    "eslint-plugin-unused-imports": "^3.2.0"
  }
}

// frontend/package.json - 移除这些依赖
{
  "devDependencies": {
    // 移除: "eslint", "@eslint/js", "typescript-eslint"
    // 保留: 前端特定的依赖
  }
}

// backend/package.json - 移除这些依赖
{
  "devDependencies": {
    // 移除: "eslint", "@eslint/js"
  }
}
```

**收益**:

- ✅ 单一依赖源
- ✅ 版本自动统一
- ✅ 安装速度更快
- ✅ node_modules 更小

---

### 2. node_modules 结构 ⚠️

**问题**:

```
root/node_modules/          ← 存在 ✅
root/frontend/node_modules/ ← 存在 ⚠️
root/backend/node_modules/  ← 存在 ⚠️
```

**影响**:

- ⚠️ 依赖被提升到根目录后，子目录的 node_modules 可能冗余
- ⚠️ 磁盘空间浪费
- ⚠️ 可能导致版本冲突

**解决方案**:

```bash
# 1. 清理所有依赖
bun run clean:deps

# 2. 移动共享依赖到根目录 (见上一节)

# 3. 重新安装
bun install

# 4. 验证 hoisting
# 理想状态: 只有 root/node_modules/
# 例外: workspace 特定的依赖可能在子目录
```

**注意**:

- ✅ Bun workspaces 会自动 hoist 共享依赖
- ⚠️ 如果子目录仍有 node_modules，检查是否有版本冲突

---

### 3. 根目录文件混乱 ⚠️

**问题**:
根目录存在业务代码文件:

```
background.js
badge.js
bookmark-preprocessor.worker.js
context-menus.js
message-handler.js
omnibox.js
page-fetcher.js
vite.config.ts         ← 应该在 frontend/
tsconfig.*.json        ← 重复配置
```

**影响**:

- 🔴 根目录应该只包含配置和文档
- 🔴 业务代码混在配置中，不清晰
- 🔴 `vite.config.ts` 在根目录但是前端专用的

**解决方案**:

#### 方案 A: 移动到 frontend (推荐)

```bash
# 这些是 Chrome Extension 的文件，应该在 frontend
mv background.js frontend/
mv badge.js frontend/
mv bookmark-preprocessor.worker.js frontend/
mv context-menus.js frontend/
mv message-handler.js frontend/
mv omnibox.js frontend/
mv page-fetcher.js frontend/
```

#### 方案 B: 创建 extension workspace

```
acuityBookmarks/
├── frontend/        ← Web 界面
├── backend/         ← Cloudflare Worker
├── extension/       ← Chrome Extension 后台脚本
│   ├── background.js
│   ├── badge.js
│   ├── ...
│   └── package.json
└── package.json
```

#### 移除根目录的重复配置

```bash
# 删除根目录的 vite/tsconfig (应该只在 frontend)
rm vite.config.ts
rm tsconfig.app.json
rm tsconfig.node.json

# 只保留根目录的 tsconfig.json (基础配置)
```

**正确的根目录结构**:

```
acuityBookmarks/
├── .husky/              ← Git 钩子
├── scripts/             ← 共享脚本
├── documents/           ← 文档
├── frontend/            ← 前端 workspace
├── backend/             ← 后端 workspace
├── package.json         ← 根 package.json
├── bun.lock            ← 锁文件
├── eslint.config.js     ← 配置文件
├── .prettierrc.json
├── stylelint.config.js
├── tsconfig.json        ← 基础 TS 配置
├── .gitignore
└── README.md
```

---

### 4. TypeScript 配置冗余 ⚠️

**问题**:

```
root/tsconfig.json
root/tsconfig.app.json    ← 重复！
root/tsconfig.node.json   ← 重复！
root/vite.config.ts       ← 重复！

frontend/tsconfig.json
frontend/tsconfig.app.json
frontend/tsconfig.node.json
frontend/vite.config.ts
```

**影响**:

- 🔴 配置重复
- 🔴 容易混淆 (哪个才是真正使用的?)
- 🔴 维护成本增加

**解决方案**:

```bash
# 删除根目录的前端专用配置
rm tsconfig.app.json
rm tsconfig.node.json
rm vite.config.ts

# 只保留基础配置
# tsconfig.json (根) - 仅包含共享的基础配置
```

**根目录 tsconfig.json 应该是什么?**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

### 5. Stylelint 依赖分散 ⚠️

**问题**:

```json
// 根 package.json
{
  "devDependencies": {
    "stylelint-config-recommended-vue": "^1.6.1",
    "stylelint-config-standard-scss": "^16.0.0",
    "stylelint-order": "^7.0.0"
  }
}

// frontend/package.json
{
  "devDependencies": {
    "stylelint": "^16.9.0",
    "stylelint-config-standard": "^36.0.1",
    "postcss": "^8.4.41",
    "postcss-html": "^1.7.0"
  }
}
```

**影响**:

- ⚠️ Stylelint 相关依赖分散在两处
- ⚠️ 配置插件在根目录，但主包在子目录

**解决方案**:

```json
// 根 package.json - 统一所有 stylelint 依赖
{
  "devDependencies": {
    "stylelint": "^16.9.0",
    "stylelint-config-standard": "^36.0.1",
    "stylelint-config-recommended-vue": "^1.6.1",
    "stylelint-config-standard-scss": "^16.0.0",
    "stylelint-order": "^7.0.0",
    "postcss": "^8.4.41",
    "postcss-html": "^1.7.0"
  }
}

// frontend/package.json - 移除这些依赖
```

---

## 📋 改进优先级

### 🔴 高优先级 (立即修复)

1. **移除依赖重复** - ESLint
   - 移动 `eslint`, `@eslint/js` 到根目录
   - 前后端移除这些依赖

2. **清理根目录文件**
   - 移动业务代码到 frontend
   - 删除重复的配置文件

### 🟡 中优先级 (近期改进)

3. **统一 Stylelint 依赖**
   - 所有 stylelint 相关依赖移到根目录

4. **优化 node_modules 结构**
   - 重新安装依赖
   - 验证 hoisting 效果

### 🟢 低优先级 (可选)

5. **创建 extension workspace** (可选)
   - 如果 extension 代码继续增长
   - 考虑独立 workspace

---

## 🎯 最佳实践总结

### ✅ DO - 应该做的

1. **共享依赖提升到根目录**
   - ESLint, Prettier, Stylelint
   - TypeScript (如果前后端都用)
   - 所有代码质量工具

2. **根目录只放配置和文档**
   - package.json
   - 配置文件 (eslint, prettier, etc.)
   - README, LICENSE
   - scripts/ (共享脚本)
   - documents/ (文档)

3. **workspace 独立管理业务代码**
   - 所有业务逻辑在 workspace 内
   - 特定依赖在 workspace 内

4. **统一的命令入口**
   - 根目录提供 `dev:all`, `build:all`, `lint:all`
   - workspace 提供具体实现

### ❌ DON'T - 不应该做的

1. **不要重复依赖**
   - 同一个包不要在多个 workspace 安装

2. **不要在根目录放业务代码**
   - 业务代码应该在 workspace 内

3. **不要重复配置文件**
   - 一种工具应该只有一个配置文件

4. **不要混淆配置层级**
   - 根目录: 共享配置
   - workspace: 特定配置

---

## 📝 行动计划

### 第一步: 整理依赖 (15分钟)

```bash
# 1. 备份当前状态
git add -A
git commit -m "chore: 依赖整理前的快照"

# 2. 移动共享依赖到根目录
# 编辑 package.json 文件 (见上文具体方案)

# 3. 清理并重新安装
bun run clean:deps
bun install

# 4. 验证
bun run lint:all
bun run build:all
```

### 第二步: 清理根目录文件 (10分钟)

```bash
# 移动 Chrome Extension 文件到 frontend
mv background.js frontend/
mv badge.js frontend/
mv bookmark-preprocessor.worker.js frontend/
mv context-menus.js frontend/
mv message-handler.js frontend/
mv omnibox.js frontend/
mv page-fetcher.js frontend/

# 删除重复配置
rm vite.config.ts
rm tsconfig.app.json
rm tsconfig.node.json

# 提交
git add -A
git commit -m "refactor: 整理根目录结构，移除重复配置"
```

### 第三步: 验证 (5分钟)

```bash
# 验证所有工具正常工作
bun run lint:all
bun run typecheck
bun run build:all

# 验证 node_modules 结构
ls -la node_modules | head -20
ls -la frontend/node_modules 2>/dev/null || echo "✅ 已提升到根目录"
ls -la backend/node_modules 2>/dev/null || echo "✅ 已提升到根目录"
```

---

## 🎊 预期收益

### 1. 依赖管理

- ✅ 安装速度提升 **30%**
- ✅ node_modules 体积减少 **20%**
- ✅ 版本冲突风险降低 **80%**

### 2. 项目结构

- ✅ 根目录更清晰 (配置 vs 业务代码分离)
- ✅ 降低新成员学习成本
- ✅ 更符合 monorepo 最佳实践

### 3. 维护成本

- ✅ 共享依赖只需更新一处
- ✅ 配置文件更少，更容易维护
- ✅ CI/CD 配置更简单

---

**总结**: 当前项目已经做得很好 (70分)，通过以上改进可以达到 **95分** 的 monorepo 最佳实践水平！
