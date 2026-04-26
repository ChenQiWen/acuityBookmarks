# 认证安全改进实施总结

本文档记录了 2026-04-26 实施的认证安全改进。

## 🎯 改进目标

将 Refresh Token 从"永不过期"改为"60 天过期 + 30 天不活跃超时"，提升安全性的同时保持良好的用户体验。

## ✅ 已完成的改进

### 1. Supabase 配置更新

**文件：** `supabase/config.toml`

**修改内容：**

```toml
# 添加了 Refresh Token 过期时间的说明和配置
# 注意：本地开发环境可能不生效，需要在生产环境的 Supabase Dashboard 中配置
# refresh_token_lifetime = 5184000  # 60 天
```

**注意事项：**

- ⚠️ 本地开发环境的 `config.toml` 配置可能不生效
- ✅ 必须在 Supabase Dashboard 中手动配置（见下方步骤）

### 2. 不活跃超时检测

**文件：** `frontend/src/composables/useSupabaseAuth.ts`

**新增功能：**

#### 2.1 不活跃超时常量

```typescript
const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000 // 30 天
```

#### 2.2 检查不活跃超时

```typescript
const checkInactivity = async () => {
  const lastActivity = await modernStorage.getLocal('auth_last_activity')
  const now = Date.now()

  if (lastActivity && now - lastActivity > INACTIVITY_TIMEOUT) {
    // 超过 30 天未活跃，自动登出
    await signOut()
    error.value = '您已超过 30 天未使用，为了安全已自动登出，请重新登录'
  }
}
```

#### 2.3 更新活跃时间

```typescript
const updateActivity = async () => {
  await modernStorage.setLocal('auth_last_activity', Date.now())
}
```

#### 2.4 自动触发时机

- ✅ 用户登录时（`SIGNED_IN` 事件）
- ✅ Token 刷新时（`TOKEN_REFRESHED` 事件）
- ✅ 每次初始化认证状态时

### 3. 文档更新

**新增文档：**

- `docs/AUTH_SECURITY.md` - 认证安全配置指南
- `docs/AUTH_SECURITY_IMPLEMENTATION.md` - 本文档

## 📋 生产环境配置步骤（重要！）

### 必须在 Supabase Dashboard 中配置

1. **登录 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 选择你的项目

2. **进入 Sessions 设置**
   - 导航到：`Authentication` → `Sessions`（左侧菜单）

3. **配置 User Sessions**

   **如果你使用 Pro Plan：**

   ```
   Time-box user sessions: 5184000 seconds (60 days)
   Inactivity timeout: 2592000 seconds (30 days) 或 never
   ```

   **如果你使用 Free Plan：**
   - ⚠️ 这些选项会显示为灰色，需要升级到 Pro Plan
   - ✅ 但我们的本地不活跃检测（30 天）仍然有效
   - ✅ 这已经提供了基本的安全保护

4. **保存配置**
   - 点击 `Save changes` 按钮
   - 等待配置生效（通常立即生效）

5. **验证配置**
   - 重新登录测试
   - 检查本地不活跃检测是否正常工作

### 关于 Supabase 计划限制

| 功能                   | Free Plan | Pro Plan  |
| ---------------------- | --------- | --------- |
| **JWT Expiry**         | ✅ 可配置 | ✅ 可配置 |
| **Time-box sessions**  | ❌ 不可用 | ✅ 可配置 |
| **Inactivity timeout** | ❌ 不可用 | ✅ 可配置 |
| **本地不活跃检测**     | ✅ 可用   | ✅ 可用   |

**结论：**

- 即使使用 Free Plan，我们的本地 30 天不活跃检测也能提供基本安全保护
- 如果需要服务端强制 Session 过期，需要升级到 Pro Plan

## 🔒 安全策略总结

| 项目                   | 配置值                                    | 说明                               |
| ---------------------- | ----------------------------------------- | ---------------------------------- |
| **Access Token 过期**  | 1 小时                                    | 短期 token，自动刷新               |
| **Refresh Token 过期** | 60 天（Pro Plan）或 永不过期（Free Plan） | 长期 token                         |
| **不活跃超时**         | 30 天                                     | 本地检测，自动登出（所有计划可用） |
| **Token 轮换**         | ✅ 启用                                   | 每次刷新生成新 token               |
| **存储位置**           | chrome.storage.local                      | 本地持久化                         |

**重要说明：**

