# Lemon Squeezy 集成指南

## 📋 前置步骤

### 1. 注册 Lemon Squeezy 账号

1. 访问 https://lemonsqueezy.com
2. 注册账号并完成邮箱验证
3. 完成店铺设置

### 2. 创建产品

1. 在 Lemon Squeezy Dashboard → **Products** → **Create Product**
2. 填写产品信息：
   - **Name**: `AcuityBookmarks Pro`
   - **Description**: `Pro subscription for AcuityBookmarks`
   - **Price**: 设置月度价格（如 $9.99）
3. 创建两个变体（Variants）：
   - **月度订阅**：$9.99/月
   - **年度订阅**：$99.99/年（推荐，节省 17%）
4. 保存后，复制每个变体的 **Variant ID**（格式：`123456`）

### 3. 获取 API 凭证

1. 在 Dashboard → **Settings** → **API**
2. 创建新的 API Key（如果还没有）
3. 复制以下信息：
   - **API Key**: `sk_live_xxxxx` 或 `sk_test_xxxxx`（测试模式）
   - **Store ID**: 在 Dashboard 首页可以看到
   - **Webhook Secret**: 在 **Settings** → **Webhooks** 中创建 Webhook 时生成

### 4. 配置 Webhook

1. 在 Dashboard → **Settings** → **Webhooks** → **Create Webhook**
2. 设置 Webhook URL：
   ```
   https://api.acuitybookmarks.com/api/lemon-squeezy/webhook
   ```
   或开发环境：
   ```
   https://your-worker.workers.dev/api/lemon-squeezy/webhook
   ```
3. 选择要监听的事件：
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_resumed`
   - `subscription_expired`
   - `subscription_payment_success`
   - `subscription_payment_failed`
   - `subscription_payment_recovered`
   - `order_created`
4. 保存后复制 **Webhook Secret**

---

## 🔧 环境变量配置

### 前端环境变量

在 `frontend/.env.local` 文件中添加：

```bash
# Lemon Squeezy 产品变体 ID
VITE_LEMON_SQUEEZY_VARIANT_ID_MONTHLY=123456  # 月度订阅变体 ID
VITE_LEMON_SQUEEZY_VARIANT_ID_YEARLY=123457  # 年度订阅变体 ID
```

### 后端环境变量（Cloudflare Workers）

在 Cloudflare Dashboard → **Workers** → **Settings** → **Variables** 中添加：

```bash
# Lemon Squeezy API 凭证
LEMON_SQUEEZY_API_KEY=sk_live_xxxxx  # 或 sk_test_xxxxx（测试模式）
LEMON_SQUEEZY_STORE_ID=12345
LEMON_SQUEEZY_WEBHOOK_SECRET=whsec_xxxxx

# Lemon Squeezy 产品变体 ID（用于 Webhook 处理）
LEMON_SQUEEZY_VARIANT_ID_MONTHLY=123456
LEMON_SQUEEZY_VARIANT_ID_YEARLY=123457

# 测试模式（可选，设置为 'true' 启用测试模式）
LEMON_SQUEEZY_TEST_MODE=false

# Supabase 配置（用于同步订阅状态）
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

或者在 `wrangler.toml` 中添加（仅用于本地开发）：

```toml
[vars]
LEMON_SQUEEZY_API_KEY = "sk_test_xxxxx"
LEMON_SQUEEZY_STORE_ID = "12345"
LEMON_SQUEEZY_WEBHOOK_SECRET = "whsec_xxxxx"
LEMON_SQUEEZY_VARIANT_ID_MONTHLY = "123456"
LEMON_SQUEEZY_VARIANT_ID_YEARLY = "123457"
LEMON_SQUEEZY_TEST_MODE = "true"
SUPABASE_URL = "https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🗄️ Supabase 数据库设置

### 1. 执行 SQL 脚本

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 执行 `backend/supabase-schema.sql` 文件中的所有 SQL 语句

这将创建以下表：

- `user_profiles` - 用户资料表
- `subscriptions` - 订阅表
- `payment_records` - 支付记录表

### 2. 验证表结构

在 SQL Editor 中执行：

```sql
-- 检查表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'subscriptions', 'payment_records');

-- 检查 RLS 策略
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

---

## 🧪 测试流程

### 1. 测试创建支付链接

```bash
curl -X POST https://api.acuitybookmarks.com/api/lemon-squeezy/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "123456",
    "user_id": "user-uuid-from-supabase",
    "email": "test@example.com"
  }'
```

### 2. 测试 Webhook（使用 ngrok 或类似工具）

```bash
# 使用 ngrok 暴露本地 Worker
ngrok http 8787

# 在 Lemon Squeezy Dashboard 中设置 Webhook URL 为：
# https://your-ngrok-url.ngrok.io/api/lemon-squeezy/webhook
```

### 3. 测试订阅查询

```bash
curl "https://api.acuitybookmarks.com/api/lemon-squeezy/subscription?user_id=user-uuid-from-supabase"
```

---

## 📚 相关文档

- [Lemon Squeezy API 文档](https://docs.lemonsqueezy.com/api)
- [Lemon Squeezy Webhooks 文档](https://docs.lemonsqueezy.com/help/webhooks)
- [Supabase 文档](https://supabase.com/docs)

---

## ✅ 完成检查清单

- [ ] Lemon Squeezy 账号已注册
- [ ] 产品已创建（月度 + 年度变体）
- [ ] API Key 已获取
- [ ] Webhook 已配置
- [ ] 前端环境变量已配置（`.env.local`）
- [ ] 后端环境变量已配置（Cloudflare Dashboard）
- [ ] Supabase 数据库表已创建
- [ ] 测试支付链接创建成功
- [ ] 测试 Webhook 接收成功
- [ ] 测试订阅查询成功

---

## ⚠️ 注意事项

1. **测试模式**：在开发阶段，使用 `sk_test_` 开头的 API Key，并设置 `LEMON_SQUEEZY_TEST_MODE=true`
2. **Webhook 安全**：确保 Webhook Secret 保密，不要提交到代码仓库
3. **用户 ID 映射**：确保 Lemon Squeezy 的 `custom.user_id` 字段正确映射到 Supabase 用户 ID
4. **错误处理**：Webhook 处理失败时，Lemon Squeezy 会重试，但建议添加日志监控

---

_最后更新：2025-01-27_
