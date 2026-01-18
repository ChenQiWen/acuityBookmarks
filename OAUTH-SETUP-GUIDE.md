# OAuth 配置指南

## 问题诊断

你遇到的错误 `Authorization page could not be loaded` 是因为 Supabase 项目中没有配置正确的 OAuth 重定向 URL。

## 解决步骤

### 1. 获取当前的 Chrome Extension ID

#### 方法 1：通过 Chrome 扩展页面

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 确保右上角的 **开发者模式** 已开启
4. 找到 **AcuityBookmarks** 扩展
5. 复制扩展 ID（32 个字符，类似：`gdjcmpenmogdikhnnaebmddhmdgbfcgl`）

#### 方法 2：通过浏览器控制台（推荐）

1. 打开扩展的任意页面（如登录页面）
2. 按 F12 打开浏览器控制台
3. 复制并运行以下脚本：

```javascript
console.log('Extension ID:', chrome.runtime.id);
console.log('需要配置的 URL:', `https://${chrome.runtime.id}.chromiumapp.org/`);
```

或者运行项目中的诊断脚本：
```bash
cat scripts/diagnose-extension-id.js
```
然后复制输出的脚本到浏览器控制台运行。

### 2. 验证并更新 Supabase 重定向 URL

从你的截图中，我看到你已经配置了：
```
https://gdjcmpenmogdikhnnaebmddhmdgbfcgl.chromiumapp.org/
```

**重要**：请确认这个 ID (`gdjcmpenmogdikhnnaebmddhmdgbfcgl`) 是否与你当前安装的扩展 ID 一致。

如果不一致，请按以下步骤更新：

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目（`ugxgxytykxblctsyulsg`）
3. 进入 **Authentication** → **URL Configuration**
4. 在 **Redirect URLs** 部分：
   - 删除旧的 `chromiumapp.org` URL（如果 ID 不匹配）
   - 点击 **Add URL**
   - 添加新的 URL：`https://<你的当前扩展ID>.chromiumapp.org/`
5. 点击 **Save**

**注意**：
- URL 末尾必须有斜杠 `/`
- 必须使用 `https` 协议
- 域名必须是 `.chromiumapp.org`

### 3. 配置 Google OAuth Provider

1. 在 Supabase Dashboard 中，进入 **Authentication** → **Providers**
2. 找到 **Google** provider
3. 点击 **Enable**
4. 你需要配置 Google OAuth Client ID 和 Secret：

#### 3.1 创建 Google OAuth 凭据

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择或创建一个项目
3. 进入 **APIs & Services** → **Credentials**
4. 点击 **Create Credentials** → **OAuth 2.0 Client ID**
5. 选择 **Application type**: **Web application**
6. 在 **Authorized redirect URIs** 中添加：
   ```
   https://ugxgxytykxblctsyulsg.supabase.co/auth/v1/callback
   ```
   （替换为你的 Supabase 项目 URL）
7. 点击 **Create**
8. 复制 **Client ID** 和 **Client Secret**

#### 3.2 在 Supabase 中配置 Google OAuth

1. 回到 Supabase Dashboard → **Authentication** → **Providers** → **Google**
2. 粘贴 **Client ID** 和 **Client Secret**
3. 点击 **Save**

### 4. 重新加载扩展并测试

1. 在 `chrome://extensions/` 页面，点击 AcuityBookmarks 扩展的 **刷新** 按钮
2. 打开扩展的登录页面
3. 点击 **使用 Google 账号** 按钮
4. 应该能正常打开 Google 授权页面

## 常见问题

### Q: 为什么需要 `chromiumapp.org` 域名？

A: 这是 Chrome Extension OAuth 的标准做法。Chrome 会拦截对 `https://<extension-id>.chromiumapp.org/` 的重定向，并将授权结果传递给扩展。

### Q: 我有多个 Supabase 项目 URL，应该用哪个？

A: 根据你的 `.env.local` 文件：
- 根目录使用：`https://ugxgxytykxblctsyulsg.supabase.co`
- 这是你应该配置的项目

### Q: 配置后还是报错怎么办？

A: 请检查：
1. 重定向 URL 是否完全匹配（包括末尾的 `/`）
2. Google OAuth 凭据中的回调 URL 是否正确
3. 是否已重新加载 Chrome 扩展
4. 浏览器控制台是否有其他错误信息

## 验证配置

运行以下命令验证环境变量配置：

```bash
bun run scripts/check-oauth-config.mjs
```

## 需要帮助？

如果按照上述步骤操作后仍然有问题，请提供：
1. Chrome Extension ID
2. Supabase 项目 URL
3. 浏览器控制台的完整错误信息
