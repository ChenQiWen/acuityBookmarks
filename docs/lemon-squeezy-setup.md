# Lemon Squeezy 配置指南

本文档介绍如何注册和配置 Lemon Squeezy 以支持 AcuityBookmarks 的订阅付费功能。

## 📋 前置要求

- 已注册 Supabase 账号（用于存储订阅数据）
- 已部署 Cloudflare Workers（用于处理支付逻辑）
- 准备一个邮箱用于接收支付通知

## 🚀 第一步：注册 Lemon Squeezy 账号

1. 访问 [Lemon Squeezy 官网](https://lemonsqueezy.com/)
2. 点击 "Sign Up" 注册账号
3. 填写基本信息（邮箱、密码等）
4. 验证邮箱

## 🏪 第二步：创建 Store（商店）

1. 登录后，进入 Dashboard
2. 点击 "Stores" → "Create Store"
3. 填写商店信息：
   - **Store Name**: `AcuityBookmarks`（或你喜欢的名称）
   - **Store URL**: `https://acuitybookmarks.com`（你的网站地址）
   - **Timezone**: 选择你的时区
4. 保存后，记录 **Store ID**（后续配置需要）

## 🔑 第三步：获取 API Key

1. 在 Dashboard 中，点击右上角头像 → "Settings"
2. 选择 "API" 标签
3. 点击 "Create API Key"
4. 填写名称（如：`AcuityBookmarks Production`）
5. 选择权限：
   - ✅ `Read` - 读取订阅信息
   - ✅ `Write` - 创建支付链接
6. 复制 **API Key**（只显示一次，请妥善保存）

## 📦 第四步：创建产品（Product）

1. 在 Dashboard 中，点击 "Products" → "Create Product"
2. 填写产品信息：
   - **Product Name**: `AcuityBookmarks Pro`
   - **Description**: `Pro subscription for AcuityBookmarks`
   - **Price**: 选择 "Recurring"（订阅模式）
3. 创建两个变体（Variants）：

### 月度计划（Monthly）

- **Name**: `Pro Monthly`
- **Price**: `$9.99`
- **Billing Interval**: `Monthly`
- **Trial Period**: `0 days`（或根据需要设置）
- 保存后，记录 **Variant ID**

### 年度计划（Yearly）

- **Name**: `Pro Yearly`
- **Price**: `$99.99`
- **Billing Interval**: `Yearly`
- **Trial Period**: `0 days`
- 保存后，记录 **Variant ID**

## 🔔 第五步：配置 Webhook

1. 在 Dashboard 中，点击 "Settings" → "Webhooks"
2. 点击 "Create Webhook"
3. 填写 Webhook 信息：
   - **Name**: `AcuityBookmarks Webhook`
   - **URL**: `https://acuitybookmarks.cqw547847.workers.dev/api/lemon-squeezy/webhook`
     （替换为你的 Cloudflare Workers URL）
   - **Events**: 选择以下事件：
     - ✅ `subscription_created`
     - ✅ `subscription_updated`
     - ✅ `subscription_cancelled`
     - ✅ `subscription_resumed`
     - ✅ `subscription_expired`
     - ✅ `order_created`
     - ✅ `subscription_payment_success`
     - ✅ `subscription_payment_failed`
     - ✅ `subscription_payment_recovered`
4. 保存后，复制 **Webhook Secret**（用于验证签名）

## ⚙️ 第六步：配置 Cloudflare Workers

在 Cloudflare Workers Dashboard 中，添加以下 Secrets：

```bash
# 使用 Wrangler CLI 设置（推荐）
cd backend
wrangler secret put LEMON_SQUEEZY_API_KEY
wrangler secret put LEMON_SQUEEZY_STORE_ID
wrangler secret put LEMON_SQUEEZY_WEBHOOK_SECRET
```

或者在 Cloudflare Dashboard 中：

1. 进入 Workers & Pages → 选择你的 Worker
2. 点击 "Settings" → "Variables"
3. 在 "Environment Variables" 中添加：
   - `LEMON_SQUEEZY_API_KEY` = 你的 API Key
   - `LEMON_SQUEEZY_STORE_ID` = 你的 Store ID
   - `LEMON_SQUEEZY_WEBHOOK_SECRET` = 你的 Webhook Secret

## 🔧 第七步：配置前端环境变量

在 `.env` 或 `.env.production` 文件中添加：

```bash
VITE_LEMON_SQUEEZY_VARIANT_ID_MONTHLY=你的月度计划 Variant ID
VITE_LEMON_SQUEEZY_VARIANT_ID_YEARLY=你的年度计划 Variant ID
```

## ✅ 验证配置

### 1. 测试创建支付链接

```bash
curl -X POST https://acuitybookmarks.cqw547847.workers.dev/api/lemon-squeezy/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "你的月度计划 Variant ID",
    "user_id": "测试用户ID",
    "email": "test@example.com"
  }'
```

应该返回：

```json
{
  "success": true,
  "checkout_url": "https://..."
}
```

### 2. 测试 Webhook

1. 在 Lemon Squeezy Dashboard 中，找到你的 Webhook
2. 点击 "Send Test Event"
3. 检查 Cloudflare Workers 日志，确认收到事件

### 3. 测试完整流程

1. 在前端选择计划
2. 点击"选择月度计划"或"选择年度计划"
3. 应该跳转到 Lemon Squeezy 支付页面
4. 使用测试卡号支付（见下方）
5. 支付成功后，检查 Supabase 数据库中的 `subscriptions` 表

## 🧪 测试卡号

Lemon Squeezy 使用 Stripe 测试模式，可以使用以下测试卡号：

| 卡号                  | 用途           |
| --------------------- | -------------- |
| `4242 4242 4242 4242` | 成功支付       |
| `4000 0000 0000 0002` | 支付被拒绝     |
| `4000 0000 0000 9995` | 需要 3D Secure |

- **CVV**: 任意 3 位数字
- **过期日期**: 任意未来日期
- **ZIP**: 任意 5 位数字

## 📊 监控和调试

### 查看支付记录

1. Lemon Squeezy Dashboard → "Orders"
2. 查看所有订单和支付记录

### 查看订阅状态

1. Lemon Squeezy Dashboard → "Subscriptions"
2. 查看所有订阅及其状态

### 查看 Webhook 日志

1. Lemon Squeezy Dashboard → "Settings" → "Webhooks"
2. 点击你的 Webhook，查看 "Recent Deliveries"
3. 检查 Cloudflare Workers 日志（`wrangler tail`）

## 🔒 安全注意事项

1. **API Key** 和 **Webhook Secret** 必须保密，不要提交到代码仓库
2. 使用 Cloudflare Workers Secrets 存储敏感信息
3. Webhook 必须验证签名，防止伪造请求
4. 生产环境使用 HTTPS

## 💰 费用说明

Lemon Squeezy 的费用结构：

- **交易手续费**: 3.5% + $0.30/笔
- **无月费**: 没有固定月费
- **退款**: 退款时手续费不退还

示例：

- $9.99 月度订阅：$9.99 × 3.5% + $0.30 = $0.65 手续费
- $99.99 年度订阅：$99.99 × 3.5% + $0.30 = $3.80 手续费

## 🆘 常见问题

### Q: Webhook 没有收到事件？

A: 检查：

1. Webhook URL 是否正确
2. Cloudflare Workers 是否已部署
3. Webhook Secret 是否配置正确
4. 查看 Lemon Squeezy Webhook 日志

### Q: 支付链接创建失败？

A: 检查：

1. API Key 是否正确
2. Store ID 是否正确
3. Variant ID 是否存在
4. 查看 Cloudflare Workers 日志

### Q: 订阅状态没有同步到 Supabase？

A: 检查：

1. Webhook 是否配置正确
2. Supabase 环境变量是否正确
3. 查看 Cloudflare Workers 日志
4. 检查 Supabase 数据库表结构

## 📚 相关资源

- [Lemon Squeezy 官方文档](https://docs.lemonsqueezy.com/)
- [Lemon Squeezy API 文档](https://docs.lemonsqueezy.com/api)
- [Webhook 事件列表](https://docs.lemonsqueezy.com/help/webhooks/webhook-events)

## ✅ 配置检查清单

- [ ] 已注册 Lemon Squeezy 账号
- [ ] 已创建 Store 并记录 Store ID
- [ ] 已创建 API Key 并记录
- [ ] 已创建产品（Pro Monthly 和 Pro Yearly）
- [ ] 已记录两个 Variant ID
- [ ] 已配置 Webhook 并记录 Secret
- [ ] 已在 Cloudflare Workers 中配置所有 Secrets
- [ ] 已在前端配置 Variant ID 环境变量
- [ ] 已测试创建支付链接
- [ ] 已测试 Webhook 接收
- [ ] 已测试完整支付流程

---

配置完成后，你的订阅付费功能就可以正常工作了！🎉
