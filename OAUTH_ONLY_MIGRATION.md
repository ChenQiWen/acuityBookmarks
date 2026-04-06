# OAuth-Only 迁移完成

## 📋 变更概述

本项目已简化为**仅支持 OAuth 登录**（Google、Microsoft），移除了所有邮箱密码相关的功能。

## ✅ 已完成的变更

### 1. 代码简化

#### `frontend/src/composables/useSupabaseAuth.ts`
- ❌ 移除 `signUp()` - 邮箱密码注册
- ❌ 移除 `signIn()` - 邮箱密码登录
- ❌ 移除 `resetPassword()` - 密码重置
- ❌ 移除 `updatePassword()` - 密码更新
- ✅ 保留 `signInWithOAuth()` - OAuth 登录
- ✅ 保留 `signOut()` - 登出
- ✅ 简化错误处理逻辑

**变更前**: 800+ 行
**变更后**: 200+ 行
**减少**: 75% 代码量

#### `frontend/src/pages/auth/Auth.vue`
- ❌ 移除邮箱密码登录表单
- ❌ 移除注册表单
- ❌ 移除密码重置表单
- ❌ 移除邮箱验证流程
- ✅ 保留 OAuth 登录按钮（Google、Microsoft）
- ✅ 简化 UI 设计

**变更前**: 1671 行
**变更后**: 300+ 行
**减少**: 82% 代码量

### 2. 配置更新

#### `supabase/config.toml`
```toml
[auth.email]
enable_signup = false  # 禁用邮箱密码注册
```

### 3. 备份文件

原始文件已备份为：
- `frontend/src/pages/auth/Auth.vue.backup`

如需恢复，可以参考备份文件。

## 🎯 新的登录流程

### 用户登录流程

```
用户访问登录页
    ↓
选择 OAuth 提供商（Google 或 Microsoft）
    ↓
跳转到第三方授权页面
    ↓
用户授权
    ↓
自动创建账号（首次登录）或直接登录
    ↓
跳转到主页
```

### 技术流程

```typescript
// 1. 用户点击 OAuth 按钮
await signInWithOAuth('google')

// 2. 打开 OAuth 授权窗口
chrome.identity.launchWebAuthFlow(...)

// 3. 获取 access_token 和 refresh_token
const { access_token, refresh_token } = parseRedirectUrl()

// 4. 设置 Supabase session
await supabase.auth.setSession({ access_token, refresh_token })

// 5. 自动同步用户信息
const user = await supabase.auth.getUser()

// 6. 完成登录
router.push('/')
```

## 📊 优势对比

| 指标 | 邮箱密码 | OAuth Only |
|------|---------|-----------|
| **用户体验** | 需要填表、记密码 | 一键登录 |
| **安全性** | 需要存储密码 | 不存储密码 |
| **开发成本** | 高（密码重置、邮箱验证） | 低 |
| **维护成本** | 高（密码安全、暴力破解） | 低 |
| **代码量** | 2400+ 行 | 500+ 行 |
| **转化率** | 较低 | 较高 |

## 🔧 如何测试

### 1. 启动开发环境

```bash
# 启动前端
bun run dev:frontend

# 启动 Supabase（如果使用本地）
bun run db:start
```

### 2. 测试 Google 登录

1. 访问 `chrome-extension://<extension-id>/auth.html`
2. 点击"使用 Google 登录"
3. 在弹出窗口中选择 Google 账号
4. 授权后自动跳转到主页

### 3. 测试 Microsoft 登录

1. 访问 `chrome-extension://<extension-id>/auth.html`
2. 点击"使用 Microsoft 登录"
3. 在弹出窗口中输入 Microsoft 账号
4. 授权后自动跳转到主页

## 📝 后续任务

### 可选的增强功能

- [ ] 添加 Apple Sign In（如果需要支持 iOS）
- [ ] 添加魔法链接登录（无密码邮箱登录）
- [ ] 添加首次登录引导流程
- [ ] 添加账号合并功能（同一邮箱多个 OAuth）

### 文档更新

- [ ] 更新 README.md
- [ ] 更新用户文档
- [ ] 更新 API 文档

## 🚨 注意事项

### 对现有用户的影响

1. **已有邮箱密码用户**：
   - 无法再使用邮箱密码登录
   - 需要使用 OAuth 登录
   - 如果邮箱相同，会自动关联到同一账号

2. **数据迁移**：
   - 用户数据不受影响
   - 订阅状态不受影响
   - 只是登录方式改变

### Supabase Dashboard 配置

确保在 Supabase Dashboard 中：

1. **启用 OAuth Providers**：
   - Authentication → Providers → Google (Enabled)
   - Authentication → Providers → Microsoft (Enabled)

2. **禁用邮箱注册**：
   - Authentication → Providers → Email (Disable sign ups)

3. **配置 Redirect URLs**：
   - 添加 `https://<extension-id>.chromiumapp.org/`

## 📚 相关文档

- [Supabase OAuth 文档](https://supabase.com/docs/guides/auth/social-login)
- [Chrome Extension OAuth 文档](https://developer.chrome.com/docs/extensions/reference/identity/)
- [项目架构文档](./文档/产品文档/AcuityBookmarks-产品文档-v3.0.md)

## 🎉 总结

通过这次简化，我们：

- ✅ 减少了 **80%+ 的认证相关代码**
- ✅ 提升了 **用户体验**（一键登录）
- ✅ 提高了 **安全性**（不存储密码）
- ✅ 降低了 **维护成本**
- ✅ 符合 **现代 Web 应用的最佳实践**

---

**迁移完成时间**: 2026-04-05
**版本**: v2.0.0-oauth-only
