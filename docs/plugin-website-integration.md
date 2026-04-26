# 插件与官网集成说明

## 概述

插件中的认证和账户管理功能已迁移到官网，插件通过跳转到官网的方式实现这些功能。

## 架构设计

### 职责划分

**插件职责：**

- 书签管理核心功能
- OAuth 回调处理（`auth.html` 页面）
- 本地数据存储和同步
- 插件图标点击 → 跳转到官网登录页

**官网职责：**

- 用户登录/注册（OAuth 流程）
- 账户信息展示和管理
- 订阅/定价页面
- 服务条款和隐私政策

### 为什么保留 `auth.html`？

插件中的 `auth.html` 页面**必须保留**，因为：

1. **OAuth 回调处理**：Chrome Extension 的 OAuth 流程需要一个回调页面来接收 token
2. **Token 提取**：从 URL hash 中提取 `access_token` 和 `refresh_token`
3. **Session 设置**：调用 Supabase 的 `setSession()` 方法设置认证状态

**流程：**

```
用户点击"登录" → 跳转到官网登录页 → OAuth 授权 →
回调到插件 auth.html → 提取 token → 设置 session → 跳转到主页
```

### 为什么删除 `account.html`？

插件中的 `account.html` 页面**已删除**，因为：

1. **功能迁移**：账户管理功能已完全迁移到官网
2. **避免重复**：保留会导致功能重复和维护成本增加
3. **统一体验**：所有账户相关操作都在官网完成，体验更统一

## 配置文件

### 官网 URL 配置

文件：`frontend/src/config/website.ts`

```typescript
export const websiteUrls = {
  home: 'https://acuitybookmarks.com',
  login: 'https://acuitybookmarks.com/login',
  account: 'https://acuitybookmarks.com/account',
  pricing: 'https://acuitybookmarks.com/pricing',
  terms: 'https://acuitybookmarks.com/terms',
  privacy: 'https://acuitybookmarks.com/privacy'
}
```

### 环境变量

文件：`frontend/.env.local`

```bash
# 开发环境
VITE_WEBSITE_URL=http://localhost:3001

# 生产环境（在 CI/CD 中设置）
VITE_WEBSITE_URL=https://acuitybookmarks.com
```

## 修改的组件

### 1. UserMenu.vue

**位置：** `frontend/src/components/composite/UserMenu/UserMenu.vue`

**修改：**

- **未登录状态**：点击登录图标直接跳转到官网登录页（不再显示下拉菜单）
- **已登录状态**：点击头像显示下拉菜单，包含"账户中心"、"升级到 PRO"、"退出登录"等选项

### 2. AccountSettings.vue

**位置：** `frontend/src/components/composite/UserMenu/UserMenu.vue`

**修改：**

- "登录/注册" 按钮 → 跳转到官网登录页
- "账户中心" 按钮 → 跳转到官网账户页
- "升级到 PRO" 按钮 → 跳转到官网定价页

### 2. AccountSettings.vue

**位置：** `frontend/src/pages/settings/sections/AccountSettings.vue`

**修改：**

- "退出登录" 后 → 跳转到官网登录页（而不是插件的 auth.html）

### 3. ProGate.vue

**位置：** `frontend/src/pages/settings/sections/ProGate.vue`

**修改：**

- "登录后解锁" 按钮 → 跳转到官网登录页
- "升级到 PRO" 按钮 → 跳转到官网定价页

### 6. Account.vue（已删除）

**位置：** `frontend/src/pages/account/Account.vue`

**状态：** 已删除，功能已完全迁移到官网

### 7. Auth.vue

**位置：** `frontend/src/pages/account/Account.vue`

**修改：**

- "登录/注册" 按钮 → 跳转到官网登录页
- "升级到 PRO" 按钮 → 跳转到官网定价页

### 8. Auth.vue

**位置：** `frontend/src/pages/auth/Auth.vue`

**修改：**

- 隐私政策链接 → 指向官网的服务条款和隐私政策页面

**注意：** 此页面必须保留，用于处理 OAuth 回调

## 用户体验流程

### 插件图标点击

