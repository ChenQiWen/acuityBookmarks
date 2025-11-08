# Supabase 邮件模板配置指南

## 📧 邮件模板配置位置

Supabase Dashboard → Authentication → Email Templates

## 🔧 需要配置的邮件模板

### 1. 密码重置邮件（Reset Password）

**模板位置：** `Reset Password` 模板

**当前问题：**

- 默认使用站点 URL（`http://localhost:3000`）
- 邮件中的链接无法在 Chrome Extension 中打开

**解决方案：**

#### 方法 1：修改邮件模板（推荐）

在 Supabase Dashboard 中编辑 `Reset Password` 模板，将链接改为 Chrome Extension URL：

```html
<h2>重置密码</h2>
<p>点击下面的链接重置您的密码：</p>
<p>
  <a
    href="chrome-extension://gdjcmpenmogdikhnnaebmddhmdgbfcgl/auth.html?reset=true#access_token={{ .Token }}&type=recovery"
  >
    重置密码
  </a>
</p>
<p>或者复制以下链接到浏览器地址栏：</p>
<p>
  chrome-extension://gdjcmpenmogdikhnnaebmddhmdgbfcgl/auth.html?reset=true#access_token={{
  .Token }}&type=recovery
</p>
```

**注意：**

- `gdjcmpenmogdikhnnaebmddhmdgbfcgl` 是你的扩展 ID
- `{{ .Token }}` 是 Supabase 的模板变量，会自动替换为实际的 token
- `type=recovery` 标识这是密码重置链接

#### 方法 2：使用代码中的 redirectTo（已配置）

代码中已经配置了 `redirectTo`：

```typescript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: chrome.runtime.getURL('auth.html?reset=true')
})
```

但 Supabase 可能仍会使用站点 URL，所以建议同时修改邮件模板。

### 2. 邮箱验证邮件（Email Verification）

**模板位置：** `Confirm Signup` 模板

**当前问题：**

- 默认使用站点 URL
- 邮件中的链接无法在 Chrome Extension 中打开

**解决方案：**

编辑 `Confirm Signup` 模板：

```html
<h2>验证您的邮箱</h2>
<p>点击下面的链接验证您的邮箱：</p>
<p>
  <a
    href="chrome-extension://gdjcmpenmogdikhnnaebmddhmdgbfcgl/auth.html#access_token={{ .Token }}&type=signup"
  >
    验证邮箱
  </a>
</p>
<p>或者复制以下链接到浏览器地址栏：</p>
<p>
  chrome-extension://gdjcmpenmogdikhnnaebmddhmdgbfcgl/auth.html#access_token={{
  .Token }}&type=signup
</p>
```

**注意：**

- `type=signup` 标识这是邮箱验证链接
- 如果邮箱验证已禁用，此模板不会被使用

### 3. 魔法链接邮件（Magic Link）

**模板位置：** `Magic Link` 模板

**当前问题：**

- 默认使用站点 URL
- 邮件中的链接无法在 Chrome Extension 中打开

**解决方案：**

编辑 `Magic Link` 模板：

```html
<h2>登录链接</h2>
<p>点击下面的链接登录：</p>
<p>
  <a
    href="chrome-extension://gdjcmpenmogdikhnnaebmddhmdgbfcgl/auth.html#access_token={{ .Token }}"
  >
    登录
  </a>
</p>
<p>或者复制以下链接到浏览器地址栏：</p>
<p>
  chrome-extension://gdjcmpenmogdikhnnaebmddhmdgbfcgl/auth.html#access_token={{
  .Token }}
</p>
```

## 🔍 如何获取扩展 ID

扩展 ID 可以在以下位置找到：

1. **Chrome 扩展管理页面：**
   - 打开 `chrome://extensions/`
   - 找到你的扩展
   - 复制扩展 ID

2. **代码中获取：**

   ```typescript
   const extensionId = chrome.runtime.id
   console.log('扩展 ID:', extensionId)
   ```

3. **manifest.json：**
   - 如果使用了固定的扩展 ID，可以在 `manifest.json` 中找到

## ⚠️ 注意事项

### 1. Chrome Extension URL 限制

Chrome Extension URL (`chrome-extension://`) 无法直接在邮件中点击打开，因为：

- 邮件客户端不支持 `chrome-extension://` 协议
- 用户需要手动复制链接到浏览器地址栏

### 2. 替代方案：使用中间页面

如果希望用户可以直接点击邮件链接，可以：

1. **创建一个中间页面（如 GitHub Pages）：**

   ```
   https://your-username.github.io/acuityBookmarks/auth-redirect.html
   ```

2. **中间页面自动跳转到扩展：**

   ```html
   <!DOCTYPE html>
   <html>
     <head>
       <meta charset="UTF-8" />
       <title>正在跳转...</title>
     </head>
     <body>
       <script>
         // 从 URL 参数中获取 token
         const urlParams = new URLSearchParams(window.location.search)
         const token = urlParams.get('token')
         const type = urlParams.get('type') || ''

         // 构建扩展 URL
         const extensionUrl = `chrome-extension://gdjcmpenmogdikhnnaebmddhmdgbfcgl/auth.html#access_token=${token}${type ? '&type=' + type : ''}`

         // 尝试打开扩展
         window.location.href = extensionUrl

         // 如果无法打开，显示提示
         setTimeout(() => {
           document.body.innerHTML = `
           <h2>无法自动打开扩展</h2>
           <p>请手动复制以下链接到浏览器地址栏：</p>
           <p><a href="${extensionUrl}">${extensionUrl}</a></p>
           <p>或者点击扩展图标打开应用。</p>
         `
         }, 2000)
       </script>
     </body>
   </html>
   ```

3. **邮件模板中使用中间页面：**
   ```html
   <a
     href="https://your-username.github.io/acuityBookmarks/auth-redirect.html?token={{ .Token }}&type=recovery"
   >
     重置密码
   </a>
   ```

### 3. 站点 URL 配置

即使修改了邮件模板，站点 URL 仍建议配置为：

- 如果有实际网站：填写实际网站 URL
- 如果没有：填写占位符 URL（如 `https://acuitybookmarks.com`）

站点 URL 仍用于：

- 邮件模板中的 `{{ .SiteURL }}` 变量（如果使用）
- 其他 Supabase 功能的默认 URL

## ✅ 检查清单

- [ ] 修改 `Reset Password` 邮件模板
- [ ] 修改 `Confirm Signup` 邮件模板（如果启用邮箱验证）
- [ ] 修改 `Magic Link` 邮件模板（如果使用）
- [ ] 更新站点 URL 为有效的 HTTPS URL
- [ ] 测试密码重置邮件链接
- [ ] 测试邮箱验证邮件链接（如果启用）

## 🧪 测试步骤

1. **测试密码重置：**
   - 在扩展中点击"忘记密码"
   - 输入邮箱地址
   - 检查收到的邮件
   - 复制链接到浏览器地址栏测试

2. **测试邮箱验证：**
   - 注册新账户（如果启用邮箱验证）
   - 检查收到的邮件
   - 复制链接到浏览器地址栏测试

## 📝 代码中的配置

代码中已经正确配置了 `redirectTo`：

```typescript
// 密码重置
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: chrome.runtime.getURL('auth.html?reset=true')
})

// 邮箱注册
await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: chrome.runtime.getURL('auth.html')
  }
})
```

这些配置会传递给 Supabase，但邮件模板中的链接仍需要手动修改。
