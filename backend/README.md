# 🔧 AcuityBookmarks Backend - Cloudflare Worker

Cloudflare Workers 驱动的后端服务，简洁稳定、易于部署与维护。

## ⚡ 特性

- 🚀 **极致性能**: 启动速度提升3倍，API响应提升2倍
- 🔥 **Bun原生**: 充分利用Bun的性能优势
- 🌐 **现代API**: 支持智能书签分类和URL检测
- 📊 **性能监控**: 内置性能指标和基准测试
- 🛡️ **错误处理**: 优雅的错误处理和降级机制

## 🚀 快速开始

### 环境要求

- Bun >= 1.0.0

### 安装依赖

```bash
cd backend
bun install
```

### 启动服务

```bash
# 本地开发（wrangler）
bunx wrangler dev

# 部署到 Cloudflare
bunx wrangler deploy
```

### 健康检查

```bash
curl http://localhost:8787/api/health
```

## 📡 API端点

### 核心API

- `POST /api/start-processing` - 启动书签处理任务
- `GET /api/get-progress/:jobId` - 获取任务进度
- `POST /api/check-urls` - 批量URL状态检测
- `POST /api/classify-single` - 单个书签智能分类
- `POST /api/ai/complete` - AI聊天/补全（支持多提供商）
- `POST /api/ai/embedding` - 生成向量嵌入（支持多提供商）
- `GET /health` - 服务器健康状态

### 认证与账户

- `GET /api/auth/start` - 开始 OAuth（Dev/Google/GitHub）
- `GET /api/auth/callback` - OAuth 回调（含 PKCE）
- `GET /api/auth/providers` - 查看各 Provider 是否已配置（排查“provider not configured”）
- `GET /auth/dev/authorize` - Dev 提供商模拟授权（受环境变量门禁）
- `GET /api/auth/dev-login` - 直接签发测试 JWT（受环境变量门禁）

#### 首方账号（用户名/密码）

- `POST /api/auth/register` - 注册（email + password）
- `POST /api/auth/login` - 登录（返回 access_token + refresh_token）
- `POST /api/auth/refresh` - 刷新 Access Token（旋转 Refresh Token）
- `POST /api/auth/forgot-password` - 申请重置（生成一次性 reset_token）
- `POST /api/auth/reset-password` - 使用 reset_token 重置密码
- `POST /api/auth/change-password` - 已登录用户修改密码

说明：以上接口依赖 Cloudflare D1 绑定（env.DB），若未绑定将返回 501。

### 示例请求

```bash
# 智能分类
curl -X POST http://localhost:8787/api/classify-single \
  -H "Content-Type: application/json" \
  -d '{
    "bookmark": {
      "title": "GitHub - The world'\''s leading AI-powered developer platform",
      "url": "https://github.com"
    }
  }'

# URL检测
curl -X POST http://localhost:8787/api/check-urls \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://github.com", "https://stackoverflow.com"],
    "settings": {"timeout": 5000}
  }'
```

### AI 提供商与配置

- 通过环境变量 `AI_PROVIDER` 切换：`cloudflare | openai | groq | deepseek | gateway`
- 示例环境配置见 `backend/.env.example`
- 默认模型：
  - 文本补全 `DEFAULT_AI_MODEL`（默认 `@cf/meta/llama-3.1-8b-instruct`）
  - 向量嵌入 `DEFAULT_EMBEDDING_MODEL`（默认 `@cf/baai/bge-m3`）

示例：OpenAI 兼容聊天与嵌入

```bash
curl -X POST http://localhost:8787/api/ai/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"你好，简要总结这个项目。"}],
    "temperature": 0.6,
    "max_tokens": 256
  }'

curl -X POST http://localhost:8787/api/ai/embedding \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "openai",
    "model": "text-embedding-3-small",
    "text": "AcuityBookmarks 是一个高性能书签管理扩展"
  }'
```

示例：Cloudflare Workers AI（默认）

```bash
curl -X POST http://localhost:8787/api/ai/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "prompt": "用一句话介绍此项目"
  }'

curl -X POST http://localhost:8787/api/ai/embedding \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@cf/baai/bge-m3",
    "text": "AcuityBookmarks"
  }'
```

### 成本与护栏（推荐策略）

- 默认启用“就绪优先、云端回退”策略：前端优先使用 Chrome 内置 AI，就绪则本地推理；不可用或能力不足时回退至后端提供商。
- 后端统一路由已内置以下成本控制措施：
  - 最大输出 token 硬上限：由 `AI_MAX_OUTPUT_TOKENS` 控制，防止长输出导致费用飙升。
  - 每日调用次数护栏：由 `AI_DAILY_MAX_CALLS` 控制，包含聊天与嵌入总调用数。
  - 结果缓存：对 `complete` 与 `embedding` 进行去重缓存，降低重复请求成本。

