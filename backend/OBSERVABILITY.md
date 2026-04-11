# Cloudflare Workers 可观测性指南

## 📊 什么是可观测性？

可观测性（Observability）让你能够监控和了解 Worker 的运行状况，包括：

- 📈 请求量和性能指标
- 🐛 错误和异常
- ⚡ 响应时间和瓶颈
- 🌍 用户地理分布
- 💰 使用量和成本

---

## 🔧 配置说明

### ⚠️ 重要：日志和追踪互斥

Cloudflare Workers 的可观测性功能中，**日志（Logs）和追踪（Traces）是互斥的**，只能启用其中一个。

- ✅ **推荐：启用日志** - 适合早期项目，记录业务信息，成本更低
- ❌ **不推荐：启用追踪** - 适合复杂项目，分析性能瓶颈，成本更高

本项目选择：**启用日志，禁用追踪**

### 当前配置（wrangler.toml）

#### 开发环境

```toml
[observability]
enabled = true
head_sampling_rate = 1  # 100% 采样，记录所有请求

[observability.logs]
enabled = true
persist = true
invocation_logs = true  # 记录每次调用的详细信息

[observability.traces]
enabled = false         # 已禁用（与日志互斥）
persist = false
head_sampling_rate = 0
```

#### 生产环境

```toml
[env.production.observability]
enabled = true
head_sampling_rate = 0.1  # 10% 采样，降低成本

[env.production.observability.logs]
enabled = true
head_sampling_rate = 0.1  # 记录 10% 的日志

[env.production.observability.traces]
enabled = false           # 已禁用（与日志互斥）
persist = false
head_sampling_rate = 0
```

**为什么生产环境采样率更低？**

- 💰 降低成本（日志会产生费用）
- 📊 10% 的样本足以了解整体趋势
- 🚨 错误日志仍然会被记录（不受采样率影响）

---

## 📝 1. 日志（Logs）- 已启用

### 项目中的日志实现

本项目使用结构化日志工具（`backend/src/utils/logger.ts`），所有日志都以 JSON 格式输出，便于在 Cloudflare Dashboard 中查询和分析。

### 在代码中添加日志

```typescript
// 导入日志工具
import { info, error, warn, debug, monitoredOperation } from './utils/logger'

// ✅ 基础日志
info('用户登录', { userId: '123', email: 'user@example.com' })

// ✅ 错误日志（会自动记录，不受采样率影响）
error('数据库连接失败', {
  error: err.message,
  stack: err.stack,
  operation: 'getBookmarks'
})

// ✅ 警告日志
warn('API 调用超时', {
  url: 'https://api.example.com',
  timeout: 5000
})

// ✅ 调试日志（开发环境使用）
debug('处理请求', {
  method: request.method,
  url: request.url
})

// ✅ 监控异步操作性能
const bookmarks = await monitoredOperation('getBookmarks', async () => {
  return await getBookmarksFromDB(userId)
})
// 自动记录：操作名称、耗时、成功/失败状态
```

### 主入口文件的日志

`backend/src/index.ts` 已经添加了以下日志：

1. **请求开始**：记录每个请求的基本信息
2. **请求完成**：记录响应状态和耗时
3. **错误处理**：记录所有未捕获的错误

### 查看日志

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 选择你的 Worker：`acuitybookmarks`
4. 点击 **Logs** 标签

**功能**：

- 🔴 实时日志流（Live Logs）
- 📅 历史日志查询
- 🔍 按关键词过滤
- 📊 按时间范围筛选
- 💾 导出日志

---

## 🔎 2. 追踪（Traces）- 已禁用

### ⚠️ 为什么禁用追踪？

本项目选择启用日志而不是追踪，原因如下：

1. **互斥限制**：Cloudflare Workers 的日志和追踪功能互斥，只能选一个
2. **项目阶段**：早期项目更需要业务日志，而非性能追踪
3. **成本考虑**：日志成本更低，追踪成本更高
4. **API 复杂度**：项目 API 相对简单，不需要详细的性能分析

