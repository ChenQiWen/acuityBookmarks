# 认证安全配置指南

本文档说明 AcuityBookmarks 的认证安全策略和配置方法。

## 🔒 安全策略概览

### Token 过期时间

| Token 类型             | 过期时间 | 说明                               |
| ---------------------- | -------- | ---------------------------------- |
| **Access Token (JWT)** | 1 小时   | 短期 token，用于 API 请求          |
| **Refresh Token**      | 60 天    | 长期 token，用于刷新 Access Token  |
| **不活跃超时**         | 30 天    | 本地检测，超过 30 天未使用自动登出 |

### 安全特性

- ✅ **自动 Token 刷新**：Access Token 快过期时自动刷新
- ✅ **Refresh Token 轮换**：每次刷新时生成新的 Refresh Token
- ✅ **不活跃超时检测**：30 天未使用自动登出
- ✅ **本地持久化**：Session 存储在 `chrome.storage.local`
- ✅ **跨页面同步**：所有扩展页面共享登录状态

## 📋 配置步骤

### 1. 本地开发环境配置

本地开发环境的配置已在 `supabase/config.toml` 中设置：

```toml
[auth]
# Access Token 过期时间：1 小时
jwt_expiry = 3600

# 启用 Refresh Token 轮换
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10

# 注意：refresh_token_lifetime 在本地环境可能不生效
# 需要在生产环境的 Supabase Dashboard 中配置
```

### 2. 生产环境配置（重要！）

**必须在 Supabase Dashboard 中配置 Refresh Token 过期时间：**

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 `Authentication` → `Sessions`（左侧菜单）
4. 找到 `User Sessions` 部分
5. 配置以下参数：

```
Time-box user sessions: 60 天（5184000 秒）
Inactivity timeout: 30 天（2592000 秒）或 never（使用我们的本地检测）
```

**注意：**

- ⚠️ `Time-box user sessions` 和 `Inactivity timeout` 需要 **Pro Plan** 才能配置
- ✅ 如果你使用的是 Free Plan，这些选项会显示为灰色（需要升级）
- ✅ 我们的代码已经实现了本地的 30 天不活跃检测，即使没有 Pro Plan 也能工作

**如果你使用 Free Plan：**

- Refresh Token 默认永不过期（Supabase Free Plan 限制）
- 但我们的本地不活跃检测（30 天）仍然有效
- 这已经提供了基本的安全保护

**如果你使用 Pro Plan：**

- 可以配置 `Time-box user sessions` 为 60 天
- 可以配置 `Inactivity timeout` 为 30 天（或使用我们的本地检测）
- 双重保护，安全性更高

6. 点击 `Save changes` 保存配置

### 3. 验证配置

配置完成后，可以通过以下方式验证：

```bash
# 1. 查看 Supabase 项目设置
# 在 Dashboard 中确认配置已生效

# 2. 测试登录
# 登录后，60 天内保持登录状态
# 60 天后需要重新登录

# 3. 测试不活跃超时
# 30 天不使用应用，会自动登出
```

## 🔧 代码实现

### 不活跃超时检测

在 `frontend/src/composables/useSupabaseAuth.ts` 中实现：

```typescript
// 不活跃超时时间：30 天
const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000

// 检查不活跃超时
const checkInactivity = async () => {
  const lastActivity = await modernStorage.getLocal('auth_last_activity')
  const now = Date.now()

  if (lastActivity && now - lastActivity > INACTIVITY_TIMEOUT) {
    // 超过 30 天未活跃，自动登出
    await signOut()
  }
}

// 更新活跃时间
const updateActivity = async () => {
  await modernStorage.setLocal('auth_last_activity', Date.now())
}
```

### 自动更新活跃时间

活跃时间会在以下情况自动更新：

- ✅ 用户登录时
- ✅ Token 刷新时
- ✅ 每次初始化认证状态时

## 📊 安全性对比

| 配置                    | 安全性      | 用户体验        | 当前状态    |
| ----------------------- | ----------- | --------------- | ----------- |
| **永不过期**            | ⭐ 低       | ⭐⭐⭐⭐⭐ 极好 | ❌ 已废弃   |
| **60 天 + 30 天不活跃** | ⭐⭐⭐⭐ 高 | ⭐⭐⭐⭐ 好     | ✅ 当前配置 |

## 🚨 安全建议

### 对于用户

1. **定期使用应用**：避免超过 30 天不使用
2. **不要共享设备**：登录状态会在设备上保持
3. **及时登出**：在共享设备上使用后记得登出

### 对于开发者

1. **监控异常登录**：通过 Supabase Dashboard 查看登录日志
2. **定期审计 Session**：检查活跃的 Session 数量
3. **启用邮件通知**：新设备登录时通知用户

## 🔍 故障排查

### Refresh Token 仍然永不过期

**原因：** 本地开发环境的 `config.toml` 配置可能不生效

**解决方案：**

1. 确认在 Supabase Dashboard 中配置了 `Refresh Token Lifetime`
2. 重启 Supabase 本地服务：`supabase stop && supabase start`
3. 清除现有 Session，重新登录测试

### 用户频繁被登出

**原因：** 不活跃超时时间太短

**解决方案：**

1. 检查 `INACTIVITY_TIMEOUT` 配置（默认 30 天）
2. 确认用户的 `last_activity` 时间是否正常更新
3. 查看浏览器控制台日志，确认是否有错误

### Token 刷新失败

**原因：** Refresh Token 已过期或被撤销

**解决方案：**

1. 检查 Supabase Dashboard 中的 Session 状态
2. 确认 `enable_refresh_token_rotation` 已启用
3. 查看网络请求，确认刷新请求是否成功

## 📚 相关文档

- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [JWT 最佳实践](https://datatracker.ietf.org/doc/html/rfc8725)
- [OAuth 2.0 安全最佳实践](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## 🔄 更新日志

- **2026-04-26**: 初始版本，设置 60 天 Refresh Token 过期 + 30 天不活跃超时
