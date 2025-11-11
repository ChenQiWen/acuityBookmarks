# 支付服务提供商对比与迁移指南

## ✅ 当前实施方案：Gumroad

我们已采用 **Gumroad Membership** 作为现阶段的订阅付费解决方案。

**选择理由：**

- ✅ 上线速度快：个人开发者注册即可使用，资料要求极低
- ✅ 对中国开发者友好：支持 PayPal 提现，无需海外银行账户
- ✅ MoR 模式：Gumroad 代收 VAT/GST，省去税务合规负担
- ✅ 支持订阅：会员计划可配置 `$4.99/月` 与 `$39.99/年` 两种周期
- ✅ Webhook 简单：可携带 `custom_fields` 映射 Supabase 用户 ID
- ✅ 体验稳定：无需额外审核或表单，直接可用

**集成要点：**

- Checkout 直接跳转 Gumroad Hosted 页面
- URL 携带 `custom_fields[user_id]` 以便 Webhook 回写 Supabase
- Cloudflare Worker 验证 `X-Gumroad-Signature` 并同步订阅状态
- 前端提供“管理订阅”按钮，跳转 Gumroad 官方订阅管理页

详细配置步骤见 `docs/gumroad-setup.md`。

---

## 📊 替代方案对比

### 1. **Paddle** ⭐ 中期升级方案

**优势：**

- ✅ **最接近 Lemon Squeezy**：API 设计类似，迁移成本低
- ✅ **支持 PayPal 收款**：完美支持 PayPal 作为收款方式
- ✅ **对中国友好**：支持中国用户注册和收款
- ✅ **订阅管理完善**：自动处理订阅、续费、取消
- ✅ **税务处理**：自动处理 VAT、销售税等
- ✅ **Webhook 完善**：事件通知系统完善
- ✅ **客服响应快**：社区反馈客服响应及时

**劣势：**

- ⚠️ 手续费稍高：5% + $0.50/笔（比 Lemon Squeezy 的 3.5% + $0.30 高）
- ⚠️ 需要企业注册（个人开发者可能受限）

**费用：**

- 交易手续费：5% + $0.50/笔
- 无月费

**适用场景：**

- 需要 PayPal 收款
- 需要类似 Lemon Squeezy 的体验
- 需要快速迁移

**文档：**