配置示例（见 `.env.example`）：

```bash
# Max output tokens per request (hard cap)
AI_MAX_OUTPUT_TOKENS=512
# Daily max total AI calls (chat+embedding)
AI_DAILY_MAX_CALLS=2000
# Cache TTL for chat/completion results (seconds)
AI_CACHE_TTL_SECONDS=3600
# Cache TTL for embeddings (seconds)
AI_EMBED_CACHE_TTL_SECONDS=604800
# Max cache entries in memory
AI_CACHE_MAX_ENTRIES=1000
```

说明：

- 缓存键包含 `provider/model/prompt(messages)` 等要素，确保同一输入稳定命中；嵌入默认长TTL（7天），文本补全默认中TTL（1小时）。
- `AI_MAX_OUTPUT_TOKENS` 会在路由层强制生效，优先取较小值保证预算安全。
- 超出每日调用上限时，后端返回错误（429语义），前端应提示并延迟重试或切换到离线策略。

## 🔧 配置

### 环境变量

```bash
PORT=3000                    # 服务器端口
HOST=localhost              # 绑定地址
NODE_ENV=development        # 环境模式
ALLOW_DEV_LOGIN=false       # 是否允许 Dev 登录/授权（生产必须为 false）
REDIRECT_URI_ALLOWLIST=     # 允许的 redirect_uri 前缀/来源（逗号分隔或 JSON 数组）
# JWT_SECRET=                # JWT 签名密钥（必须，生产使用高熵随机值）
# OAuth Providers（如启用 Google/GitHub 登录，必须配置以下）
# AUTH_GOOGLE_CLIENT_ID=
# AUTH_GOOGLE_CLIENT_SECRET=
# AUTH_GITHUB_CLIENT_ID=
# AUTH_GITHUB_CLIENT_SECRET=
```

说明：

- 安全策略
  - 默认仅放行 https://\*.chromiumapp.org 的回调（Chrome 扩展 WebAuthFlow 的固定域）。
  - 其它 https 回调需显式加入 `REDIRECT_URI_ALLOWLIST`，支持：完整前缀（含路径）、Origin（协议+主机+端口）或主机名精确匹配。
  - 仅对 localhost/127.0.0.1 允许 http；拒绝 data:/javascript: 等危险 scheme。
  - Dev 提供商（`provider=dev`）与 `/api/auth/dev-login` 需显式开启 `ALLOW_DEV_LOGIN=true` 才可用，生产环境应关闭。

### 常见排查：provider not configured

`/api/auth/start?provider=google|github` 返回 `{"error":"provider not configured: <name>"}`，说明缺少对应的 Client ID/Secret 环境变量。

排查步骤：

- 访问 `GET /api/auth/providers` 查看 `providers.google/github` 是否为 true。
- 若为 false，请在本地 `.dev.vars` 或 Cloudflare Secrets 中补齐：

本地（wrangler dev）：在 `backend/.dev.vars` 写入如下内容并重启 wrangler：

```
ALLOW_DEV_LOGIN=true
JWT_SECRET=dev-secret-change-me

# Google
AUTH_GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
AUTH_GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx

# GitHub
AUTH_GITHUB_CLIENT_ID=xxxxxxxxxxxx
AUTH_GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

线上（Cloudflare）：在 Dashboard > Workers & Pages > Settings > Variables 中添加同名 `Secrets`。

说明：默认允许的 `redirect_uri` 域是 `https://*.chromiumapp.org`（Chrome 扩展的固定回调域）。如需自定义网页回调，请设置 `REDIRECT_URI_ALLOWLIST`。

### 配置 Google/GitHub OAuth（简版）

1. Google Cloud Console

- 创建“OAuth 同意屏幕”和“凭据 > OAuth 客户端 ID（Web application）”
- 在“已授权的重定向 URI”中加入你的扩展回调：`https://<extension_id>.chromiumapp.org/oauth2`
- 复制 Client ID / Secret 填入环境变量

2. GitHub Developer Settings > OAuth Apps

- 新建应用，Authorization callback URL 设为：`https://<extension_id>.chromiumapp.org/oauth2`
- 保存后复制 Client ID / Client Secret 并填入环境变量

注意：开发阶段扩展 ID 可能变化，建议使用 Dev 登录（`provider=dev`）进行本地验证；发布到商店后扩展 ID 固定，再配置正式的回调地址。

### D1 数据库绑定（必需）

在 `wrangler.toml` 添加：

