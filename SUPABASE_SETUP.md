# Supabase 集成指南

## 📋 前置步骤

### 1. 注册 Supabase 账号

1. 访问 https://supabase.com
2. 点击 "Start your project"
3. 使用 GitHub 账号登录（推荐）或邮箱注册

### 2. 创建项目

1. 点击 "New Project"
2. 填写项目信息：
   - **Name**: `acuity-bookmarks`（或你喜欢的名字）
   - **Database Password**: 设置一个强密码（保存好！）
   - **Region**: 选择离你主要用户最近的区域（推荐 `US East (Ohio)` 或 `EU West (Ireland)`）
   - **Pricing Plan**: 选择 **Free**（免费版足够初期使用）

3. 等待项目创建完成（约 2 分钟）

### 3. 获取项目配置信息

1. 在项目 Dashboard，点击左侧 **Settings** → **API**
2. 找到以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（⚠️ 保密，仅后端使用）

### 4. 配置认证提供者（可选，但推荐）

#### Google OAuth

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目或选择现有项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端 ID：
   - **应用类型**: Web 应用
   - **授权重定向 URI**: `https://xxxxx.supabase.co/auth/v1/callback`
5. 复制 **Client ID** 和 **Client Secret**
6. 在 Supabase Dashboard → **Authentication** → **Providers** → **Google**
   - 启用 Google
   - 填入 Client ID 和 Client Secret
   - 保存

#### GitHub OAuth

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写信息：
   - **Application name**: `AcuityBookmarks`
   - **Homepage URL**: `https://yourdomain.com`
   - **Authorization callback URL**: `https://xxxxx.supabase.co/auth/v1/callback`
4. 复制 **Client ID** 和 **Client Secret**
5. 在 Supabase Dashboard → **Authentication** → **Providers** → **GitHub**
   - 启用 GitHub
   - 填入 Client ID 和 Client Secret
   - 保存

### 5. 配置 Chrome Extension 重定向 URL

1. 在 Supabase Dashboard → **Authentication** → **URL Configuration**
2. 添加 **Redirect URLs**:
   - `chrome-extension://YOUR_EXTENSION_ID/auth.html`
   - `chrome-extension://YOUR_EXTENSION_ID/*`（用于开发）

> **注意**: `YOUR_EXTENSION_ID` 需要替换为你的实际扩展 ID。开发时可以使用 `localhost` 测试。

---

## 🔧 环境变量配置

### 前端环境变量

在 `frontend/` 目录下创建 `.env.local` 文件：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 后端环境变量

在 `backend/wrangler.toml` 或 Cloudflare Dashboard 中添加：

```toml
[env.production.vars]
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **⚠️ 安全提示**:
>
> - `SUPABASE_ANON_KEY` 可以在前端使用（公开的）
> - `SUPABASE_SERVICE_ROLE_KEY` 必须保密，仅在后端使用

---

## 🧪 测试配置

### 1. 测试 Supabase 连接

```typescript
import { supabase } from '@/infrastructure/supabase/client'

// 检查配置
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase configured:', isSupabaseConfigured())
```

### 2. 测试邮箱注册

```typescript
const { signUp } = useSupabaseAuth()
await signUp('test@example.com', 'password123')
```

### 3. 测试社交登录

```typescript
const { signInWithOAuth } = useSupabaseAuth()
await signInWithOAuth('google')
```

---

## 📚 相关文档

- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript 客户端](https://supabase.com/docs/reference/javascript/introduction)
- [Chrome Extension OAuth 指南](https://supabase.com/docs/guides/auth/auth-helpers/chrome-extension)

---

## ✅ 完成检查清单

- [ ] Supabase 项目已创建
- [ ] 环境变量已配置（前端 `.env.local`）
- [ ] Google OAuth 已配置（可选）
- [ ] GitHub OAuth 已配置（可选）
- [ ] Chrome Extension 重定向 URL 已配置
- [ ] 测试邮箱注册成功
- [ ] 测试社交登录成功
