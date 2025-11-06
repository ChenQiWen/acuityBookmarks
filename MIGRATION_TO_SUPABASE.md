# 迁移到 Supabase 全栈方案指南

## 🎯 迁移目标

将订阅和支付数据从 Cloudflare D1 迁移到 Supabase PostgreSQL，实现全栈 Supabase 方案。

## ✅ 已完成的迁移

### 1. 后端代码迁移 ✅

- ✅ 创建了 `backend/utils/supabase.js`（Supabase 客户端工具）
- ✅ 更新了 `backend/lemon-squeezy-handler.js`（从 D1 改为 Supabase）
- ✅ 订阅查询：`getUserSubscription` → Supabase
- ✅ 订阅同步：`syncSubscriptionToSupabase` → Supabase
- ✅ 支付记录：`syncPaymentToSupabase` → Supabase
- ✅ 订阅取消/恢复：`updateSubscriptionCancelStatus` → Supabase

### 2. 依赖安装 ✅

- ✅ 已安装 `@supabase/supabase-js` 到 backend

## 📋 待完成步骤

### 步骤 1：配置 Supabase 数据库表结构

在 Supabase Dashboard 中运行 SQL：

```bash
# 在 Supabase Dashboard → SQL Editor 中执行
# 文件：backend/supabase-schema.sql
```

**或者使用 Supabase CLI：**

```bash
# 如果安装了 Supabase CLI
supabase db push
```

### 步骤 2：配置后端环境变量

在 Cloudflare Workers Dashboard 或 `wrangler.toml` 中添加：

```toml
# wrangler.toml 或 Cloudflare Dashboard Secrets
SUPABASE_URL = "https://ugxgxytykxblctsyulsg.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"  # 从 Supabase Dashboard 获取
```

**获取 Service Role Key：**

1. 登录 Supabase Dashboard
2. 进入 Project Settings → API
3. 复制 `service_role` key（⚠️ 保密，不要暴露给前端）

### 步骤 3：验证迁移

1. **测试订阅查询：**

   ```bash
   curl "https://your-worker-url/api/lemon-squeezy/subscription?user_id=test-user-id"
   ```

2. **测试 Webhook：**
   - 发送测试 webhook 到 `/api/lemon-squeezy/webhook`
   - 检查 Supabase Dashboard 中数据是否正确插入

3. **测试订阅取消/恢复：**
   ```bash
   curl -X POST "https://your-worker-url/api/lemon-squeezy/subscription/cancel" \
     -H "Content-Type: application/json" \
     -d '{"subscription_id": "test-id"}'
   ```

### 步骤 4：数据迁移（如果有现有数据）

如果有 D1 中的现有订阅和支付数据：

1. **导出 D1 数据：**

   ```sql
   -- 在 Cloudflare D1 Console 中执行
   SELECT * FROM subscriptions;
   SELECT * FROM payment_records;
   ```

2. **导入到 Supabase：**
   ```sql
   -- 在 Supabase SQL Editor 中执行
   -- 注意：需要转换时间戳格式（从毫秒转为 ISO 字符串）
   ```

### 步骤 5：移除 D1 相关代码（可选）

等确认迁移成功后，可以：

1. **标记 D1 为可选：**
   - 保留 `backend/utils/d1.js`（作为降级方案）
   - 代码中已有 `hasD1()` 检查，会自动降级

2. **或者完全移除：**
   - 删除 `backend/utils/d1.js`
   - 移除 `wrangler.toml` 中的 D1 binding
   - 清理所有 D1 相关代码

## 🔍 验证清单

- [ ] Supabase 表结构已创建（`subscriptions`, `payment_records`）
- [ ] 后端环境变量已配置（`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`）
- [ ] 订阅查询接口正常工作
- [ ] Webhook 能正确同步数据到 Supabase
- [ ] 订阅取消/恢复功能正常
- [ ] 前端订阅查询正常（如果前端有相关代码）

## ⚠️ 注意事项

1. **Service Role Key 保密：**
   - ⚠️ 不要暴露给前端
   - ⚠️ 只在后端使用
   - ⚠️ 不要提交到 Git

2. **RLS 策略：**
   - Supabase 表已启用 RLS
   - Service Role Key 可以绕过 RLS（这是预期的）

3. **数据格式：**
   - Supabase 使用 TIMESTAMPTZ（ISO 字符串）
   - D1 使用时间戳（毫秒）
   - 已自动转换

4. **降级方案：**
   - 代码中保留了 D1 降级逻辑
   - 如果 Supabase 未配置，会自动降级到 D1

## 🎯 下一步

1. **配置 Supabase 表结构**（运行 `supabase-schema.sql`）
2. **配置后端环境变量**（`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`）
3. **测试验证**（订阅查询、Webhook、取消/恢复）
4. **确认迁移成功**后，可以考虑移除 D1

## 📝 快速开始

### 1. 配置 Supabase 表结构（5分钟）

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目：`ugxgxytykxblctsyulsg`
3. 进入 **SQL Editor**
4. 复制 `backend/supabase-schema.sql` 的全部内容
5. 粘贴并执行

**验证：**

- 检查表是否创建成功：
  ```sql
  SELECT * FROM public.subscriptions LIMIT 1;
  SELECT * FROM public.payment_records LIMIT 1;
  ```

### 2. 配置后端环境变量（2分钟）

**方式 A：Cloudflare Dashboard（推荐）**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → 选择你的 Worker
3. 进入 **Settings** → **Variables**
4. 添加以下环境变量：

```
SUPABASE_URL = https://ugxgxytykxblctsyulsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（从 Supabase Dashboard 获取）
```

**方式 B：本地开发（wrangler.toml）**

在 `backend/wrangler.toml` 中添加：

```toml
[vars]
SUPABASE_URL = "https://ugxgxytykxblctsyulsg.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

**⚠️ 注意：** 不要将 `SUPABASE_SERVICE_ROLE_KEY` 提交到 Git！

### 3. 获取 Service Role Key

1. 登录 Supabase Dashboard
2. 进入 **Project Settings** → **API**
3. 找到 **service_role** key（⚠️ 保密）
4. 复制并配置到 Cloudflare Workers

### 4. 测试验证

```bash
# 启动后端（本地）
cd backend
bun run dev:hot

# 测试订阅查询（替换为真实的 user_id）
curl "https://localhost:8787/api/lemon-squeezy/subscription?user_id=test-user-id"
```

## ✅ 迁移完成后的优势

1. ✅ **架构简化**：单一数据源（Supabase）
2. ✅ **开发效率**：PostgreSQL 生态丰富
3. ✅ **功能完整**：Realtime、Storage 等
4. ✅ **性能足够**：对初创项目足够（10-15万用户）
5. ✅ **易于维护**：统一的技术栈

## 🔄 回滚方案（如果需要）

如果迁移后出现问题，可以：

1. **暂时禁用 Supabase**：不配置 `SUPABASE_SERVICE_ROLE_KEY`
2. **代码会自动降级**：使用 D1（如果配置了）
3. **或者回滚代码**：git revert 相关提交

## 📞 需要帮助？

如果遇到问题，检查：

1. Supabase 表结构是否正确创建
2. 环境变量是否正确配置
3. Service Role Key 是否正确
4. Cloudflare Worker 日志中的错误信息