### 如果需要启用追踪

如果未来需要启用追踪（例如分析性能瓶颈），需要：

1. **修改 `backend/wrangler.toml`**：

```toml
# 禁用日志
[observability.logs]
enabled = false
persist = false
invocation_logs = false

# 启用追踪
[observability.traces]
enabled = true
persist = true
head_sampling_rate = 1
```

2. **重新部署**：

```bash
cd backend
bun run deploy
```

### 追踪显示什么？

追踪会自动记录请求的完整生命周期：

```
用户请求
  ↓ 10ms
Worker 接收
  ↓ 5ms
验证 JWT Token
  ↓ 200ms
查询 Supabase 数据库  ⬅️ 慢！
  ↓ 300ms
调用 AI 向量搜索      ⬅️ 很慢！
  ↓ 50ms
处理结果
  ↓ 5ms
返回响应

总耗时: 570ms
```

### 查看追踪

1. Cloudflare Dashboard → Workers → `acuitybookmarks`
2. 点击 **Traces** 标签
3. 选择一个请求查看详细的火焰图

**追踪信息包括**：

- ⏱️ 每个步骤的耗时
- 🔗 外部 API 调用（Supabase、AI）
- 💾 数据库查询时间
- 🌐 网络延迟
- 🐛 错误发生的位置

### 优化性能

根据追踪结果优化：

```typescript
// ❌ 慢：串行执行
const user = await getUser(userId)
const bookmarks = await getBookmarks(userId)
const tags = await getTags(userId)

// ✅ 快：并行执行
const [user, bookmarks, tags] = await Promise.all([
  getUser(userId),
  getBookmarks(userId),
  getTags(userId)
])
```

---

## 📈 3. 指标（Metrics）

### 在 Dashboard 查看

Cloudflare Dashboard → Workers → `acuitybookmarks` → **Metrics**

### 关键指标

#### 请求指标

- **请求数量**：每秒/每分钟/每小时
- **成功率**：2xx 响应的百分比
- **错误率**：4xx、5xx 错误的百分比

#### 性能指标

- **P50 延迟**：50% 的请求响应时间
- **P95 延迟**：95% 的请求响应时间
- **P99 延迟**：99% 的请求响应时间

#### 地理分布

- 请求来自哪些国家/地区
- 各地区的响应时间

#### 成本指标

- 计费请求数
- CPU 时间使用
- 免费额度使用情况

---

## 🚨 4. 告警（Alerts）

### 设置告警

1. Cloudflare Dashboard → Notifications
2. 创建新的告警规则

### 推荐的告警规则

#### 错误率告警

```
条件：错误率 > 5%
时间窗口：5 分钟
通知方式：Email / Webhook
```

#### 响应时间告警

```
条件：P95 延迟 > 1000ms
时间窗口：5 分钟
通知方式：Email / Webhook
```

#### 请求量异常

```
条件：请求量突然下降 50%
时间窗口：10 分钟
通知方式：Email / Webhook
```

---

## 🔍 5. 实时监控（Tail）

### 使用 wrangler tail

在本地实时查看 Worker 的日志：

```bash
# 查看生产环境的实时日志
cd backend
bunx wrangler tail --env production

# 只看错误日志
bunx wrangler tail --env production --status error

# 过滤特定 URL
bunx wrangler tail --env production --search "/api/bookmarks"
```

**输出示例**：

```
[2024-04-11 14:30:15] GET https://api.acuitybookmarks.com/api/bookmarks
  Status: 200
  Duration: 245ms
  Logs:
    收到请求: /api/bookmarks
    查询数据库: 200ms
    返回 50 条书签
```

---

## 📊 6. 分析工具集成

### Grafana Cloud（推荐）

Cloudflare 可以将日志和指标导出到 Grafana：

