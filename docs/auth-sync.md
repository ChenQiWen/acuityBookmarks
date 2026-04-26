# 官网与插件账户状态双向同步

## 概述

AcuityBookmarks 的官网和 Chrome 扩展插件共享同一个 Supabase 认证系统，实现了账户状态的双向自动同步。

## 同步机制

### 1. Supabase Auth State Change 监听

两端都监听 Supabase 的 `onAuthStateChange` 事件：

**官网（`website/composables/useAuth.ts`）：**

```typescript
supabase.auth.onAuthStateChange((event, newSession) => {
  session.value = newSession
  user.value = newSession?.user ?? null
})
```

**插件（`frontend/src/composables/useSupabaseAuth.ts`）：**

```typescript
supabase.auth.onAuthStateChange((event, newSession) => {
  session.value = newSession
  user.value = newSession?.user ?? null
})
```

### 2. Storage Event 监听（官网）

官网监听 `localStorage` 的变化，当其他标签页登录/登出时自动同步：

```typescript
window.addEventListener('storage', async e => {
  if (e.key?.startsWith('sb-') && e.key.includes('-auth-token')) {
    // 重新获取 session
    const {
      data: { session }
    } = await supabase.auth.getSession()
    // 更新本地状态
  }
})
```

### 3. Chrome Storage 监听（插件）

插件监听 Chrome 的 storage 变化（Supabase 在插件中使用 `chrome.storage.local`）：

```typescript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['sb-auth-token']) {
    // 重新获取 session
    // 更新本地状态
  }
})
```

## 同步流程

### 场景 1：在官网登录

1. 用户在官网点击"使用 Google 登录"
2. OAuth 流程完成，Supabase 设置 session
3. `onAuthStateChange` 触发，官网更新状态
4. Supabase 将 token 存储到 `localStorage`
5. 如果插件正在运行，插件的 `onAuthStateChange` 也会触发
6. 插件自动更新为已登录状态

### 场景 2：在插件登录

1. 用户在插件中点击"使用 Google 登录"
2. OAuth 流程完成，Supabase 设置 session
3. `onAuthStateChange` 触发，插件更新状态
4. Supabase 将 token 存储到 `chrome.storage.local`
5. 如果官网正在打开，官网的 `onAuthStateChange` 也会触发
6. 官网自动更新为已登录状态

### 场景 3：在官网登出

1. 用户在官网点击"退出登录"
2. 调用 `supabase.auth.signOut()`
3. `onAuthStateChange` 触发（event: 'SIGNED_OUT'）
4. 官网清除本地状态
5. Supabase 清除 `localStorage` 中的 token
6. 插件的 `onAuthStateChange` 触发
7. 插件自动更新为未登录状态

### 场景 4：在插件登出

1. 用户在插件中点击"退出登录"
2. 调用 `supabase.auth.signOut()`
3. `onAuthStateChange` 触发（event: 'SIGNED_OUT'）
4. 插件清除本地状态
5. Supabase 清除 `chrome.storage.local` 中的 token
6. 官网的 `onAuthStateChange` 触发
7. 官网自动更新为未登录状态

## 技术细节

### Supabase Session 存储

**官网（Web 环境）：**

- 存储位置：`localStorage`
- Key 格式：`sb-{project-ref}-auth-token`
- 值：JSON 格式的 session 对象

**插件（Chrome Extension 环境）：**

- 存储位置：`chrome.storage.local`
- Key 格式：`sb-{project-ref}-auth-token`
- 值：JSON 格式的 session 对象

### 同步延迟

- **Supabase Auth State Change**：几乎实时（< 100ms）
- **Storage Event**：几乎实时（< 100ms）
- **跨环境同步**：取决于 Supabase 的 token 刷新机制（通常 < 1s）

## 用户体验

✅ **最佳体验**：

- 在官网登录 → 插件立即显示已登录
- 在插件登录 → 官网立即显示已登录
- 在任一端登出 → 另一端立即显示未登录
- 无需手动刷新或重新打开

✅ **容错机制**：

- 如果一端未运行，下次打开时会自动同步最新状态
- 如果网络断开，恢复后会自动重新同步
- Token 过期时会自动刷新（Supabase 自动处理）

## 测试步骤

1. **测试官网 → 插件同步**：
   - 打开官网和插件
   - 在官网登录
   - 验证插件自动显示已登录状态

2. **测试插件 → 官网同步**：
   - 打开官网和插件
   - 在插件登录
   - 验证官网自动显示已登录状态

3. **测试登出同步**：
   - 在任一端登出
   - 验证另一端自动显示未登录状态

4. **测试多标签页同步**：
   - 打开多个官网标签页
   - 在一个标签页登录/登出
   - 验证其他标签页自动同步

## 故障排查

### 问题：同步不生效

**可能原因**：

1. Supabase 配置不一致
2. 监听器未正确设置
3. 浏览器阻止了 storage 事件

**解决方案**：

1. 检查 `.env` 文件中的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 是否一致
2. 检查控制台是否有错误日志
3. 尝试刷新页面或重启插件

### 问题：同步延迟较大

**可能原因**：

1. 网络延迟
2. Supabase token 刷新延迟

**解决方案**：

1. 检查网络连接
2. 等待几秒钟，Supabase 会自动刷新 token

## 未来优化

- [ ] 添加手动刷新按钮（作为备用方案）
- [ ] 添加同步状态指示器
- [ ] 优化同步性能（减少不必要的 API 调用）
- [ ] 添加离线支持（缓存用户信息）
