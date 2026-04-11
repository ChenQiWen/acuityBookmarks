# Cloudflare 部署配置指南

本项目包含两个需要部署到 Cloudflare 的部分：

## 1. Backend (Cloudflare Workers)

### 自动部署（推荐）
通过 GitHub Action 自动部署，配置文件：`.github/workflows/cloudflare-workers-deploy.yml`

**触发条件**：
- 推送到 `main` 分支
- `backend/` 目录有变更

**所需 Secrets**：
在 GitHub 仓库设置中添加：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 手动部署
```bash
bun run deploy:backend
# 或
cd backend && bun run deploy
```

## 2. Website (Cloudflare Pages)

### ⚠️ 重要：Cloudflare Pages 配置

如果你在 Cloudflare Dashboard 中为整个仓库配置了 Pages 部署，会导致构建失败，因为根目录的 `build` 脚本是为 monorepo 设计的。

### 正确的 Cloudflare Pages 配置

在 Cloudflare Dashboard > Pages > 项目设置 > Build & deployments 中配置：

#### 选项 A：部署 Website（Nuxt 应用）

```
Framework preset: Nuxt.js
Build command: bun run build:website
Build output directory: website/.output/public
Root directory: (留空)
```

或者：

```
Framework preset: Nuxt.js
Build command: bun run build
Build output directory: .output/public
Root directory: website
```

#### 选项 B：部署 Frontend（Chrome Extension）

```
Framework preset: Vue
Build command: bun run build:frontend
Build output directory: frontend/dist
Root directory: (留空)
```

或者：

```
Framework preset: Vue
Build command: bun run build
Build output directory: dist
Root directory: frontend
```

### 环境变量

在 Cloudflare Pages 设置中添加：

```
SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
```

## 3. 当前错误的原因

错误日志显示：
```
error: Script not found "build"
```

这是因为 Cloudflare Pages 在**根目录**执行了 `bun install`，然后尝试运行 `bun run build`。

虽然根目录的 `package.json` 中有 `build` 脚本，但是：
1. Cloudflare 可能在依赖安装完成前就尝试运行构建
2. 或者 Cloudflare 使用了缓存的旧配置

## 4. 解决方案

### 立即修复

1. 登录 Cloudflare Dashboard
2. 进入 Pages 项目
3. 进入 Settings > Builds & deployments
4. 更新构建配置（见上方"正确的 Cloudflare Pages 配置"）
5. 触发重新部署

### 禁用自动部署（如果不需要 Pages）

如果你只需要 Workers（backend），不需要 Pages：

1. 在 Cloudflare Dashboard 中删除 Pages 项目
2. 或者在 Pages 设置中禁用 "Automatic deployments"
3. 只保留 GitHub Action 的 Workers 部署

## 5. 推荐的部署架构

```
┌─────────────────────────────────────────┐
│  GitHub Repository                      │
│  ├── backend/     → Workers (via Action)│
│  ├── website/     → Pages (manual/auto) │
│  └── frontend/    → Chrome Web Store    │
└─────────────────────────────────────────┘
         │                    │
         ↓                    ↓
    GitHub Action      Cloudflare Pages
         │                    │
         ↓                    ↓
  Cloudflare Workers   Cloudflare Pages
  api.acuitybookmarks.com   www.acuitybookmarks.com
```

## 6. 验证部署

### Backend (Workers)
```bash
curl https://api.acuitybookmarks.com/health
```

### Website (Pages)
访问：https://acuitybookmarks.pages.dev 或你的自定义域名

## 7. 常见问题

### Q: 为什么 GitHub Action 部署成功，但 Cloudflare 自动部署失败？

A: 因为 GitHub Action 在 `backend` 目录下工作，而 Cloudflare Pages 默认在根目录工作。需要在 Cloudflare Dashboard 中配置正确的构建命令和目录。

### Q: 我应该使用哪种部署方式？

A: 
- **Backend**: 使用 GitHub Action（已配置）
- **Website**: 使用 Cloudflare Pages 自动部署（需要正确配置）
- **Frontend**: 手动构建后上传到 Chrome Web Store

### Q: 如何禁用 Cloudflare 的自动构建？

A: 在 Cloudflare Pages 项目设置中，找到 "Builds & deployments" > "Build settings"，禁用 "Automatic deployments"。