- [Paddle 官网](https://paddle.com/)
- [Paddle API 文档](https://developer.paddle.com/)
- [Paddle Webhooks](https://developer.paddle.com/webhooks)

---

### 2. **Stripe** ⭐ 远期备选

**优势：**

- ✅ **功能最强大**：支付、订阅、发票、税务一应俱全
- ✅ **全球覆盖**：支持 40+ 国家
- ✅ **API 完善**：文档详细，SDK 丰富
- ✅ **开发者友好**：社区活跃，问题解决快
- ✅ **支持 PayPal**：通过 Stripe 可以接受 PayPal 支付

**劣势：**

- ❌ **对中国用户支持有限**：中国用户无法直接注册 Stripe 账号收款
- ❌ **迁移成本较高**：API 设计不同，需要更多改造
- ⚠️ 需要更多开发工作：订阅管理需要自己实现更多逻辑

**费用：**

- 标准费率：2.9% + $0.30/笔（在线支付）
- PayPal 支付：3.6% + $0.30/笔
- 订阅：2.9% + $0.30/笔（首次），之后 0.5%/笔（续费）

**适用场景：**

- 有海外公司/银行账户
- 需要最强大的功能
- 愿意投入更多开发时间

**文档：**

- [Stripe 官网](https://stripe.com/)
- [Stripe API 文档](https://stripe.com/docs/api)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)

---

### 3. **PayPal Subscriptions** ⚠️ 不推荐（除非只想用 PayPal）

**优势：**

- ✅ **直接使用 PayPal**：无需第三方
- ✅ **对中国友好**：PayPal 中国可用

**劣势：**

- ❌ **开发工作量大**：需要自己实现订阅管理、Webhook、状态同步
- ❌ **功能有限**：缺少税务处理、发票等高级功能
- ❌ **API 复杂**：PayPal API 相对复杂
- ❌ **维护成本高**：需要自己处理所有订阅逻辑

**费用：**

- 标准费率：3.4% + 固定费用（根据货币）
- 无月费

**适用场景：**

- 只想用 PayPal
- 愿意投入大量开发时间
- 不需要复杂功能

**文档：**

- [PayPal Subscriptions](https://developer.paypal.com/docs/subscriptions/)
- [PayPal API](https://developer.paypal.com/docs/api/overview/)

---

### 4. **Ping++** 🇨🇳 仅限中国市场

**优势：**

- ✅ **中国本土**：专为中国市场设计
- ✅ **支持多种支付方式**：微信、支付宝、银联等

**劣势：**

- ❌ **仅限中国市场**：不适合国际化产品
- ❌ **不支持 PayPal**：主要面向中国支付方式
- ❌ **不适合 Chrome 扩展**：主要面向移动应用

**适用场景：**

- 仅面向中国市场
- 需要微信/支付宝支付

---

## 🎯 推荐方案

### 首选：**Paddle**

**理由：**

1. ✅ 最接近 Lemon Squeezy，迁移成本最低
2. ✅ 完美支持 PayPal 收款
3. ✅ 对中国用户友好
4. ✅ 订阅管理完善，减少开发工作
5. ✅ 客服响应快

**迁移工作量：** ⭐⭐☆☆☆（中等，约 2-3 天）

---

### 备选：**Stripe**

**理由：**

1. ✅ 功能最强大
2. ✅ 支持 PayPal（通过 Stripe）
3. ⚠️ 但需要海外账户才能收款

**迁移工作量：** ⭐⭐⭐☆☆（较高，约 5-7 天）

---

## 📋 迁移步骤（以 Paddle 为例）

### 第一步：注册 Paddle 账号

1. 访问 [Paddle 官网](https://paddle.com/)
2. 点击 "Sign Up" 注册
3. 选择账户类型（个人/企业）
4. 验证邮箱

### 第二步：配置收款方式

1. 进入 Dashboard → "Settings" → "Payouts"
2. 选择 "PayPal" 作为收款方式
3. 连接你的 PayPal 账户
4. 完成身份验证

### 第三步：创建产品

1. Dashboard → "Products" → "Create Product"
2. 创建 "AcuityBookmarks Pro" 产品
3. 设置价格：
   - 月度：$9.99/月
   - 年度：$99.99/年
4. 记录 **Product ID** 和 **Price ID**

### 第四步：获取 API Key

1. Dashboard → "Developer Tools" → "Authentication"
2. 创建 API Key
3. 记录 **API Key** 和 **Publishable Key**

### 第五步：配置 Webhook

1. Dashboard → "Developer Tools" → "Notifications"
2. 创建 Webhook
3. URL: `https://acuitybookmarks.cqw547847.workers.dev/api/paddle/webhook`
4. 选择事件：
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.past_due`
   - `transaction.completed`
5. 记录 **Webhook Secret**

### 第六步：代码迁移

需要修改的文件：

- `backend/gumroad-handler.js`（当前活跃实现）
- `frontend/src/infrastructure/paddle/client.ts`（新建）
- `frontend/src/composables/useSubscription.ts`（修改导入）
- `frontend/src/types/subscription/plan.ts`（修改 Variant ID 为 Price ID）
- `backend/cloudflare-worker.js`（修改路由）

---

## 🔄 API 对比

### Lemon Squeezy → Paddle

| 功能         | Lemon Squeezy                    | Paddle                           |
| ------------ | -------------------------------- | -------------------------------- |
| 创建支付链接 | `POST /v1/checkouts`             | `POST /transactions`             |
| 查询订阅     | `GET /v1/subscriptions/:id`      | `GET /subscriptions/:id`         |
| Webhook 签名 | HMAC SHA256                      | HMAC SHA256                      |
| 订阅状态     | `active`, `cancelled`, `expired` | `active`, `canceled`, `past_due` |

### 主要差异

1. **API 端点不同**：Paddle 使用 `/transactions` 而不是 `/checkouts`
2. **字段名称不同**：`variant_id` → `price_id`
3. **Webhook 事件名称不同**：`subscription_created` → `subscription.created`
4. **响应格式不同**：Paddle 使用标准 JSON，Lemon Squeezy 使用 JSON:API

---

## 💰 费用对比

| 服务              | 手续费          | 月费 | 退款政策     |
| ----------------- | --------------- | ---- | ------------ |
| **Lemon Squeezy** | 3.5% + $0.30    | 无   | 手续费不退还 |
| **Paddle**        | 5% + $0.50      | 无   | 手续费不退还 |
| **Stripe**        | 2.9% + $0.30    | 无   | 手续费不退还 |
| **PayPal**        | 3.4% + 固定费用 | 无   | 手续费不退还 |

**成本分析：**

- $9.99 月度订阅：
  - Lemon Squeezy: $0.65
  - Paddle: $1.00（+$0.35）
  - Stripe: $0.59（-$0.06）
- $99.99 年度订阅：
  - Lemon Squeezy: $3.80
  - Paddle: $5.50（+$1.70）
  - Stripe: $3.20（-$0.60）

**结论：** Paddle 手续费稍高，但考虑到迁移成本和客服支持，仍然值得。

---

## ✅ 决策建议

### 选择 Paddle 如果：

- ✅ 需要快速迁移（类似 API）
- ✅ 需要 PayPal 收款
- ✅ 需要良好的客服支持
- ✅ 可以接受稍高的手续费

### 选择 Stripe 如果：

- ✅ 有海外公司/银行账户
- ✅ 需要最强大的功能
- ✅ 愿意投入更多开发时间
- ✅ 手续费敏感

### 选择 PayPal 如果：

- ✅ 只想用 PayPal
- ✅ 愿意自己实现所有订阅逻辑
- ✅ 不需要复杂功能

---

## 🚀 下一步

1. **注册 Paddle 账号**（推荐）
2. **测试 PayPal 收款配置**
3. **创建产品和价格**
4. **获取 API Key**
5. **开始代码迁移**

需要我帮你开始迁移到 Paddle 吗？
