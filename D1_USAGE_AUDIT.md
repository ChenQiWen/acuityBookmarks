# D1 代码使用情况审计

## ✅ 已迁移到 Supabase 的功能

### 订阅和支付相关 ✅

- ✅ `getUserSubscription` - 已迁移到 `backend/utils/supabase.js`
- ✅ `upsertSubscription` - 已迁移到 `backend/utils/supabase.js`
- ✅ `insertPaymentRecord` - 已迁移到 `backend/utils/supabase.js`
- ✅ `updateSubscriptionCancelStatus` - 已迁移到 `backend/utils/supabase.js`
- ✅ `lemon-squeezy-handler.js` - 已全部使用 Supabase

## ⚠️ 仍在使用 D1 的功能

### 1. 用户认证相关（`cloudflare-worker.js`）

- `persistUserEntitlements` (line 1972-2009)
  - OAuth 回调时写入用户和权限
  - 使用：`d1.upsertUser`、`d1.upsertEntitlements`
  - **状态**：需要迁移到 Supabase

### 2. 认证 API 端点（`cloudflare-worker.js`）

以下端点仍在使用 D1（通过 `mustD1` 函数）：

- `/api/auth/register` - 用户注册
- `/api/auth/login` - 用户登录
- `/api/auth/refresh` - 刷新令牌
- `/api/auth/forgot-password` - 忘记密码
- `/api/auth/reset-password` - 重置密码
- `/api/auth/change-password` - 修改密码
- `/api/user/me` - 获取用户信息
- `/api/user/nickname` - 更新昵称

**状态**：这些功能**仍在使用 D1**，但**应该已经迁移到 Supabase Auth**

### 3. Admin 接口（`cloudflare-worker.js`）

- `/api/admin/db/init` - 初始化 D1 数据库
- `/api/admin/db/stats` - D1 数据库统计
- `/api/admin/env/check` - 环境检查

**状态**：如果不再使用 D1，这些可以移除或标记为可选

### 4. Schema 初始化（`cloudflare-worker.js`）

- `ensureSchema` (line 645-657) - 懒加载初始化 D1 schema

**状态**：如果不再使用 D1，可以移除

## 📊 统计

- **已迁移**：订阅和支付相关（4个函数）
- **仍在使用 D1**：用户认证、权限管理、多个 API 端点
- **D1 文件**：`backend/utils/d1.js` 仍然存在（839行）
- **配置**：`wrangler.toml` 中仍有 D1 绑定

## 🎯 建议

### 选项 1：完全移除 D1（推荐）

如果所有功能都已迁移到 Supabase：

1. 移除 `backend/utils/d1.js`
2. 移除 `wrangler.toml` 中的 D1 绑定
3. 移除 `cloudflare-worker.js` 中所有 D1 相关代码
4. 更新所有 API 端点使用 Supabase

### 选项 2：保留 D1 作为降级方案（当前状态）

如果希望保留 D1 作为备用：

1. 保持 `backend/utils/d1.js` 存在
2. 代码中已有 `hasD1()` 检查，会自动降级
3. 如果没有配置 D1，代码会优雅降级

### 选项 3：部分迁移

只迁移订阅相关，保留用户认证在 D1：

- 当前状态：订阅已迁移 ✅
- 需要决定：用户认证是否也要迁移到 Supabase Auth
