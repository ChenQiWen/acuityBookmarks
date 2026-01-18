# Google OAuth 登录故障排查指南

## 问题描述

使用 Google 登录时提示"无法连接服务器"。

## 快速诊断步骤

### 步骤 1：检查 Supabase 配置

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目（ugxgxytykxblctsyulsg）
3. 进入 **Authentication** → **Providers**
4. 检查 **Google** 提供商是否已启用

**预期结果：**
- ✅ Google 提供商显示为"已启用"（绿色）
- ✅ 已填入 Google OAuth Client ID
- ✅ 已填入 Google OAuth Client Secret

**如果未启用：**
1. 点击 Google 提供商
2. 切换"启用"开关
3. 填入 Google OAuth 凭据（见下方"获取 Google OAuth 凭据"）
4. 点击"保存"

---

### 步骤 2：检查重定向 URL 配置

1. 在 Supabase Dashboard 中，进入 **Authentication** → **URL Configuration**
2. 找到 **Redirect URLs** 部分
3. 检查是否包含 Chrome Extension 的重定向 URL

**Chrome Extension 重定向 URL 格式：**
```
https://<extension-id>.chromiumapp.org/
```

**如何获取 Extension ID：**
1. 打开 Chrome 浏览器
2. 进入 `chrome://extensions/`
3. 找到 AcuityBookmarks 扩展
4. 复制"ID"字段的值（例如：`abcdefghijklmnopqrstuvwxyz123456`）
5. 构造重定向 URL：`https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/`

**添加重定向 URL：**
1. 在 Supabase Dashboard 的 **Redirect URLs** 中点击"添加 URL"
2. 粘贴上述 URL
3. 点击"保存"

**⚠️ 注意：**
- URL 必须以 `https://` 开头
- URL 必须以 `.chromiumapp.org/` 结尾
- Extension ID 必须与实际安装的扩展 ID 完全一致

---

### 步骤 3：检查网络连接

1. 打开浏览器开发者工具（F12）
2. 切换到 **Network** 标签
3. 点击"使用 Google 登录"按钮
4. 查看网络请求

**预期结果：**
- ✅ 看到对 `https://ugxgxytykxblctsyulsg.supabase.co` 的请求
- ✅ 请求状态为 200 或 302

**如果请求失败：**
- ❌ 状态码 0 或 ERR_CONNECTION_REFUSED → 网络连接问题
- ❌ 状态码 401 → Supabase Anon Key 配置错误
- ❌ 状态码 404 → Supabase URL 配置错误
- ❌ 状态码 500 → Supabase 服务器错误

---

### 步骤 4：检查浏览器控制台错误

1. 打开浏览器开发者工具（F12）
2. 切换到 **Console** 标签
3. 点击"使用 Google 登录"按钮
4. 查看控制台中的错误信息

**常见错误及解决方法：**

#### 错误 1：`Supabase 未配置`
**原因：** `.env.local` 文件中缺少 Supabase 配置

**解决方法：**
1. 检查 `.env.local` 文件是否存在
2. 确保包含以下配置：
   ```env
   VITE_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. 重启开发服务器（`bun run dev`）

#### 错误 2：`未获取到授权 URL`
**原因：** Google OAuth 未在 Supabase 中启用

**解决方法：**
- 参考"步骤 1：检查 Supabase 配置"

#### 错误 3：`Authorization page could not be loaded`
**原因：** 重定向 URL 未配置或配置错误

**解决方法：**
- 参考"步骤 2：检查重定向 URL 配置"

#### 错误 4：`chrome.identity is not available`
**原因：** `manifest.json` 中缺少 `identity` 权限

**解决方法：**
1. 打开 `frontend/manifest.json`
2. 检查 `permissions` 数组中是否包含 `"identity"`
3. 如果缺少，添加后重新加载扩展

---

## 获取 Google OAuth 凭据

如果你还没有 Google OAuth Client ID 和 Client Secret，请按以下步骤获取：

### 1. 创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击顶部的项目选择器
3. 点击"新建项目"
4. 输入项目名称（例如：AcuityBookmarks）
5. 点击"创建"

### 2. 启用 Google+ API

1. 在左侧菜单中，选择 **API 和服务** → **库**
2. 搜索"Google+ API"
3. 点击"启用"

### 3. 创建 OAuth 2.0 凭据

1. 在左侧菜单中，选择 **API 和服务** → **凭据**
2. 点击"创建凭据" → "OAuth 客户端 ID"
3. 如果提示配置同意屏幕，点击"配置同意屏幕"：
   - 用户类型：选择"外部"
   - 应用名称：AcuityBookmarks
   - 用户支持电子邮件：你的邮箱
   - 开发者联系信息：你的邮箱
   - 点击"保存并继续"
   - 作用域：跳过（使用默认）
   - 测试用户：添加你的 Google 账号
   - 点击"保存并继续"
4. 返回"创建 OAuth 客户端 ID"页面
5. 应用类型：选择"Web 应用"
6. 名称：AcuityBookmarks Web Client
7. 已获授权的重定向 URI：
   - 添加 Supabase 回调 URL：`https://ugxgxytykxblctsyulsg.supabase.co/auth/v1/callback`
   - 添加 Chrome Extension URL：`https://<extension-id>.chromiumapp.org/`
