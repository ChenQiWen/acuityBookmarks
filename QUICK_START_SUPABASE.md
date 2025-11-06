# 🚀 Supabase 快速接入指南

## 第一步：获取 Supabase 配置信息

### 1. 访问 Supabase Dashboard

你已经创建了项目，现在需要获取配置信息：

1. 访问 https://supabase.com/dashboard
2. 选择你的项目 `acuityBookmarks`
3. 点击左侧菜单的 **Settings** (⚙️ 图标)
4. 点击 **API**

### 2. 复制配置信息

在 API 设置页面，你会看到：

- **Project URL**: `https://ugxgxytykxblctsyulsg.supabase.co`（根据你的项目）
- **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（很长的字符串）
- **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（⚠️ 保密，仅后端使用）

---

## 第二步：配置前端环境变量

### 1. 创建 `.env.local` 文件

在 `frontend/` 目录下创建 `.env.local` 文件：

```bash
cd frontend
touch .env.local
```

### 2. 添加配置

编辑 `frontend/.env.local`，填入你的配置：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon_public_key
```

**示例：**

```bash
VITE_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneHh4eXR5a3hibGN0c3l1bHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk4NzY1NDAsImV4cCI6MjAzNTQ1MjU0MH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
bun run dev
```

---

## 第三步：配置 Chrome Extension 重定向 URL（重要！）

### 1. 获取 Extension ID

开发时：

- 打开 Chrome → `chrome://extensions/`
- 找到你的扩展
- 复制 Extension ID（例如：`abcdefghijklmnopqrstuvwxyz123456`）

### 2. 在 Supabase 中配置重定向 URL

1. 在 Supabase Dashboard → **Authentication** → **URL Configuration**
2. 找到 **Redirect URLs** 部分
3. 添加以下 URL：

   ```
   chrome-extension://YOUR_EXTENSION_ID/auth.html
   chrome-extension://YOUR_EXTENSION_ID/*
   ```

   将 `YOUR_EXTENSION_ID` 替换为你的实际扩展 ID

4. 点击 **Save**

---

## 第四步：测试连接

### 1. 检查配置

打开浏览器控制台，应该看到：

```
✅ Supabase 配置已加载
```

而不是：

```
⚠️ Supabase 环境变量未配置
```

### 2. 测试登录

1. 打开扩展的设置页面
2. 点击"账户"标签
3. 尝试注册/登录

---

## 🎉 完成！

现在你的 Supabase 项目已经接入成功了！

### 下一步

- 📖 查看 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 了解详细配置
- 🔐 查看 [SUPABASE_SECURITY.md](./SUPABASE_SECURITY.md) 了解安全性说明
- 🗄️ 查看 [backend/supabase-schema.sql](./backend/supabase-schema.sql) 了解数据库结构

---

## ❓ 常见问题

### Q: `.env.local` 文件应该提交到 Git 吗？

**A:**

- ✅ `.env.local` 应该添加到 `.gitignore`（避免提交）
- ✅ `.env.example` 可以提交（不包含真实密钥）
- 即使 ANON KEY 泄露也是安全的（设计上就是公开的）

### Q: 开发和生产环境需要不同的配置吗？

**A:**

- 开发环境：使用 `.env.local`
- 生产环境：在构建时设置环境变量，或使用 CI/CD 配置

### Q: 如何确认配置是否正确？

**A:**

- 检查浏览器控制台是否有警告
- 尝试登录/注册功能
- 检查 Supabase Dashboard → Logs 查看请求
