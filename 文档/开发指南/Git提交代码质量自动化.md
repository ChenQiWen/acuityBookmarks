# Git 提交代码质量自动化指南

## 概述

为了确保每次 Git 提交前代码质量符合项目标准，我们配置了自动化的 pre-commit hook，在提交前自动执行代码格式化和质量检查。

## 🔧 自动化流程

每次执行 `git commit` 时，pre-commit hook 会自动执行以下步骤：

### 1. 代码格式化 (Prettier)

```bash
bun run format
```

- 自动格式化所有 JavaScript、TypeScript、Vue、CSS、Markdown、JSON 文件
- 统一代码风格和缩进
- 确保代码符合项目的格式化标准

### 2. 样式代码修复 (Stylelint)

```bash
bun run stylelint:fix
```

- 自动修复 CSS/SCSS/Vue 样式文件中的问题
- 统一样式代码规范
- 仅在有样式文件变更时执行

### 3. 代码质量修复 (ESLint)

```bash
bun run lint:fix
```

- 自动修复 JavaScript/TypeScript/Vue 文件中的代码质量问题
- 修复可自动修复的 ESLint 规则违反
- 仅在有相关文件变更时执行

### 4. 重新暂存修复后的文件

- 将修复后的文件重新添加到 Git 暂存区
- 确保提交的是修复后的版本

## 📋 执行日志示例

```
🔧 pre-commit: 自动格式化与代码质量检查...
📄 检测到 5 个暂存文件
🎨 步骤 1/3: 运行 Prettier 格式化...
✅ Prettier 格式化完成
💅 步骤 2/3: 运行 Stylelint 自动修复...
✅ Stylelint 修复完成
🔍 步骤 3/3: 运行 ESLint 自动修复...
✅ ESLint 修复完成
📝 重新添加修复后的文件到暂存区...
🎉 所有代码质量检查完成，可以安全提交！
```

## ✅ 优势

1. **自动化**: 无需手动执行格式化和代码检查命令
2. **一致性**: 确保所有提交的代码符合统一标准
3. **减少失败**: 大大减少因代码规范问题导致的提交失败
4. **效率提升**: 开发者专注业务逻辑，工具自动处理代码质量
5. **团队协作**: 统一的代码风格便于代码审查和维护

## 🚨 注意事项

### 如果自动修复失败

如果某些问题无法自动修复，pre-commit hook 会停止并显示错误信息：

```
❌ ESLint 修复失败
```

此时需要：

1. 手动查看和修复报告的问题
2. 重新执行 `git add` 添加修复后的文件
3. 再次尝试提交

### 跳过 pre-commit hook（仅紧急情况）

```bash
git commit --no-verify -m "紧急修复"
```

⚠️ **不推荐使用**，只在紧急情况下使用

## 🛠️ 相关配置文件

- **Pre-commit Hook**: `.husky/pre-commit`
- **Prettier 配置**: `.prettierrc.json`
- **ESLint 配置**: `eslint.config.js`
- **Stylelint 配置**: `stylelint.config.js`
- **Package Scripts**: `package.json`

## 📚 相关命令

```bash
# 手动执行单个检查
bun run format           # 格式化代码
bun run stylelint:fix    # 修复样式问题
bun run lint:fix         # 修复代码质量问题

# 检查但不修复
bun run format:check     # 检查格式化
bun run stylelint        # 检查样式
bun run lint             # 检查代码质量

# 类型检查
bun run typecheck        # TypeScript 类型检查
```

## 🔄 工作流程

1. 开发者编写代码
2. 执行 `git add` 添加文件到暂存区
3. 执行 `git commit -m "提交信息"`
4. Pre-commit hook 自动运行：
   - Prettier 格式化
   - Stylelint 修复样式
   - ESLint 修复代码质量
   - 重新暂存修复后的文件
5. 提交成功

这个自动化流程确保了代码库的一致性和高质量，让团队成员能够专注于业务逻辑的实现，而不用担心代码格式和基本质量问题。
