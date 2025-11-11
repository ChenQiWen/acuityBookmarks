# Gumroad 配置信息获取指南

## 📍 快速定位

### 1. Webhook Secret（可能不需要）

**重要**：Gumroad 使用 **Ping** 功能而不是传统的 Webhook，可能**不使用签名验证**。

**位置**：`Settings` → `Advanced` → `Ping`

**步骤**：

1. 登录 Gumroad Dashboard
2. 左侧导航点击 `Settings` → `Advanced`
3. 找到 **Ping** 部分
4. 在 **Ping endpoint** 输入框中填写你的 Worker URL：
   ```
   https://你的worker域名/api/gumroad/webhook
   ```
5. 点击 **`Send test ping to URL`** 测试连接

**关于 Secret**：

- Gumroad 的 Ping 功能可能**不提供 Webhook Secret**
- 如果页面没有显示 Secret，这是正常的
- 我们的代码已经处理了这种情况：如果没有配置 Secret，会跳过签名验证
- 生产环境可以考虑使用 IP 白名单或其他验证方式

**如果确实需要 Secret**：

- 尝试创建 Application（`Settings` → `Advanced` → `Applications` → `Create application`）
- 创建 Application 后可能会显示 API Token 和 Secret

---

### 2. Monthly Plan ID

**位置**：产品编辑页面 → `Tiers` 部分 → `Pro Monthly` Tier

**步骤**：

1. 进入 `Products` → 点击你的产品 `Acuity Bookmarks Pro`
2. 在产品编辑页面，找到 **Tiers** 部分
3. 找到 **Pro Monthly** Tier 卡片
4. 点击卡片右上角的 **`Share`** 按钮
5. 会弹出一个链接，格式类似：
   ```
   https://cqw5478.gumroad.com/l/acuity-pro?plan=1234567890
   ```
6. 从 URL 中提取 `plan=` 后面的数字，这就是 **Monthly Plan ID**
7. 例如：如果 URL 是 `...?plan=1234567890`，那么 Plan ID 就是 `1234567890`

**备用方法**：

- 如果 Share 按钮没有显示 Plan ID，可以：
  1. 发布产品后，访问产品页面
  2. 选择 Monthly 计划
  3. 查看浏览器地址栏，URL 中会包含 `plan=xxxxx`

---

### 3. Yearly Plan ID

**位置**：产品编辑页面 → `Tiers` 部分 → `Pro Yearly` Tier

**步骤**：

1. 同样在产品编辑页面的 **Tiers** 部分
2. 找到 **Pro Yearly** Tier 卡片
3. 点击卡片右上角的 **`Share`** 按钮
4. 从弹出的链接中提取 `plan=` 后面的数字
5. 这就是 **Yearly Plan ID**

---

### 4. Product URL

**位置**：产品编辑页面 → `URL` 字段

**步骤**：

1. 在产品编辑页面，找到 **URL** 字段（通常在 "Name" 下方）
2. 显示格式：`cqw5478.gumroad.com/l/acuity-pro`
3. 完整 URL 就是：`https://cqw5478.gumroad.com/l/acuity-pro`
4. 这就是 `VITE_GUMROAD_PRODUCT_URL` 的值

---

## 🔧 配置 Wrangler Secrets

由于你的 `wrangler.toml` 中定义了 `[env.production]`，需要指定环境。

### 方法 1：使用顶层环境（推荐用于开发测试）

```bash
cd backend
wrangler secret put GUMROAD_WEBHOOK_SECRET --env=''
wrangler secret put GUMROAD_PLAN_ID_MONTHLY --env=''
wrangler secret put GUMROAD_PLAN_ID_YEARLY --env=''
```

### 方法 2：使用 production 环境（用于生产部署）

```bash
cd backend
wrangler secret put GUMROAD_WEBHOOK_SECRET --env=production
wrangler secret put GUMROAD_PLAN_ID_MONTHLY --env=production
wrangler secret put GUMROAD_PLAN_ID_YEARLY --env=production
```

**执行时**：

- 命令会提示 `? Enter a secret value: >`
- 直接粘贴你从 Gumroad 获取的值
- 按 Enter 确认

---

## 📝 配置清单

在开始配置前，准备好以下信息：

- [ ] **Webhook Secret**：从 `Settings → Advanced → Webhooks` 获取
- [ ] **Monthly Plan ID**：从 "Pro Monthly" Tier 的 Share 链接中提取
- [ ] **Yearly Plan ID**：从 "Pro Yearly" Tier 的 Share 链接中提取
- [ ] **Product URL**：从产品编辑页面的 URL 字段获取

---

## ⚠️ 注意事项

1. **Webhook Secret 只显示一次**：创建 Webhook 后立即复制保存，之后无法再次查看
2. **Plan ID 是数字**：通常是一串数字，不是字母
3. **Product URL 不包含 plan 参数**：基础产品链接，Plan ID 通过 URL 参数传递
4. **环境变量区分**：开发环境用 `--env=''`，生产环境用 `--env=production`

---

## 🆘 如果找不到

### Webhook Secret 找不到？

- 检查是否已创建 Webhook
- 如果创建时没有保存 Secret，需要删除并重新创建
- 重新创建时，**立即复制显示的 Secret**

### Plan ID 找不到？

- 确保产品已保存（可以是 Draft 状态）
- 尝试发布产品后再查看 Share 链接
- 如果 Share 按钮不可用，检查产品是否已创建 Tier

### Product URL 找不到？

- 在产品编辑页面的顶部或 "URL" 字段中查找
- 如果显示为 `yourdomain.gumroad.com/l/your-slug`，完整 URL 就是 `https://yourdomain.gumroad.com/l/your-slug`
