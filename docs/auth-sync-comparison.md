# 认证同步方案对比分析

## 方案 A：Supabase Session 自动同步（推荐）

### 技术原理

Supabase 使用 **localStorage** 存储 session：
```javascript
// Supabase 内部实现
localStorage.setItem('supabase.auth.token', JSON.stringify({
  access_token: '...',
  refresh_token: '...',
  user: { ... }
}))
```

**关键点**：
- localStorage 是**同域共享**的
- 官网（`acuitybookmarks.com`）和插件（`chrome-extension://xxx`）是**不同域**
- 但 Supabase 客户端会自动处理跨标签页同步（同域内）

### 实际工作流程

```
用户在官网登录
    ↓
Supabase 将 session 存储到 localStorage (官网域)
    ↓
插件的 Supabase 客户端独立连接 Supabase
    ↓
插件调用 supabase.auth.getSession()
    ↓
Supabase 服务器验证并返回 session
    ↓
插件获得用户状态
```

**注意**：插件和官网的 localStorage 是**隔离的**，但它们都连接到**同一个 Supabase 项目**。

### 同步机制

1. **官网登录后**：
   - Supabase session 存储在官网的 localStorage
   - 插件需要主动调用 `supabase.auth.getSession()` 从 Supabase 服务器获取

2. **插件如何知道用户登录了**？
   - **方案 A1**：定时轮询（每 30 秒检查一次）
   - **方案 A2**：官网通过 `chrome.runtime.sendMessage` 通知插件
   - **方案 A3**：用户打开插件时主动检查

### 优点
✅ **实现简单**：只需保留现有代码，移除登录 UI  
✅ **可靠性高**：Supabase 官方支持，经过大规模验证  
✅ **自动刷新**：Supabase 自动处理 token 刷新  
✅ **离线支持**：session 有效期内无需网络  
✅ **安全性好**：token 由 Supabase 管理，自动加密  

### 缺点
❌ **跨域隔离**：官网和插件的 localStorage 不共享  
❌ **需要通知机制**：官网登录后需要通知插件刷新  
❌ **依赖 Supabase**：必须保持 Supabase 客户端  

### 性能
- **初始化**：~100ms（读取 localStorage + 验证 token）
- **刷新状态**：~200ms（网络请求到 Supabase）
- **内存占用**：~2MB（Supabase 客户端）

---

## 方案 B：消息通信机制

### 技术原理

使用 Chrome Extension 的 **externally_connectable** + **chrome.runtime.sendMessage**：

```javascript
// 官网代码
chrome.runtime.sendMessage(
  'extension-id',
  { type: 'USER_LOGGED_IN', user: {...} },
  (response) => { ... }
)

// 插件 background.js
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'USER_LOGGED_IN') {
    // 存储用户信息到 chrome.storage.local
    chrome.storage.local.set({ user: message.user })
  }
})
```

### 实际工作流程

```
用户在官网登录
    ↓
官网调用 chrome.runtime.sendMessage 发送用户信息
    ↓
插件 background.js 接收消息
    ↓
存储到 chrome.storage.local
    ↓
通知所有插件页面更新状态
```

### 同步机制

1. **官网 → 插件**：
   - 使用 `chrome.runtime.sendMessage`（需要 `externally_connectable` 权限）
   - 实时通信，延迟 < 50ms

2. **插件内部**：
   - 使用 `chrome.storage.local` 存储用户状态
   - 使用 `chrome.storage.onChanged` 监听变化
   - 所有页面（popup、side-panel、management）自动同步

### 优点
✅ **完全控制**：不依赖第三方服务  
✅ **实时同步**：官网登录后立即通知插件  
✅ **轻量级**：无需 Supabase 客户端  
✅ **灵活性高**：可以传递任意数据结构  

### 缺点
❌ **实现复杂**：需要完整的消息通信机制  
❌ **需要自己管理 token**：刷新、过期、安全性  
❌ **需要 API 端点**：插件需要调用官网 API 验证 token  
❌ **网络依赖**：每次验证都需要网络请求  
❌ **安全风险**：token 存储在 chrome.storage.local（虽然加密，但不如 Supabase）  

### 性能
- **初始化**：~50ms（读取 chrome.storage.local）
- **同步延迟**：< 50ms（消息通信）
- **验证请求**：~300ms（需要调用官网 API）
- **内存占用**：~500KB（无 Supabase 客户端）

---

## 详细对比表

