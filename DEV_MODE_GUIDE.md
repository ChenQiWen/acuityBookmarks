# 开发模式指南

## 📋 后端运行模式

### 1. **远程模式** (`bun run dev`)

```bash
cd backend
bun run dev
# 等同于: wrangler dev --remote
```

**特点：**

- ✅ 代码在 **Cloudflare 远程服务器** 运行
- ✅ 使用 **真实的 D1 数据库**（线上数据库）
- ✅ 保证与生产环境一致
- ⚠️ 代码修改需要重新部署才能生效
- ⚠️ 需要网络连接

**适用场景：**

- 测试与生产环境一致的行为
- 调试数据库相关问题
- 验证远程 Worker 功能

### 2. **本地模式** (`bun run dev:local`)

```bash
cd backend
bun run dev:local
# 等同于: wrangler dev --local
```

**特点：**

- ✅ 代码在 **本地运行**
- ✅ 使用 **本地 SQLite** 数据库（`/.wrangler/state/v3/d1/`）
- ✅ 代码修改**立即生效**（热重载）
- ✅ 无需网络连接（除 AI 等远程服务）
- ⚠️ 数据库与生产环境分离

**适用场景：**

- 日常开发（推荐）
- 快速迭代和调试
- 离线开发

---

## 🌐 API 配置逻辑

### 前端如何选择 API 地址？

根据 `frontend/src/config/constants.ts` 的逻辑：

```typescript
// 优先级顺序：
1. VITE_CLOUDFLARE_WORKER_URL 或 VITE_API_BASE_URL（环境变量）
2. 开发环境默认：https://localhost:8787
3. 生产环境默认：https://api.acuitybookmarks.com
```

### 自动检测机制

- **前端** `bun run dev` → 默认连接 `https://localhost:8787`
- **前端** `bun run build:hot` → 自动检测后端运行模式并设置正确的 URL

---

## 🚀 推荐的开发流程

### 方案 1：本地开发（推荐日常使用）

```bash
# 终端 1：启动后端（本地模式）
cd backend
bun run dev:local

# 终端 2：启动前端
cd frontend
bun run dev
# 或使用热构建（推荐）
bun run build:hot
```

**API 流向：**

```
前端 → https://localhost:8787 → 本地 Worker → 本地 SQLite
```

### 方案 2：远程开发（测试生产行为）

```bash
# 终端 1：启动后端（远程模式）
cd backend
bun run dev --remote
# 或
cd backend
bun run dev

# 终端 2：启动前端
cd frontend
# 需要设置环境变量指向远程 Worker
VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev bun run dev
```

**API 流向：**

```
前端 → https://acuitybookmarks.cqw547847.workers.dev → Cloudflare Worker → 真实 D1 数据库
```

---

## ⚙️ 环境变量配置

### `.env.development`（前端）

```bash
# Cloudflare 模式开关
VITE_CLOUDFLARE_MODE="true"

# API 地址（可选，默认自动检测）
# VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev
# VITE_API_BASE_URL=https://localhost:8787

# 爬虫配置（默认关闭自动爬取）
# VITE_CRAWLER_AUTO_STARTUP=false
# VITE_CRAWLER_AUTO_RELOAD=false
```

### 使用远程 Worker 的方式

**方式 1：设置环境变量**

```bash
VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev bun run dev
```

**方式 2：修改 `.env.development`**

```bash
VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev
```

---

## 🔍 如何检查当前使用的 API

打开浏览器控制台，查看日志：

```javascript
🔧 API_CONFIG.API_BASE: https://localhost:8787
🔧 VITE_CLOUDFLARE_WORKER_URL: undefined
🔧 VITE_API_BASE_URL: undefined
```

- 如果显示 `localhost:8787` → 使用本地后端
- 如果显示 `acuitybookmarks.cqw547847.workers.dev` → 使用远程后端

---

## ✅ 回答你的问题

### Q: 现在所有服务接口是不是都走远程了？

**A:** 取决于后端运行模式：

1. **如果运行 `bun run dev`（后端）**：
   - ✅ 是的，API 走远程 Cloudflare Worker
   - ✅ 使用真实 D1 数据库
   - ⚠️ 需要确保前端配置指向远程 Worker

2. **如果运行 `bun run dev:local`（后端）**：
   - ✅ 不是，API 走本地 Worker
   - ✅ 使用本地 SQLite 数据库
   - ✅ 这是**推荐的日常开发模式**

### Q: 需要使用 `bun run dev` 而不是 `bun run dev:local` 吗？

**A:** 取决于你的需求：

**使用 `bun run dev:local`（推荐）：**

- ✅ 日常开发
- ✅ 快速迭代
- ✅ 代码修改立即生效
- ✅ 不需要网络连接

**使用 `bun run dev`（远程模式）：**

- ✅ 测试生产环境行为
- ✅ 调试数据库问题
- ✅ 验证远程 Worker 功能

---

## 📝 总结

**默认配置：**

- 前端 `bun run dev` → 连接 `https://localhost:8787`
- 后端 `bun run dev:local` → 本地 Worker + 本地 SQLite
- 后端 `bun run dev` → 远程 Worker + 真实 D1

**最佳实践：**

1. 日常开发：使用 `dev:local`（本地模式）
2. 测试生产：使用 `dev`（远程模式）+ 设置前端环境变量
