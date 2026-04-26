# 认证架构澄清

## 当前状态

插件包含完整的 Supabase OAuth 认证流程：

- `useSupabaseAuth.ts` - 完整的 OAuth 登录逻辑
- `Auth.vue` - 认证页面
- `UserMenu.vue` - 用户菜单（包含登录按钮）
- `Settings.vue` - 设置页面（包含账户信息）

## 目标架构

### 官网（Website）

- 负责所有认证流程（登录、注册、OAuth）
- 管理 Supabase session
- 提供用户信息 API

### 插件（Extension）

- **保留**：
  - 用户状态显示（UserMenu）
  - 订阅状态显示
  - 设置页面
  - 账户信息展示
- **移除**：
  - OAuth 登录流程（`signInWithOAuth` 等方法）
  - 认证页面（`Auth.vue`）
- **修改**：
  - `useSupabaseAuth` → `useAuthSync`
  - 通过 `chrome.runtime.sendMessage` 与官网通信
  - 从官网同步用户状态，而不是直接调用 Supabase

## 实现方案

### 方案 A：完全移除 Supabase 客户端

- 插件不直接连接 Supabase
- 所有用户数据通过官网 API 获取
- 需要实现完整的消息通信机制

### 方案 B：保留 Supabase 客户端（推荐）

- 插件保留 Supabase 客户端用于读取 session
- 登录流程在官网完成后，session 自动同步到插件
- 插件只读取用户状态，不执行登录操作

## 建议

基于你的需求"插件还是需要用户状态的，只不过是同步官网的"，我建议：

**方案 B（保留 Supabase 客户端）**

理由：

1. Supabase session 是跨域共享的（同一个 Supabase 项目）
2. 用户在官网登录后，插件可以自动读取到 session
3. 只需移除插件的登录 UI，保留状态读取逻辑
4. 实现简单，维护成本低

### 具体修改

1. **保留文件**：
   - `frontend/src/composables/useSupabaseAuth.ts` - 保留状态读取逻辑
   - `frontend/src/composables/useSubscription.ts` - 保留订阅状态
   - `frontend/src/infrastructure/supabase/client.ts` - 保留 Supabase 客户端
   - `frontend/src/components/composite/UserMenu/UserMenu.vue` - 保留用户菜单
   - `frontend/src/pages/settings/` - 保留设置页面

2. **移除文件**：
   - `frontend/src/pages/auth/` - 移除认证页面（登录在官网完成）

3. **修改逻辑**：
   - `UserMenu.vue` 中的登录按钮 → 跳转到官网登录页
   - 移除 `useSupabaseAuth` 中的 `signInWithOAuth` 方法
   - 保留 `initialize`、`signOut` 等状态管理方法

## 下一步

请确认你希望采用哪个方案，我将据此进行代码修改。
