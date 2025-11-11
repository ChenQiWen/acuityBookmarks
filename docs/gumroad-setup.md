# Gumroad 集成配置指南

本文档记录如何将 AcuityBookmarks 的订阅付费流程接入 Gumroad，并与现有 Supabase 与 Cloudflare Worker 架构对接。

## 📋 前置准备

- Gumroad 账号（Creator）并完成邮箱验证
- PayPal 账户（可收款）
- Supabase 项目的 Service Role Key（已在项目中配置）
- Cloudflare Workers 部署权限

## 🪄 第一步：创建 Membership 产品

1. 登录 Gumroad Dashboard
2. 左侧导航选择 `Products` → `New product`
3. Product 类型选择 **Membership**
4. 填写基本信息：
   - **Name**：`Acuity Bookmarks Pro`
   - **URL（Slug）**：如 `acuity-pro`
   - **Description**：可使用以下文案（可自定义）
     ```
     Acuity Bookmarks Pro unlocks the full power of your browser bookmarks.
     Perfect for researchers, makers, and knowledge workers managing thousands of links.
     ```
5. 在 “Tiers”（订阅层级）中新建两个计划：
   - **Pro Monthly**：价格 `$4.99`，周期 `Monthly`
   - **Pro Yearly**：价格 `$39.99`，周期 `Yearly`
   - 可选描述：
     - Monthly：`Unlock all AI-powered features with a flexible monthly plan.`
     - Yearly：`Best value — save 33% with the annual plan.`
6. 其他设置建议：
   - Offer a free trial：关闭
   - Members will lose access when their memberships end：开启
   - 其余选项保持默认
7. 点击右上角 `Save` 或 `Publish` 保存产品

### 获取 Plan ID 与分享链接

**方法 1：从 Tier 卡片获取（推荐）**

1. 在产品编辑页面，找到 "Tiers" 部分
2. 每个 Tier 卡片（如 "Pro Monthly"、"Pro Yearly"）右上角有一个 `Share` 按钮
3. 点击 `Share` 按钮，会显示一个链接，格式类似：
   ```
   https://<username>.gumroad.com/l/acuity-pro?plan=<PLAN_ID>
   ```
4. 从 URL 中提取 `plan=` 后面的值，这就是 **Plan ID**
5. 记录两个 Plan ID：
   - **Monthly Plan ID**：从 "Pro Monthly" 的 Share 链接中提取
   - **Yearly Plan ID**：从 "Pro Yearly" 的 Share 链接中提取

**方法 2：从产品 URL 获取**

1. 在产品编辑页面，找到 "URL" 字段
2. 完整的产品链接格式：`https://<username>.gumroad.com/l/<slug>`
3. 例如：`https://cqw5478.gumroad.com/l/acuity-pro`
4. 这个链接就是 `VITE_GUMROAD_PRODUCT_URL` 的值

**方法 3：从浏览器地址栏获取（如果已发布）**

1. 访问你的产品页面（已发布状态）
2. 在浏览器地址栏可以看到完整 URL
3. 如果 URL 中包含 `?plan=xxxxx`，那就是 Plan ID

## 💰 第二步：配置收款方式

1. 进入左下角 `Settings` → `Payout`
2. 选择 `PayPal`（中国大陆可用）并完成绑定
3. 若 Gumroad 需要税务信息，按照向导填写 W-8BEN（个人开发者）

## 🔐 第三步：配置 Webhook（使用 Ping 功能）

Gumroad 使用 **Ping** 功能来实现 Webhook 通知。

### 配置 Ping Endpoint

1. 登录 Gumroad Dashboard
2. 左侧导航点击 `Settings` → `Advanced`
3. 找到 **Ping** 部分
4. 在 **Ping endpoint** 输入框中填写你的 Webhook URL：
   ```
   https://你的worker域名/api/gumroad/webhook
   ```
   例如：
   ```
   https://acuitybookmarks.cqw547847.workers.dev/api/gumroad/webhook
   ```
5. 点击 **`Send test ping to URL`** 按钮测试连接
6. 如果测试成功，Gumroad 会发送一个测试请求到你的 Worker
7. 检查 Cloudflare Worker 日志（`wrangler tail`）确认收到请求

### 关于 Webhook Secret

**重要发现**：Gumroad 的 Ping 功能可能**不使用传统的 Webhook Secret 签名验证**。

根据 Gumroad 的文档，Ping 请求可能：

- 使用 `seller_id` 进行验证（页面会显示你的 `seller_id`）
- 或者不使用签名验证（需要你在后端添加其他验证方式）

**建议处理方式**：

1. **方案 A（推荐）**：在 Worker 中验证请求来源 IP 或使用 `seller_id`
2. **方案 B**：如果 Gumroad 提供了 Secret，在创建 Application 时可能会显示
3. **方案 C**：暂时不验证签名，先测试功能是否正常