1. 用户点击浏览器工具栏中的插件图标
2. 自动打开新标签页，跳转到官网登录页（`http://localhost:3001/login` 或 `https://acuitybookmarks.com/login`）
3. 用户在官网完成登录
4. 登录状态自动同步到插件

### 登录流程

1. 用户在插件中点击"登录"按钮
2. 打开新标签页，跳转到官网登录页（`https://acuitybookmarks.com/login`）
3. 用户选择 Google 或 Microsoft 登录
4. OAuth 授权完成后，回调到插件的 `auth.html` 页面
5. `auth.html` 提取 token 并设置 Supabase session
6. 跳转到插件主页（`management.html`）
7. 插件和官网的认证状态自动同步（通过 Supabase Auth State Change）

### 账户管理流程

1. 用户在插件中点击"账户中心"
2. 打开新标签页，跳转到官网账户页（`https://acuitybookmarks.com/account`）
3. 用户在官网查看和管理账户信息
4. 任何修改（如退出登录）会自动同步到插件

### 订阅流程

1. 用户在插件中点击"升级到 PRO"
2. 打开新标签页，跳转到官网定价页（`https://acuitybookmarks.com/pricing`）
3. 用户在官网完成订阅购买
4. 订阅状态自动同步到插件

## 双向同步机制

插件和官网的认证状态通过 Supabase 实现双向自动同步：

1. **Supabase Auth State Change 监听**
   - 插件和官网都监听 `supabase.auth.onAuthStateChange()` 事件
   - 任一端登录/登出，另一端自动更新

2. **Storage Event 监听**
   - 官网监听 `localStorage` 变化（多标签页同步）
   - 插件监听 `chrome.storage.local` 变化

详见：`docs/auth-sync.md`

## 开发和测试

### 本地开发

1. 启动官网开发服务器：

   ```bash
   bun run dev:website
   ```

2. 启动插件开发服务器：

   ```bash
   bun run dev:frontend
   ```

3. 确保 `frontend/.env.local` 中的 `VITE_WEBSITE_URL` 指向本地官网：
   ```bash
   VITE_WEBSITE_URL=http://localhost:3001
   ```

### 测试流程

1. **测试插件图标点击**：
   - 点击浏览器工具栏中的插件图标
   - 验证是否打开新标签页并跳转到 `http://localhost:3001/login`

2. **测试登录跳转**：
   - 在插件中点击"登录"
   - 验证是否跳转到 `http://localhost:3001/login`

3. **测试 OAuth 回调**：
   - 在官网完成 OAuth 登录
   - 验证是否回调到插件的 `auth.html`
   - 验证插件是否成功设置 session

4. **测试账户页跳转**：
   - 在插件中点击"账户中心"
   - 验证是否跳转到 `http://localhost:3001/account`

5. **测试双向同步**：
   - 在官网登录，验证插件是否自动更新
   - 在插件登出，验证官网是否自动更新

## 生产部署

### 环境变量配置

在 CI/CD 中设置：

```bash
# 插件构建
VITE_WEBSITE_URL=https://acuitybookmarks.com

# 官网构建
NUXT_PUBLIC_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=sb_publishable_2FY9uDfqNbLwUYXxgcu8lw_qQ8SEbXo
```

### Supabase 回调 URL 配置

在 Supabase Dashboard → Authentication → URL Configuration 中添加：

**插件回调 URL：**

- `https://{extension-id}.chromiumapp.org/`

**官网回调 URL：**

- `https://acuitybookmarks.com/auth/callback`
- `http://localhost:3001/auth/callback`（开发环境）

## 注意事项

1. **不要删除 `auth.html`**：这个页面是 OAuth 回调的必需页面
2. **`account.html` 已删除**：账户管理功能已完全迁移到官网
3. **环境变量同步**：修改 `.env` 后运行 `bun run env:sync` 同步到子项目
4. **测试双向同步**：每次修改认证逻辑后都要测试插件和官网的双向同步

## 未来优化

- [ ] 添加 redirect 参数，登录后返回原页面
- [ ] 优化跳转体验（减少标签页切换）
- [ ] 添加深度链接支持（从官网直接打开插件特定页面）
- [ ] 考虑使用 iframe 嵌入官网页面（避免跳转）
