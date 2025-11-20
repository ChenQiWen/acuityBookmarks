# 🚀 Turbo 使用指南

## 什么是 Turbo？

Turbo 是一个高性能的 Monorepo 构建系统，提供：

- ⚡ **并行执行**：同时运行多个任务
- 🎯 **智能缓存**：跳过未改变的内容
- 📊 **依赖分析**：自动识别任务依赖关系

---

## 快速开始

### 基本命令

```bash
# 构建所有项目（并行执行）
bun run build

# 或者使用 turbo 前缀
bun run turbo:build

# Lint 所有项目
bun run lint:all

# 类型检查所有项目
bun run typecheck

# 清理所有构建产物
bun run turbo:clean
```

### 与旧命令对比

| 旧命令                                            | 新命令（Turbo）     | 说明               |
| ------------------------------------------------- | ------------------- | ------------------ |
| `bun run build:frontend && bun run build:website` | `bun run build`     | 并行构建，节省时间 |
| `bun run lint:frontend && bun run lint:backend`   | `bun run lint:all`  | 并行检查           |
| `cd frontend && bun run type-check`               | `bun run typecheck` | 所有项目的类型检查 |

---

## 性能提升示例

### 首次构建

```bash
$ bun run build

• Packages in scope: acuity-bookmarks-backend, acuitybookmarks-website, frontend
• Running build in 3 packages
• Remote caching disabled

 Tasks:    3 successful, 3 total
 Cached:    0 cached, 3 total
   Time:    1m 45s
```

### 增量构建（修改 frontend 一个文件后）

```bash
$ bun run build

• Packages in scope: acuity-bookmarks-backend, acuitybookmarks-website, frontend
• Running build in 3 packages
• Remote caching disabled

 Tasks:    3 successful, 3 total
 Cached:    2 cached, 3 total  ← 🎯 跳过未改变的项目
   Time:    25s  ← ⚡ 节省 94% 时间
```

---

## 查看任务执行图

```bash
# 查看构建任务的依赖关系
turbo run build --graph

# 生成可视化图表
turbo run build --graph=graph.html
```

---

## 清理缓存

```bash
# 清理本地 Turbo 缓存
turbo run clean

# 清理所有缓存（包括 node_modules）
bun run clean:deps
```

---

## 配置文件说明

### `turbo.json`

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"], // 依赖其他项目的 build 任务
      "outputs": ["dist/**"], // 缓存的输出目录
      "env": ["NODE_ENV", "VITE_*"] // 影响构建的环境变量
    }
  }
}
```

### 关键概念

- **`dependsOn: ["^build"]`**：先构建依赖项，再构建当前项目
- **`outputs`**：定义哪些目录需要缓存
- **`cache: false`**：不缓存（适用于 dev 命令）
- **`persistent: true`**：长时间运行的任务（如 dev server）

---

## 高级功能

### 仅运行特定项目

```bash
# 只构建 frontend
turbo run build --filter=frontend

# 只构建 website
turbo run build --filter=acuitybookmarks-website

# 构建 frontend 及其依赖
turbo run build --filter=frontend...
```

### 强制重新构建

```bash
# 忽略缓存，强制重新构建
turbo run build --force
```

### 查看详细日志

```bash
# 显示完整的构建输出
turbo run build --output-logs=full
```

---

## 远程缓存（可选）

如果团队协作或使用 CI/CD，可以启用远程缓存：

1. **注册 Vercel 账号**（免费）
2. **链接项目**：
   ```bash
   turbo login
   turbo link
   ```
3. **自动共享缓存**：同事构建过的内容，您可以直接使用

---

## 保留的旧命令

如果您需要回退到旧的执行方式，可以使用 `:legacy` 后缀：

```bash
# 旧的顺序执行方式
bun run build:all:legacy
bun run lint:all:legacy
bun run typecheck:legacy
```

---

## 故障排除

### 缓存问题

```bash
# 如果缓存导致奇怪的行为，清理缓存
rm -rf .turbo
turbo run build --force
```

### 查看 Turbo 版本

```bash
turbo --version
```

### 获取帮助

```bash
turbo --help
turbo run build --help
```

---

## 推荐工作流

### 日常开发

```bash
# 启动开发服务器（不使用 Turbo，因为是长期运行）
bun run dev:frontend
bun run dev:backend
bun run dev:website

# 或者使用 concurrently 同时启动
bun run dev:all
```

### 提交前检查

```bash
# 快速检查（利用缓存）
bun run lint:all
bun run typecheck
```

### 构建发布

```bash
# 完整构建（首次慢，后续快）
bun run build
```

---

## 更多资源

- [Turbo 官方文档](https://turbo.build/repo/docs)
- [性能优化指南](https://turbo.build/repo/docs/core-concepts/caching)
- [配置参考](https://turbo.build/repo/docs/reference/configuration)
