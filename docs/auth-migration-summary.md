# 认证架构迁移总结

## ✅ 已完成的修改

### 1. 删除插件的登录 UI

- ❌ 删除 `frontend/src/pages/auth/` 整个目录
  - `Auth.vue` - 认证页面组件
  - `index.html` - 认证页面入口
  - `main.ts` - 认证页面主文件

### 2. 修改 useSupabaseAuth Composable

**文件**: `frontend/src/composables/useSupabaseAuth.ts`

**删除的功能**:
- ❌ `signInWithOAuthNew()` - 完整的 OAuth 登录实现（~300 行代码）
- ❌ `signInWithOAuth()` - OAuth 登录方法
- ❌ 导出的 `signInWithOAuth` 和 `signInWithOAuthNew` 方法

**保留的功能**:
- ✅ `initialize()` - 初始化并检查 session
- ✅ `signOut()` - 登出功能
- ✅ `setupAuthListener()` - 监听认证状态变化
- ✅ 所有状态管理（user, session, loading, error）

**新增的功能**:
- ✅ 监听 `chrome.storage.onChanged` 事件
- ✅ 当收到 `__authStateChanged` 通知时，自动刷新 session

### 3. 添加 Background 消息处理

**文件**: `frontend/src/background/messaging.ts`

**新增功能**:
- ✅ `chrome.runtime.onMessageExternal` 监听器
  - 接受来自官网的消息
  - 验证来源（只允许 acuitybookmarks.com 和 localhost:3000）
- ✅ `AUTH_STATE_CHANGED` 消息处理
  - 广播到所有插件页面
  - 使用 `chrome.storage.session` 作为事件通道
- ✅ `handleAuthStateChanged()` 函数

### 4. 更新 manifest.json

**文件**: `frontend/public/manifest.json`

**修改**:
- ❌ 移除 `auth.html` 从 `web_accessible_resources`
- ❌ 移除 `subscription.html` 从 `web_accessible_resources`
- ✅ 保留 Supabase 相关权限（`https://*.supabase.co/*`, `https://*.supabase.io/*`）
- ✅ 保留 `externally_connectable` 配置（允许官网通信）

### 5. 保留的文件和功能

**完全保留**:
- ✅ `frontend/src/components/composite/UserMenu/UserMenu.vue` - 用户菜单
- ✅ `frontend/src/pages/settings/` - 设置页面
- ✅ `frontend/src/composables/useSubscription.ts` - 订阅状态管理
- ✅ `frontend/src/infrastructure/supabase/client.ts` - Supabase 客户端
- ✅ `frontend/src/application/subscription/` - 订阅服务

---

## 🔄 新的认证流程

### 用户登录流程

```
1. 用户点击插件的"登录"按钮
   ↓
2. 跳转到官网登录页（websiteUrls.login）
   ↓
3. 用户在官网完成 OAuth 登录
   ↓
4. 官网调用 chrome.runtime.sendMessage
   发送 { type: 'AUTH_STATE_CHANGED' }
   ↓
5. 插件 background.js 接收消息
   ↓
6. 广播到 chrome.storage.session
   ↓
7. 所有插件页面监听到变化
   ↓
8. 调用 supabase.auth.getSession()
   ↓
9. 获取用户信息并更新 UI
```

### 技术细节

**官网 → 插件通信**:
```typescript
// 官网代码（website/pages/login.vue）
chrome.runtime.sendMessage(
  extensionId,
  { type: 'AUTH_STATE_CHANGED' }
)
```

**插件接收并广播**:
```typescript
// background/messaging.ts
chrome.runtime.onMessageExternal.addListener((message, sender) => {
  if (message.type === 'AUTH_STATE_CHANGED') {
    chrome.storage.session.set({
      __authStateChanged: { timestamp: Date.now() }
    })
  }
})
```

**插件页面监听并刷新**:
```typescript
// composables/useSupabaseAuth.ts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session' && changes.__authStateChanged) {
    initialize() // 刷新 session
  }
})
```