- ✅ **本地不活跃检测（30 天）** 在所有 Supabase 计划中都有效
- ⚠️ **服务端 Session 过期** 需要 Supabase Pro Plan
- ✅ 即使使用 Free Plan，30 天不活跃检测也能提供基本安全保护

## 📊 安全性提升

### 改进前（永不过期）

- ❌ 安全性：⭐ 低
- ✅ 用户体验：⭐⭐⭐⭐⭐ 极好
- ❌ 风险：设备丢失后永久可访问

### 改进后（60 天 + 30 天不活跃）

- ✅ 安全性：⭐⭐⭐⭐ 高
- ✅ 用户体验：⭐⭐⭐⭐ 好
- ✅ 风险：30 天不活跃自动登出（所有计划可用）
- ⚠️ 服务端 60 天过期需要 Pro Plan

**实际效果：**

- **Free Plan 用户**：30 天不活跃自动登出（已提供基本保护）
- **Pro Plan 用户**：30 天不活跃 + 60 天服务端过期（双重保护）

## 🧪 测试建议

### 1. 测试 Refresh Token 过期（60 天后）

```bash
# 方法 1：修改系统时间（不推荐）
# 方法 2：在 Supabase Dashboard 中手动撤销 Session
# 方法 3：等待 60 天（生产环境验证）
```

### 2. 测试不活跃超时（30 天后）

```typescript
// 临时修改超时时间进行测试
const INACTIVITY_TIMEOUT = 60 * 1000 // 1 分钟（仅测试用）

// 测试步骤：
// 1. 登录应用
// 2. 等待 1 分钟
// 3. 重新打开应用
// 4. 应该自动登出
```

### 3. 测试 Token 自动刷新

```bash
# 1. 登录应用
# 2. 等待 1 小时（Access Token 过期）
# 3. 继续使用应用
# 4. 应该自动刷新，无需重新登录
```

## 🚨 注意事项

### 对于开发者

1. **本地开发环境**
   - `config.toml` 中的 `refresh_token_lifetime` 可能不生效
   - 不活跃超时功能在本地环境正常工作

2. **生产环境**
   - 必须在 Supabase Dashboard 中配置 Refresh Token 过期时间
   - 配置后立即生效，无需重启服务

3. **现有用户**
   - 已登录的用户不受影响（使用旧的 Refresh Token）
   - 新登录的用户使用新的过期策略
   - 建议通知用户重新登录以应用新策略

### 对于用户

1. **正常使用**
   - 每 60 天需要重新登录一次
   - 如果 30 天不使用，会自动登出

2. **设备安全**
   - 不要在共享设备上保持登录
   - 使用完毕后建议手动登出

## 📈 后续优化建议

### 可选的进一步改进

1. **添加"记住我"选项**
   - 短期：7 天
   - 长期：60 天（当前默认）

2. **设备指纹验证**
   - 检测设备变化
   - 异常登录时要求重新认证

3. **邮件通知**
   - 新设备登录时通知用户
   - Token 即将过期时提醒用户

4. **Session 管理界面**
   - 显示所有活跃 Session
   - 允许用户远程登出其他设备

## 🔗 相关文档

- [认证安全配置指南](./AUTH_SECURITY.md)
- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [JWT 最佳实践](https://datatracker.ietf.org/doc/html/rfc8725)

## ✅ 检查清单

- [x] 更新 `supabase/config.toml`
- [x] 实现不活跃超时检测
- [x] 更新活跃时间记录
- [x] 添加文档说明
- [x] 通过类型检查
- [x] 通过代码规范检查
- [x] 发现 Supabase Sessions 配置需要 Pro Plan
- [ ] 决定是否升级到 Pro Plan（可选）
- [ ] 如果使用 Pro Plan，在 Dashboard 中配置（可选）
- [ ] 通知现有用户重新登录（可选）
- [ ] 生产环境验证（30 天后）

**注意：**

- ✅ 即使不升级 Pro Plan，本地 30 天不活跃检测也已生效
- ✅ 这已经提供了基本的安全保护
- ⚠️ 如果需要服务端强制 Session 过期，需要升级到 Pro Plan

## 📅 实施时间

- **实施日期**: 2026-04-26
- **实施人员**: AI Assistant
- **审核状态**: 待审核
- **生产部署**: 待部署

---

**下一步行动：**

1. ✅ 代码已提交，等待审核
2. ⚠️ 部署前必须在 Supabase Dashboard 中配置 Refresh Token 过期时间
3. 📢 建议通知用户安全策略更新
