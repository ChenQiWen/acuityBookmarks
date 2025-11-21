# Lighthouse CI Server 设置指南

## 📊 为什么需要 LHCI Server？

### 优势

- ✅ **历史趋势追踪** - 查看性能随时间的变化
- ✅ **对比分析** - 对比不同版本的性能
- ✅ **团队协作** - 团队成员共享性能数据
- ✅ **性能退化警报** - 自动检测性能下降
- ✅ **可视化仪表板** - 直观的图表和报告

---

## 🚀 部署选项

### 选项 1: 使用 Vercel/Netlify（推荐）

#### 1. 创建 LHCI Server 项目

```bash
# 创建新目录
mkdir lhci-server
cd lhci-server

# 初始化项目
bun init -y

# 安装依赖
bun add @lhci/server
```

#### 2. 创建配置文件

```javascript
// server.js
const { createServer } = require('@lhci/server')

const server = createServer({
  port: process.env.PORT || 9001,
  storage: {
    storageMethod: 'sql',
    sqlDialect: 'postgres',
    sqlConnectionUrl: process.env.DATABASE_URL
  }
})

server.listen()
```

#### 3. 部署到 Vercel

```bash
# 安装 Vercel CLI
bun add -g vercel

# 部署
vercel
```

---

### 选项 2: 使用 Docker（自托管）

#### 1. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  lhci-server:
    image: patrickhulce/lhci-server:latest
    ports:
      - '9001:9001'
    environment:
      - LHCI_STORAGE__SQL_DIALECT=postgres
      - LHCI_STORAGE__SQL_CONNECTION_URL=postgresql://lhci:password@postgres:5432/lhci
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=lhci
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=lhci
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

#### 2. 启动服务

```bash
docker-compose up -d
```

---

### 选项 3: 使用 Cloudflare Workers + D1（最简单）

#### 1. 创建 Cloudflare D1 数据库

```bash
wrangler d1 create lhci-database
```

#### 2. 部署 LHCI Server

```bash
# 克隆 LHCI Server Workers 模板
git clone https://github.com/GoogleChrome/lighthouse-ci-workers
cd lighthouse-ci-workers

# 配置 wrangler.toml
# 添加 D1 数据库绑定

# 部署
wrangler deploy
```

---

## 🔧 配置项目使用 LHCI Server

### 1. 创建项目并获取 Token

访问 LHCI Server 管理界面：

```
https://lhci.acuitybookmarks.com
```

1. 创建新项目 "AcuityBookmarks Website"
2. 创建新项目 "AcuityBookmarks Extension"
3. 复制生成的 Build Token

### 2. 配置 GitHub Secrets

在 GitHub 仓库设置中添加 Secrets：

```
LHCI_SERVER_TOKEN_WEBSITE=<website-token>
LHCI_SERVER_TOKEN_FRONTEND=<frontend-token>
```

### 3. 更新 lighthouserc.json

已配置：

```json
{
  "upload": {
    "target": "lhci",
    "serverBaseUrl": "https://lhci.acuitybookmarks.com",
    "token": "" // 通过环境变量 LHCI_BUILD_TOKEN 提供
  }
}
```

### 4. 更新 GitHub Actions

已配置在 `.github/workflows/lighthouse.yml`：

```yaml
env:
  LHCI_BUILD_TOKEN: ${{ secrets.LHCI_SERVER_TOKEN_WEBSITE }}
```

---

## 📈 使用 LHCI Server

### 查看报告

访问：

```
https://lhci.acuitybookmarks.com/app/projects/acuitybookmarks-website
```

### 功能

1. **历史趋势图**
   - 性能分数随时间变化
   - 各项指标的趋势
   - 对比不同分支

2. **详细报告**
   - 每次构建的完整 Lighthouse 报告
   - 可以下载 HTML/JSON 报告
   - 查看所有审计项

3. **对比功能**
   - 对比两次构建的差异
   - 查看性能退化
   - 分析变化原因

4. **警报设置**
   - 性能低于阈值时发送通知
   - 集成 Slack/Email

---

## 🎯 替代方案（如果不想自建）

### 1. 使用 Google Cloud Storage（当前方案）

```json
{
  "upload": {
    "target": "temporary-public-storage"
  }
}
```

**优点：**

- ✅ 无需配置
- ✅ 免费
- ✅ 报告自动上传

**缺点：**

- ❌ 报告 7 天后删除
- ❌ 无历史趋势
- ❌ 无对比功能

### 2. 使用 GitHub Actions Artifacts

已配置在 workflow 中：

```yaml
- name: Upload Lighthouse artifacts
  uses: actions/upload-artifact@v4
  with:
    name: lighthouse-report
    retention-days: 7
```

**优点：**

- ✅ 集成在 GitHub 中
- ✅ 易于访问

**缺点：**

- ❌ 7 天后删除
- ❌ 无可视化界面

---

## 💡 推荐方案

### 阶段 1：当前（无需额外配置）

```
✅ GitHub Actions 自动运行
✅ 上传到 Google Cloud Storage
✅ PR 自动评论结果
✅ Artifacts 保存 7 天
```

### 阶段 2：需要历史趋势时

```
1. 部署 LHCI Server（推荐 Cloudflare Workers + D1）
2. 配置 GitHub Secrets
3. 更新 lighthouserc.json 的 token
4. 享受历史趋势和对比功能
```

---

## 🔐 安全注意事项

1. **Token 管理**
   - ✅ 使用 GitHub Secrets 存储 token
   - ❌ 不要在代码中硬编码 token
   - ✅ 为不同项目使用不同的 token

2. **Server 访问控制**
   - ✅ 设置身份验证
   - ✅ 限制 API 访问
   - ✅ 使用 HTTPS

3. **数据保留**
   - 定期清理旧数据
   - 设置合理的保留期限

---

## 📝 总结

**当前状态：**

- ✅ 性能预算已配置
- ✅ GitHub Actions 已配置
- ✅ LHCI Server 配置已准备（需要部署）

**下一步：**

1. 如果需要历史趋势，部署 LHCI Server
2. 配置 GitHub Secrets
3. 更新 lighthouserc.json 的 token

**如果暂时不需要历史趋势：**

- 当前配置已经足够
- 报告会上传到 Google Cloud Storage
- GitHub Actions 会自动运行审计
- PR 会自动评论结果

🎉 **配置完成！**