---

## 🔐 安全性

### 保留的安全特性

1. **Token 管理**: 由 Supabase 自动处理
2. **Token 刷新**: Supabase 自动刷新 access_token
3. **Token 存储**: 存储在 Supabase 管理的 localStorage
4. **跨域隔离**: 官网和插件的 localStorage 是隔离的
5. **消息验证**: 只接受来自授权域名的消息

### 消息通信安全

```typescript
const allowedOrigins = [
  'https://acuitybookmarks.com',
  'http://localhost:3000',
  'https://localhost:3000'
]

if (!allowedOrigins.includes(sender.origin)) {
  return // 拒绝未授权来源
}
```

---

## 📦 包体积影响

- **删除代码**: ~300 行（OAuth 登录实现）
- **新增代码**: ~50 行（消息监听）
- **净减少**: ~250 行
- **Supabase 客户端**: 保留（~2MB）

---

## 🧪 测试检查清单

### 类型检查
- ✅ `bun run typecheck` - 通过

### 代码规范
- ✅ `bun run lint:check` - 通过

### 功能测试（需要手动测试）

1. **用户菜单**:
   - [ ] 未登录时显示"登录"按钮
   - [ ] 点击"登录"跳转到官网
   - [ ] 已登录时显示用户头像和信息

2. **登录流程**:
   - [ ] 在官网登录后，插件自动同步用户状态
   - [ ] 用户信息正确显示（头像、昵称、邮箱）
   - [ ] 订阅状态正确显示（PRO/FREE）

3. **登出流程**:
   - [ ] 点击"退出登录"成功登出
   - [ ] UI 更新为未登录状态

4. **设置页面**:
   - [ ] 可以正常打开设置页面
   - [ ] 账户信息正确显示
   - [ ] 订阅信息正确显示

---

## 🚀 下一步：官网集成

### 需要在官网添加的代码

**文件**: `website/pages/login.vue` 或 `website/composables/useAuth.ts`

```typescript
// 监听认证状态变化
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') {
    // 通知插件
    const extensionId = 'your-extension-id' // 从环境变量读取
    
    try {
      chrome.runtime.sendMessage(
        extensionId,
        { type: 'AUTH_STATE_CHANGED' },
        (response) => {
          if (response?.success) {
            console.log('✅ 已通知插件刷新认证状态')
          }
        }
      )
    } catch (error) {
      // 用户可能没有安装插件，忽略错误
      console.debug('插件未安装或无法通信')
    }
  }
})
```

### 环境变量配置

```env
# website/.env
VITE_EXTENSION_ID=your-extension-id-here
```

---

## 📝 文档更新

已创建的文档:
- ✅ `docs/auth-architecture-clarification.md` - 架构澄清
- ✅ `docs/auth-sync-comparison.md` - 方案对比分析
- ✅ `docs/auth-migration-summary.md` - 迁移总结（本文档）

---

## ✅ 验证清单

- [x] 删除 auth 页面
- [x] 移除 OAuth 登录方法
- [x] 保留状态管理功能
- [x] 添加消息监听
- [x] 添加 storage 变化监听
- [x] 更新 manifest.json
- [x] 类型检查通过
- [x] 代码规范检查通过
- [ ] 功能测试（需要官网配合）

---

## 🎯 总结

采用**方案 C（Supabase + 消息通知）**成功实施：

1. **简化了插件**: 删除了复杂的 OAuth 登录 UI
2. **保留了安全性**: Token 仍由 Supabase 管理
3. **实现了实时同步**: 通过消息通知机制
4. **维护成本低**: 无需自己管理 token 生命周期
5. **用户体验好**: 登录在官网完成，插件自动同步

**关键优势**:
- ✅ 安全性高（Supabase 管理 token）
- ✅ 实时性好（消息通知）
- ✅ 实现简单（只需 50 行新代码）
- ✅ 可靠性高（利用 Supabase 成熟方案）