8. 点击"创建"
9. 复制 **客户端 ID** 和 **客户端密钥**

### 4. 配置到 Supabase

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入 **Authentication** → **Providers**
3. 点击 **Google**
4. 粘贴 **Client ID** 和 **Client Secret**
5. 点击"保存"

---

## 运行诊断脚本

我们提供了一个自动诊断脚本，可以帮助你快速定位问题。

### 使用方法

1. 打开 Chrome Extension 的弹窗或侧边栏
2. 打开浏览器开发者工具（F12）
3. 切换到 **Console** 标签
4. 复制并粘贴以下代码：

```javascript
// 诊断脚本（见 scripts/diagnose-oauth.ts）
// 由于浏览器环境限制，请直接在控制台运行以下简化版本：

(async () => {
  console.log('=== OAuth 登录诊断 ===\n')
  
  // 1. 检查 Extension ID
  const extensionId = chrome.runtime.id
  console.log('Extension ID:', extensionId)
  console.log('重定向 URL:', `https://${extensionId}.chromiumapp.org/`)
  
  // 2. 检查 chrome.identity API
  if (chrome.identity?.launchWebAuthFlow) {
    console.log('✅ chrome.identity API 可用')
  } else {
    console.error('❌ chrome.identity API 不可用')
  }
  
  // 3. 测试 Supabase 连接
  const supabaseUrl = 'https://ugxgxytykxblctsyulsg.supabase.co'
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneGd4eXR5a3hibGN0c3l1bHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMTAyMzMsImV4cCI6MjA3Nzg4NjIzM30.yMc_fi7uiq4oFqzG76_o5sM3oV9FKdE1LFTKe7AZ7OY'
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })
    
    if (response.ok) {
      console.log('✅ Supabase API 连接正常')
    } else {
      console.error('❌ Supabase API 错误:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('❌ 无法连接 Supabase:', error)
  }
  
  console.log('\n=== 诊断完成 ===')
})()
```

5. 按 Enter 运行
6. 查看输出结果

---

## 常见问题 FAQ

### Q1: 为什么之前可以登录，现在不行了？

**可能原因：**
1. Chrome Extension 重新安装后，Extension ID 发生变化
2. Supabase 配置被修改
3. Google OAuth 凭据过期或被撤销

**解决方法：**
- 检查 Extension ID 是否与 Supabase 中配置的一致
- 重新配置重定向 URL（使用新的 Extension ID）

### Q2: 点击登录按钮后没有任何反应

**可能原因：**
1. JavaScript 错误阻止了登录流程
2. `chrome.identity` API 不可用

**解决方法：**
- 打开浏览器控制台（F12）查看错误信息
- 检查 `manifest.json` 中是否包含 `identity` 权限

### Q3: 弹出授权窗口后立即关闭

**可能原因：**
1. 重定向 URL 配置错误
2. Google OAuth 凭据配置错误

**解决方法：**
- 检查 Supabase Dashboard 中的重定向 URL 配置
- 检查 Google Cloud Console 中的 OAuth 凭据配置

### Q4: 授权成功但未登录

**可能原因：**
1. Token 提取失败
2. Session 保存失败

**解决方法：**
- 打开浏览器控制台查看详细日志
- 检查 `chrome.storage.local` 权限是否正常

---

## 联系支持

如果以上步骤都无法解决问题，请提供以下信息：

1. **浏览器控制台的完整错误日志**（F12 → Console）
2. **网络请求日志**（F12 → Network）
3. **Extension ID**（`chrome://extensions/` 中查看）
4. **Supabase 项目 URL**
5. **操作系统和浏览器版本**

将以上信息发送至：support@acuitybookmarks.com

---

**最后更新**: 2025-01-13
