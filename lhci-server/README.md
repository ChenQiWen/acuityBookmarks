# Lighthouse CI Server

基于 Cloudflare Workers + D1 的 Lighthouse CI Server 部署。

## 🚀 快速开始

### 1. 创建 D1 数据库

```bash
cd lhci-server
wrangler d1 create lhci-database
```

复制输出的 `database_id` 到 `wrangler.toml`。

### 2. 创建 KV 命名空间

```bash
wrangler kv:namespace create CACHE
```

复制输出的 `id` 到 `wrangler.toml`。

### 3. 初始化数据库

```bash
bun run db:init
```

### 4. 部署

```bash
bun run deploy
```

### 5. 创建项目

访问：

```
https://lhci-server.<your-subdomain>.workers.dev/admin
```

使用 `LHCI_ADMIN_TOKEN` 登录，创建项目并获取 Build Token。

---

## 🔧 配置

### 环境变量

在 `wrangler.toml` 中配置：

```toml
[vars]
LHCI_ADMIN_TOKEN = "your-admin-token-here"
```

或使用 Secrets（更安全）：

```bash
wrangler secret put LHCI_ADMIN_TOKEN
```

---

## 📊 使用

### 在项目中配置

更新 `lighthouserc.json`：

```json
{
  "upload": {
    "target": "lhci",
    "serverBaseUrl": "https://lhci-server.<your-subdomain>.workers.dev",
    "token": "" // 通过环境变量提供
  }
}
```

### 在 GitHub Actions 中配置

```yaml
env:
  LHCI_BUILD_TOKEN: ${{ secrets.LHCI_BUILD_TOKEN }}
```

---

## 💡 注意

由于 Cloudflare Workers 的限制，完整的 LHCI Server 功能可能受限。

**推荐的替代方案：**

1. **使用 Google Cloud Storage（当前）**
   - 无需配置
   - 免费
   - 报告保留 7 天

2. **使用 Vercel + PostgreSQL**
   - 完整功能
   - 易于部署
   - 免费套餐足够使用

3. **自托管 Docker**
   - 完全控制
   - 无限存储
   - 需要服务器

---

## 🎯 当前推荐

**暂时不部署 LHCI Server**，使用当前配置：

- ✅ GitHub Actions 自动运行审计
- ✅ 报告上传到 Google Cloud Storage
- ✅ PR 自动评论结果
- ✅ Artifacts 保存 7 天

**当需要历史趋势时，再考虑部署。**