```toml
[[d1_databases]]
binding = "DB"
database_name = "acuitybookmarks"
database_id = "e7126c65-435c-40d2-b8a8-f0718a0fe16a"
```

首次启动时，后端会自动初始化/迁移以下表：

- users（含 password_hash/salt/algo/iter/email_verified/lockout 等字段）
- refresh_tokens（旋转+撤销）
- password_resets（一次性 token）

### 首方账号最小可用测试

本地开发：

```bash
cd backend
bunx wrangler dev
```

注册：

```bash
curl -sS -X POST http://localhost:8787/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"Sup3rStr0ngPwd!"}' | jq
```

登录：

```bash
curl -sS -X POST http://localhost:8787/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"Sup3rStr0ngPwd!"}' | jq
```

刷新：

```bash
REFRESH=... # 将上一步返回的 refresh_token 填入
curl -sS -X POST http://localhost:8787/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refresh_token\":\"$REFRESH\"}" | jq
```

重置申请：

```bash
curl -sS -X POST http://localhost:8787/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com"}' | jq
```

重置密码（仅用于本地/无邮件场景）：

```bash
curl -sS -X POST http://localhost:8787/api/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"reset_token":"<from_previous_step>","new_password":"An0therStr0ngPwd!"}' | jq
```

### 性能调优

```bash
# 启用性能分析
bun --prof server-bun-native.js

# 运行基准测试
bun run benchmark
```

## 📊 性能指标

### 启动性能

- **冷启动**: ~60ms (vs Node.js ~200ms)
- **内存占用**: ~28MB (vs Node.js ~45MB)

### API性能

- **平均响应时间**: ~8ms
- **并发处理**: 150% 提升
- **内存效率**: 38% 降低

### 运行基准测试

```bash
bun run benchmark
```

## 🏗️ 项目结构

```
backend/
├── server-bun-native.js    # 主服务器文件
├── utils/
│   └── job-store.js        # 任务存储 (Bun原生)
├── benchmark.js            # 性能基准测试
├── bun.config.js          # Bun配置
└── package.json           # 项目配置
```

## 🔄 核心功能

### 智能分类

基于URL和标题的智能书签分类：

- 开发技术 (Development)
- 新闻资讯 (News & Articles)
- 社交媒体 (Social Media)
- 购物电商 (Shopping)
- 教育学习 (Education)
- 工具效率 (Tools & Utilities)
- 娱乐休闲 (Entertainment)

### URL检测

高性能并发URL状态检测：

- 批量处理
- 超时控制
- 错误恢复
- 状态码分析

### 任务管理

异步任务处理系统：

- 进度追踪
- 状态管理
- 自动清理
- 错误处理

## 🐛 问题排查

### 常见问题

**Q: 服务器启动失败**

```bash
# 检查Bun版本
bun --version

# 检查端口占用
lsof -i :3000

# 查看详细日志
bun run dev:verbose
```

**Q: API请求失败**

```bash
# 检查CORS设置
curl -I http://localhost:8787/api/health

# 测试连通性
curl -v http://localhost:8787/api/health
```

### 性能问题

```bash
# 运行性能诊断
bun run benchmark

# 检查内存使用
bun run performance
```

## 🧪 测试

```bash
# 运行所有测试
bun test

# 运行测试并查看覆盖率
bun test --coverage

# 监控模式
bun test --watch
```

## 📈 监控

### 内置监控

- 响应时间追踪
- 内存使用监控
- 错误率统计
- 任务处理状态

### 监控端点

```bash
# 健康检查
GET /health

# 服务器信息
GET /api/health
```

## 🚀 部署

### Docker部署

```dockerfile
FROM oven/bun:alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["bun", "start"]
```

### 系统服务

```bash
# 创建systemd服务
sudo cp acuity-bookmarks.service /etc/systemd/system/
sudo systemctl enable acuity-bookmarks
sudo systemctl start acuity-bookmarks
```

## 📝 开发指南

### 添加新API

```javascript
// 在 handleApiRoutes 中添加新路由
case '/api/new-endpoint':
  return await handleNewEndpoint(req, corsHeaders);

// 实现处理函数
async function handleNewEndpoint(req, corsHeaders) {
  // 处理逻辑
  return createJsonResponse(result, corsHeaders);
}
```

### 性能优化

1. 使用Bun原生API
2. 避免阻塞操作
3. 合理使用并发
4. 监控内存使用

## 🔧 贡献指南

1. Fork 项目
2. 创建功能分支
3. 运行测试: `bun test`
4. 运行基准测试: `bun run benchmark`
5. 提交Pull Request

## 📄 许可证

MIT License

---

🔥 基于Bun构建，为性能而生！