| 维度 | 方案 A（Supabase） | 方案 B（消息通信） |
|------|-------------------|-------------------|
| **实现复杂度** | ⭐⭐ 简单 | ⭐⭐⭐⭐ 复杂 |
| **可靠性** | ⭐⭐⭐⭐⭐ 非常高 | ⭐⭐⭐ 中等 |
| **实时性** | ⭐⭐⭐ 需要轮询或通知 | ⭐⭐⭐⭐⭐ 实时 |
| **安全性** | ⭐⭐⭐⭐⭐ Supabase 管理 | ⭐⭐⭐ 需要自己实现 |
| **离线支持** | ⭐⭐⭐⭐⭐ 支持 | ⭐⭐ 需要缓存 |
| **Token 刷新** | ⭐⭐⭐⭐⭐ 自动 | ⭐⭐ 需要自己实现 |
| **依赖性** | ⭐⭐ 依赖 Supabase | ⭐⭐⭐⭐⭐ 无外部依赖 |
| **包体积** | ⭐⭐ +2MB | ⭐⭐⭐⭐⭐ 轻量 |
| **维护成本** | ⭐⭐⭐⭐⭐ 低 | ⭐⭐ 高 |

---

## 混合方案（最佳实践）

### 方案 C：Supabase + 消息通知

结合两者优点：

```javascript
// 官网登录成功后
chrome.runtime.sendMessage(
  extensionId,
  { type: 'AUTH_STATE_CHANGED' }  // 只发送通知，不传递敏感数据
)

// 插件接收通知
chrome.runtime.onMessageExternal.addListener((message) => {
  if (message.type === 'AUTH_STATE_CHANGED') {
    // 立即从 Supabase 刷新 session
    supabase.auth.getSession()
  }
})
```

### 优点
✅ 保留 Supabase 的所有优点（安全、可靠、自动刷新）  
✅ 实时通知，无需轮询  
✅ 实现简单，只需添加消息监听  
✅ 不传递敏感数据，只传递通知  

---

## 推荐方案

### 🏆 推荐：方案 C（Supabase + 消息通知）

**理由**：
1. **安全性最高**：token 由 Supabase 管理，不在消息中传递
2. **实现最简单**：只需添加消息监听，无需重构现有代码
3. **可靠性最高**：利用 Supabase 的成熟方案
4. **实时性好**：官网登录后立即通知插件
5. **维护成本低**：无需自己管理 token 生命周期

### 实现步骤

1. **保留现有代码**：
   - ✅ `useSupabaseAuth.ts` - 保留所有状态管理
   - ✅ `UserMenu.vue` - 保留用户菜单
   - ✅ `Settings.vue` - 保留设置页面
   - ✅ Supabase 客户端

2. **移除登录 UI**：
   - ❌ `Auth.vue` - 删除认证页面
   - ❌ `signInWithOAuth` 方法 - 移除登录逻辑

3. **修改登录入口**：
   - `UserMenu.vue` 的登录按钮 → 跳转到官网登录页
   - 使用 `openWebsiteUrl(websiteUrls.login)`

4. **添加消息监听**：
   ```typescript
   // background.js
   chrome.runtime.onMessageExternal.addListener((message) => {
     if (message.type === 'AUTH_STATE_CHANGED') {
       // 通知所有插件页面刷新用户状态
       chrome.runtime.sendMessage({ type: 'REFRESH_AUTH' })
     }
   })
   ```

5. **官网添加通知**：
   ```typescript
   // website/pages/login.vue
   onMounted(() => {
     supabase.auth.onAuthStateChange((event) => {
       if (event === 'SIGNED_IN') {
         chrome.runtime.sendMessage(
           extensionId,
           { type: 'AUTH_STATE_CHANGED' }
         )
       }
     })
   })
   ```

---

## 性能对比总结

| 操作 | 方案 A | 方案 B | 方案 C |
|------|--------|--------|--------|
| 初始化 | 100ms | 50ms | 100ms |
| 登录同步 | 30s（轮询） | 50ms | 50ms |
| 状态验证 | 200ms | 300ms | 200ms |
| 包体积 | +2MB | +0MB | +2MB |
| 内存占用 | 2MB | 500KB | 2MB |

**结论**：方案 C 在保持方案 A 的安全性和可靠性的同时，获得了方案 B 的实时性。

---

## 安全性对比

### 方案 A/C（Supabase）
- ✅ Token 存储在 Supabase 管理的 localStorage
- ✅ 自动加密
- ✅ 自动刷新
- ✅ 服务端验证
- ✅ 符合 OAuth 2.0 标准

### 方案 B（自己管理）
- ⚠️ Token 存储在 chrome.storage.local
- ⚠️ 需要自己实现加密
- ⚠️ 需要自己实现刷新逻辑
- ⚠️ 需要自己实现验证逻辑
- ⚠️ 容易出现安全漏洞

---

## 最终建议

采用 **方案 C（Supabase + 消息通知）**：

1. **短期收益**：
   - 只需删除 Auth.vue 页面
   - 修改登录按钮跳转到官网
   - 添加消息监听（< 50 行代码）

2. **长期收益**：
   - 安全性有保障
   - 维护成本低
   - 用户体验好（实时同步）
   - 可以随时迁移到其他认证方案

3. **风险最低**：
   - 不需要重构现有代码
   - 不需要自己管理 token
   - 不需要担心安全问题