1. Cloudflare Dashboard → Analytics → Logs
2. 点击 **Add destination**
3. 选择 **Grafana Cloud**
4. 配置 API key

### 其他工具

- **Datadog**：企业级监控
- **New Relic**：APM 性能监控
- **Sentry**：错误追踪
- **LogFlare**：日志分析

---

## 💰 7. 成本优化

### 可观测性的成本

Cloudflare Workers 的可观测性功能会产生额外费用：

- **日志存储**：按存储量计费
- **日志查询**：按查询次数计费
- **追踪数据**：按追踪数量计费（本项目已禁用）

### 优化建议

#### 1. 调整采样率

```toml
# 开发环境：100% 采样，方便调试
[observability]
head_sampling_rate = 1

# 生产环境：10% 采样，降低成本
[env.production.observability]
head_sampling_rate = 0.1
```

#### 2. 只记录重要日志

```typescript
import { info, error } from './utils/logger'

// ❌ 记录所有请求（成本高）
info('收到请求', { url: request.url })

// ✅ 只记录错误和关键操作（成本低）
if (error) {
  error('错误', { error: err.message })
}

if (isImportantOperation) {
  info('重要操作', { operation })
}
```

#### 3. 使用结构化日志

```typescript
import { info } from './utils/logger'

// ❌ 多条日志（成本高）
console.log('用户 ID:', userId)
console.log('操作:', operation)
console.log('耗时:', duration)

// ✅ 一条结构化日志（成本低）
info('操作完成', {
  userId,
  operation,
  duration
})
```

#### 4. 设置日志保留期

在 Cloudflare Dashboard 中设置日志保留期：

- 开发环境：7 天
- 生产环境：30 天

---

## 🎯 8. 最佳实践

### 使用项目的日志工具

```typescript
// ✅ 推荐：使用项目的结构化日志工具
import { info, error, warn, debug, monitoredOperation } from './utils/logger'

info('用户登录', { userId: '123' })
error('数据库连接失败', { error: err.message })

// ❌ 不推荐：直接使用 console
console.log('用户登录', userId)  // 不是结构化的
console.error('错误:', err)       // 缺少上下文信息
```

### 监控关键操作

```typescript
import { monitoredOperation } from './utils/logger'

// 自动记录操作名称、耗时、成功/失败状态
const bookmarks = await monitoredOperation('getBookmarks', async () => {
  return await getBookmarksFromDB(userId)
})
```

### 错误追踪

```typescript
import { logError } from './utils/logger'

try {
  await processBookmark(bookmark)
} catch (err) {
  logError(err, {
    operation: 'processBookmark',
    bookmarkId: bookmark.id,
    userId: user.id
  })
  throw err
}
```

---

## 📚 9. 相关资源

### Cloudflare 文档

- [Workers Observability](https://developers.cloudflare.com/workers/observability/)
- [Logs](https://developers.cloudflare.com/workers/observability/logs/)
- [Traces](https://developers.cloudflare.com/workers/observability/traces/)
- [Metrics](https://developers.cloudflare.com/workers/observability/metrics/)

### 工具

- [wrangler tail](https://developers.cloudflare.com/workers/wrangler/commands/#tail)
- [Grafana Cloud](https://grafana.com/products/cloud/)
- [Datadog](https://www.datadoghq.com/)

---

## 🚀 快速开始

1. **启用可观测性**（已配置）

   ```bash
   # 配置已在 wrangler.toml 中
   ```

2. **部署到生产环境**

   ```bash
   cd backend
   bun run deploy
   ```

3. **查看实时日志**

   ```bash
   bunx wrangler tail --env production
   ```

4. **访问 Dashboard**
   - 登录 Cloudflare Dashboard
   - 进入 Workers → acuitybookmarks
   - 查看 Logs、Traces、Metrics

5. **设置告警**
   - 进入 Notifications
   - 创建错误率和性能告警

---

**最后更新**: 2025-04-11  
**版本**: 1.0.0
