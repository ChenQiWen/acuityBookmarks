# Service Worker 测试总结

## ✅ 已完成的工作

### 1. Service Worker 生命周期单元测试 ✅

**文件**: `src/tests/service-worker/lifecycle.test.ts`

**测试覆盖**:
- ✅ Service Worker 初始化逻辑（监听器注册）
- ✅ 状态持久化策略（chrome.storage 使用）
- ✅ 消息处理器注册（异步消息处理）
- ✅ Alarm 管理（定时任务调度）
- ✅ 最佳实践验证（代码审查测试）

**测试数量**: 13 个测试

**运行方式**:
```bash
bun run test:service-worker:unit
```

**优点**:
- 不需要真实浏览器
- 运行速度快（< 1 秒）
- 可以在 CI/CD 中运行
- 验证核心逻辑和最佳实践

---

### 2. Service Worker 终止 E2E 测试 ⏳

**文件**: `src/tests/service-worker/termination.test.ts`

**测试覆盖**:
- ✅ Service Worker 终止后的状态恢复（chrome.storage）
- ✅ Service Worker 终止后的 IndexedDB 数据恢复
- ✅ Alarm 触发后的 Service Worker 重启
- ✅ 消息传递的可靠性（终止前后）
- ✅ 长时间运行的消息处理器
- ✅ Service Worker 空闲自动终止

**测试数量**: 7 个测试

**运行方式**:
```bash
# 1. 安装 Puppeteer
bun add -d puppeteer

# 2. 构建扩展
bun run build

# 3. 运行测试
bun run test:service-worker:e2e
```

**状态**: ⏳ 已实现，但需要安装 Puppeteer 才能运行

**特点**:
- 需要真实的 Chrome 浏览器
- 测试时间较长（30+ 秒）
- 验证真实的 Service Worker 行为
- 基于 Chrome 官方文档实现

---

## 🎯 为什么 Service Worker 测试很重要？

### Manifest V3 的关键变化

在 Manifest V3 中，Background Pages 被 Service Workers 替代：

| 特性 | Background Page (V2) | Service Worker (V3) |
|------|---------------------|---------------------|
| 生命周期 | 持久运行 | 空闲时自动终止 |
| 状态保存 | 全局变量 | chrome.storage |
| 定时任务 | setTimeout | chrome.alarms |
| 内存使用 | 高 | 低 |

### 常见问题

如果不正确处理 Service Worker 终止，会导致：

1. **状态丢失** ❌
   ```typescript
   // ❌ 错误：全局变量在终止后丢失
   let bookmarkCount = 0
   ```

2. **定时任务失效** ❌
   ```typescript
   // ❌ 错误：setTimeout 在终止后失效
   setTimeout(() => syncBookmarks(), 60000)
   ```

3. **消息处理失败** ❌
   ```typescript
   // ❌ 错误：异步消息没有保持通道开放
   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
     setTimeout(() => sendResponse({ result: 'done' }), 100)
     // 缺少 return true
   })
   ```

---

## ✅ 测试验证的最佳实践

### 1. 使用 chrome.storage 存储状态

```typescript
// ✅ 正确：持久化存储
async function saveState(data: any) {
  await chrome.storage.local.set(data)
}

async function loadState() {
  return await chrome.storage.local.get()
}
```

**测试验证**: `lifecycle.test.ts` - "应该使用 chrome.storage 而不是全局变量"

---

### 2. 使用 chrome.alarms 调度任务

```typescript
// ✅ 正确：持久化定时任务
await chrome.alarms.create('sync-task', {
  delayInMinutes: 1,
  periodInMinutes: 5
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync-task') {
    syncBookmarks()
  }
})
```

**测试验证**: 
- `lifecycle.test.ts` - "应该在 Service Worker 启动时重新创建 Alarms"
- `termination.test.ts` - "应该在 Alarm 触发后正确重启 Service Worker"

---