### 创建 Application（可选，用于 API Token）

如果你需要 Gumroad API Token（用于查询订阅状态等）：

1. 在 `Settings` → `Advanced` → **Applications** 部分
2. 点击 **`Create application`** 链接
3. 填写应用信息
4. 创建后可能会显示 API Token 和 Secret

### 关于 seller_id

在 Ping 部分，Gumroad 会显示你的 `seller_id`（例如：`KfQ41YqCGgrs0eqvVHBMXA==`）。

这个 `seller_id` 可以用于：

- 验证请求来源（可选）
- 调用 Gumroad API（如果需要）

**注意**：`seller_id` 不是 Webhook Secret，Ping 功能可能不使用签名验证。

## ⚙️ 第四步：更新环境变量

### Cloudflare Worker（`wrangler.toml` / Dashboard）

**必需配置**：

```
GUMROAD_PLAN_ID_MONTHLY=<Plan ID>
GUMROAD_PLAN_ID_YEARLY=<Plan ID>
```

**可选配置**（如果 Gumroad 提供了 Secret）：

```
GUMROAD_WEBHOOK_SECRET=<Webhook Secret>
```

**注意**：

- Gumroad 的 Ping 功能可能不使用签名验证
- 如果未配置 `GUMROAD_WEBHOOK_SECRET`，系统会跳过签名验证（仅用于开发测试）
- 生产环境建议配置 Secret 或使用其他验证方式（如 IP 白名单）

如需要使用 Gumroad API，可额外配置：

```
GUMROAD_ACCESS_TOKEN=<可选的 API Token>
GUMROAD_SELLER_ID=<你的 seller_id>（从 Ping 页面获取）
```

### 前端 `.env`

```
VITE_GUMROAD_PRODUCT_URL=https://<username>.gumroad.com/l/acuity-pro
VITE_GUMROAD_PLAN_ID_MONTHLY=<Plan ID>
VITE_GUMROAD_PLAN_ID_YEARLY=<Plan ID>
VITE_GUMROAD_MANAGE_URL=https://app.gumroad.com/subscriptions
```

> `VITE_GUMROAD_MANAGE_URL` 可使用 Gumroad 默认订阅管理地址或自定义落地页。

## 🌐 第五步：Ping 测试

1. 在 Gumroad `Settings` → `Advanced` → **Ping** 部分
2. 填写 Ping endpoint URL 后，点击 **`Send test ping to URL`** 按钮
3. 在 Cloudflare Worker 中运行 `wrangler tail` 查看日志
4. 应该看到 `[Gumroad] Webhook 处理完成` 的日志
5. 检查 Supabase `subscriptions` 表，确认收到测试数据（如果有）

**如果测试失败**：

- 检查 Worker 是否已部署
- 检查 URL 是否正确
- 查看 Worker 日志中的错误信息

## ✅ 验证流程

1. 登录 AcuityBookmarks → 设置 → 计划
2. 点击“选择月度/年度计划”
3. 页面应跳转到 Gumroad Checkout，预选对应 Plan；URL 中包含：
   - `plan=<PLAN_ID>`
   - `custom_fields[user_id]=<Supabase 用户 ID>`
4. 订阅完成后，Gumroad Webhook 会回调 Worker → 更新 Supabase → 前端 `useSubscription` 查询到最新状态
5. Pro 用户可通过“管理订阅”按钮跳转至 Gumroad 的订阅管理页进行取消/续订

## 🧾 退款与异常提醒

- Gumroad 会在退款、失败扣款时同样触发 Webhook，系统会同步到 Supabase
- 若需要在应用内提示，可监听 `payment_records` 表或扩展通知逻辑

## 📌 常见问题

| 问题                  | 处理建议                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| Ping 测试失败         | 检查 Worker URL 是否正确，确认 Worker 已部署，查看 `wrangler tail` 日志   |
| 找不到 Webhook Secret | Gumroad 的 Ping 功能可能不使用 Secret，可以暂时不配置，系统会跳过签名验证 |
| 无法匹配用户          | 确保 Checkout URL 附带 `custom_fields[user_id]`，且用户已登录             |
| Plan 未预选           | 检查环境变量中 Plan ID 是否填写正确，并确认 Gumroad 提供的链接格式        |
| 订阅无法取消          | 目前通过 Gumroad 官方管理页处理，应用内提供跳转按钮                       |

## 🔄 迁移提醒

若未来需要迁移到其他支付平台（如 Paddle、Stripe），请确保：

- 保留 Supabase 中的订阅数据结构（字段可逐渐泛化）
- 在新的支付入口继续传递 `user_id` 自定义字段，保持 webhook → Supabase 同步链路

完成以上配置后，即可在 Gumroad 上开始收款，并通过现有的前后端逻辑同步订阅状态。🎉
