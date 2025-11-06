# Supabase 邮件发送频率限制解决方案

## 问题描述

Supabase 对邮件发送有频率限制，当超过限制时会返回 `429 Too Many Requests` 错误：

```json
{
  "code": "over_email_send_rate_limit",
  "message": "email rate limit exceeded"
}
```

这会导致：

- 无法注册新用户
- 无法发送密码重置邮件
- 无法进行正常的认证流程测试

## 原因分析

1. **项目级别的邮件发送限制**：Supabase 对每个项目的邮件发送频率有限制
2. **高退回率（Bounce Rate）**：如果发送的邮件有很高的退回率，Supabase 会限制邮件发送权限
3. **测试环境频繁操作**：在开发测试时频繁注册/重置密码会快速触发限制

## 解决方案

### 方案 1：配置自定义 SMTP（推荐，长期方案）

这是最可靠的解决方案，可以绕过 Supabase 默认邮件服务的限制。

**步骤：**

1. **选择 SMTP 服务提供商**（推荐）：
   - **SendGrid**：免费额度 100 封/天
   - **Mailgun**：免费额度 5,000 封/月（前 3 个月）
   - **AWS SES**：免费额度 62,000 封/月（需要 AWS 账户）
   - **Postmark**：免费额度 100 封/月

2. **在 Supabase Dashboard 中配置**：
   - 进入 `Authentication` → `Sign In / Providers`
   - 点击 `Email` provider
   - 找到 `Custom SMTP` 部分
   - 启用并填写 SMTP 配置：
     - SMTP Host（如：smtp.sendgrid.net）
     - SMTP Port（如：587）
     - SMTP User（API Key 或用户名）
     - SMTP Password（API Secret 或密码）
     - Sender Email（发件人邮箱）
     - Sender Name（发件人名称）

3. **配置完成后**：
   - 邮件发送限制会解除
   - 可以使用自己的 SMTP 服务发送邮件
   - 更好的邮件送达率和控制

### 方案 2：等待限制自动解除（临时方案）

- **等待时间**：通常需要 **15-60 分钟** 到数小时
- **不保证**：限制可能不会自动解除，特别是高退回率的情况
- **适用场景**：紧急测试，临时等待

### 方案 3：联系 Supabase 支持（如果问题持续）

如果配置自定义 SMTP 后问题仍然存在，可以：

1. 在 Supabase Dashboard 中提交支持工单
2. 说明是开发环境测试导致的高退回率
3. 请求临时解除限制或提供解决方案

### 方案 4：清理测试数据（辅助方案）

虽然删除用户不会直接解除限制，但可以：

1. 在 Supabase Dashboard 中删除测试用户
2. 清理无效的邮箱地址
3. 降低未来的退回率

## 开发环境建议

### 对于开发/测试环境：

1. **禁用邮箱验证**（已实现）：
   - 在 `Authentication` → `Email` → `Confirm email` 中关闭
   - 注册后直接登录，不需要验证邮件

2. **使用测试邮箱服务**：
   - 使用 `mailinator.com`、`10minutemail.com` 等临时邮箱服务
   - 避免使用真实邮箱频繁测试

3. **配置自定义 SMTP**：
   - 使用 SendGrid 或 Mailgun 的免费额度
   - 开发环境不受 Supabase 限制影响

### 对于生产环境：

1. **必须配置自定义 SMTP**：
   - 确保邮件发送的可靠性
   - 避免被 Supabase 限制影响业务

2. **监控邮件退回率**：
   - 定期检查邮件发送状态
   - 及时处理无效邮箱地址

## 当前代码处理

代码中已经正确处理了速率限制错误：

- **错误码映射**：`over_email_send_rate_limit` → "发送邮件过于频繁，请稍后再试（通常需要等待 15-60 分钟）。如果问题持续，可能是项目邮件发送权限被限制，请在 Supabase Dashboard 中配置自定义 SMTP"
- **用户提示**：会显示友好的错误信息，告知用户需要等待或配置 SMTP

## 总结

**最佳实践：**

1. ✅ **开发环境**：配置自定义 SMTP（SendGrid 免费额度足够）
2. ✅ **生产环境**：必须配置自定义 SMTP（确保可靠性）
3. ✅ **测试时**：使用临时邮箱服务，避免频繁触发限制

**立即行动：**

1. 在 Supabase Dashboard 中配置自定义 SMTP
2. 使用 SendGrid 或 Mailgun 的免费服务
3. 配置完成后，限制会立即解除
