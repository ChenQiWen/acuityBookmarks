# 验证 D1 数据库 + Supabase Auth 指南

## 🎯 目标

同时验证：

- ✅ **D1 数据库**（Cloudflare）：存储订阅、支付记录等
- ✅ **Supabase Auth**：用户认证和用户资料

---

## 📋 前置条件

### 1. D1 数据库

- ✅ 已在 Cloudflare Dashboard 创建 D1 数据库
- ✅ `wrangler.toml` 中已配置 D1 binding
- ✅ 数据库 ID: `e7126c65-435c-40d2-b8a8-f0718a0fe16a`

### 2. Supabase 项目

- ✅ 已在 Supabase Dashboard 创建项目
- ✅ 前端已配置 `.env.local`：
  ```bash
  VITE_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```

---

## 🚀 验证步骤

### 步骤 1：启动后端（远程模式）

**重要：必须使用远程模式才能访问真实的 D1 数据库**

```bash
cd backend
bun run dev
```

**或者明确指定远程模式：**

```bash
cd backend
bunx wrangler dev --remote --port 8787 --local-protocol https --https-cert-path ./localhost+2.pem --https-key-path ./localhost+2-key.pem
```

**验证后端启动成功：**

- 应该看到：`Ready on https://localhost:8787`
- 应该看到：`Connected to D1 database`

---

### 步骤 2：配置前端指向远程 Worker

**方式 1：使用环境变量（推荐）**

```bash
cd frontend
VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev bun run dev
```

**方式 2：修改 `.env.development`**

在 `frontend/.env.development` 中添加：

```bash
VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev
```

然后启动：

```bash
cd frontend
bun run dev
```

**方式 3：使用热构建（自动检测）**

```bash
cd frontend
bun run build:hot
```

---

### 步骤 3：验证配置

打开浏览器控制台，应该看到：

```javascript
// ✅ Supabase 配置
🔧 VITE_SUPABASE_URL: https://ugxgxytykxblctsyulsg.supabase.co
✅ Supabase 配置已加载

// ✅ API 配置（远程 Worker）
🔧 API_CONFIG.API_BASE: https://acuitybookmarks.cqw547847.workers.dev
```

---

## ✅ 验证清单

### D1 数据库验证

1. **后端日志检查**

   ```bash
   # 应该看到：
   Connected to D1 database: acuitybookmarks
   ```

2. **API 测试**

   ```bash
   # 测试健康检查
   curl https://acuitybookmarks.cqw547847.workers.dev/api/health

   # 测试 D1 统计（需要认证）
   curl https://acuitybookmarks.cqw547847.workers.dev/api/admin/db/stats
   ```

3. **在 Cloudflare Dashboard 查看**
   - 访问：https://dash.cloudflare.com
   - Workers & Pages → D1 → acuitybookmarks
   - 查看表和数据

### Supabase Auth 验证

1. **前端日志检查**

   ```javascript
   // 控制台应该看到：
   ✅ Supabase 配置已加载
   ```

2. **功能测试**
   - ✅ 打开扩展设置页面 → 账户标签
   - ✅ 尝试注册新账号
   - ✅ 尝试登录
   - ✅ 尝试社交登录（Google/GitHub）

3. **在 Supabase Dashboard 查看**
   - 访问：https://supabase.com/dashboard/project/ugxgxytykxblctsyulsg
   - Authentication → Users（查看注册的用户）
   - Database → user_profiles（查看用户资料）

---

## 🔧 完整的启动命令

### 终端 1：后端（远程模式 + D1）

```bash
cd backend
bun run dev
```

**输出示例：**

```
╭─────────────────────────────────────────────────────────────────────╮
│ wrangler dev                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Your Worker is running remotely with D1 database                    │
│ Listening on https://localhost:8787                                 │
│ Connected to D1: acuitybookmarks                                   │
╰─────────────────────────────────────────────────────────────────────╯
```

### 终端 2：前端（指向远程 Worker + Supabase）

```bash
cd frontend
VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev bun run dev
```

**或者使用热构建：**

```bash
cd frontend
bun run build:hot
```

---

## 📊 数据流向

```
前端 (Vue)
    ↓
    ├─ Supabase Auth API (认证)
    │   └─ Supabase 数据库 (user_profiles)
    │
    └─ Cloudflare Worker API (业务数据)
        └─ D1 数据库 (订阅、支付记录)
```

---

## ⚠️ 常见问题

### Q: 为什么必须用远程模式？

**A:**

- D1 数据库只在 Cloudflare 云端可用
- 本地模式使用 SQLite，无法访问真实的 D1
- 远程模式才能验证真实的 D1 数据库操作

### Q: Supabase Auth 需要后端运行吗？

**A:**

- ✅ **不需要**！Supabase Auth 是前端直接连接的
- ⚠️ 但如果后端 API 需要验证用户身份，则需要后端运行
- 后端只需要 Supabase URL（用于 Lemon Squeezy 回调）

### Q: 如何确认 D1 连接成功？

**A:**

- 查看后端日志：`Connected to D1 database`
- 测试 API：`/api/admin/db/stats`
- 在 Cloudflare Dashboard 查看数据库

### Q: 如何确认 Supabase Auth 连接成功？

**A:**

- 查看前端控制台：没有 Supabase 配置警告
- 尝试注册/登录功能
- 在 Supabase Dashboard 查看用户

---

## 🎯 快速验证命令

```bash
# 终端 1：后端（远程模式）
cd backend && bun run dev

# 终端 2：前端（指向远程 Worker）
cd frontend && VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev bun run dev
```

---

## ✅ 验证成功标志

1. **后端日志**：

   ```
   ✅ Connected to D1 database
   ✅ Ready on https://localhost:8787
   ```

2. **前端控制台**：

   ```
   ✅ Supabase 配置已加载
   ✅ API_CONFIG.API_BASE: https://acuitybookmarks.cqw547847.workers.dev
   ```

3. **功能测试**：
   - ✅ 可以注册账号（Supabase Auth）
   - ✅ 可以登录（Supabase Auth）
   - ✅ 订阅状态可以保存（D1 数据库）

---

## 📝 总结

**验证 D1 + Supabase Auth 需要的命令：**

```bash
# 1. 后端：远程模式（访问真实 D1）
cd backend
bun run dev

# 2. 前端：指向远程 Worker（配合 D1）+ Supabase 配置
cd frontend
VITE_CLOUDFLARE_WORKER_URL=https://acuitybookmarks.cqw547847.workers.dev bun run dev
```

**关键点：**

- ✅ D1 需要远程模式才能访问
- ✅ Supabase Auth 是前端直接连接，不依赖后端模式
- ✅ 但后端 API 功能需要远程模式才能与 D1 配合