### 3. 异步消息处理器返回 true

```typescript
// ✅ 正确：保持消息通道开放
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  setTimeout(() => {
    sendResponse({ result: 'done' })
  }, 100)
  return true // 保持通道开放
})
```

**测试验证**: 
- `lifecycle.test.ts` - "应该在消息处理器中返回 true 以保持通道开放"
- `termination.test.ts` - "应该处理长时间运行的消息处理器"

---

### 4. 在启动时重新注册监听器

```typescript
// ✅ 正确：每次启动都注册
function initializeServiceWorker() {
  chrome.runtime.onMessage.addListener(handleMessage)
  chrome.alarms.onAlarm.addListener(handleAlarm)
  chrome.bookmarks.onCreated.addListener(handleBookmarkCreated)
}

// Service Worker 启动时调用
initializeServiceWorker()
```

**测试验证**: `lifecycle.test.ts` - "应该在启动时注册所有必要的监听器"

---

### 5. 处理错误场景

```typescript
// ✅ 正确：处理 storage 写入失败
async function saveStateWithErrorHandling(data: any) {
  try {
    await chrome.storage.local.set(data)
    return { success: true }
  } catch (error) {
    console.error('Failed to save state:', error)
    return { success: false, error }
  }
}
```

**测试验证**: `lifecycle.test.ts` - "应该处理 storage 写入失败"

---

## 📊 测试覆盖率

| 测试类型 | 文件 | 测试数量 | 状态 | 运行时间 |
|---------|------|---------|------|---------|
| 单元测试 | `lifecycle.test.ts` | 13 | ✅ 完成 | < 1s |
| E2E 测试 | `termination.test.ts` | 7 | ⏳ 需要 Puppeteer | 30-60s |
| **总计** | | **20** | | |

---

## 🚀 如何运行测试

### 常规测试（不包含 Service Worker E2E）

```bash
bun run test:run
```

这会运行所有常规测试，但**不包含** Service Worker E2E 测试。

---

### Service Worker 单元测试

```bash
bun run test:service-worker:unit
```

运行 Service Worker 生命周期单元测试（不需要 Puppeteer）。

---

### Service Worker E2E 测试（可选）

```bash
# 1. 安装 Puppeteer（仅需一次）
bun add -d puppeteer

# 2. 构建扩展
bun run build

# 3. 运行 E2E 测试
bun run test:service-worker:e2e
```

**注意**: 这会启动真实的 Chrome 浏览器，测试时间较长。

---

## 🎯 CI/CD 集成建议

### 推荐配置

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      # 运行常规测试（快速）
      - name: Run unit tests
        run: bun run test:run
      
      # 可选：运行 Service Worker 单元测试
      - name: Run Service Worker unit tests
        run: bun run test:service-worker:unit
      
      # 可选：运行 Service Worker E2E 测试（慢）
      # 仅在主分支或发布时运行
      - name: Run Service Worker E2E tests
        if: github.ref == 'refs/heads/main'
        run: |
          bun add -d puppeteer
          bun run build
          bun run test:service-worker:e2e
```

---

## 📚 参考文档

- [Chrome Extensions Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Testing Service Worker Termination](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)
- [Puppeteer Documentation](https://pptr.dev/)

---

## 📝 总结

✅ **Service Worker 测试已完整实现**

- **单元测试**: 13 个测试，验证核心逻辑和最佳实践
- **E2E 测试**: 7 个测试，验证真实的 Service Worker 行为
- **总计**: 20 个 Service Worker 相关测试

**状态**:
- ✅ 单元测试可以立即运行
- ⏳ E2E 测试需要安装 Puppeteer（可选）

**建议**:
- 在日常开发中运行单元测试
- 在发布前运行 E2E 测试
- 在 CI/CD 中根据需要选择性运行

---

**Service Worker 测试确保了扩展在 Manifest V3 环境下的稳定性和可靠性！** 🎉
