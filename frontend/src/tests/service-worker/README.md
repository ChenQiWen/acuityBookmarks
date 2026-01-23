# Service Worker 测试

## 📋 概述

Service Worker 测试分为两类：

1. **单元测试** (`lifecycle.test.ts`) - 不需要真实浏览器
2. **E2E 测试** (`termination.test.ts`) - 需要 Puppeteer 和真实浏览器

---

## ✅ 单元测试（已完成）

**文件**: `lifecycle.test.ts`

**测试内容**:
- Service Worker 初始化逻辑
- 状态持久化策略
- 消息处理器注册
- Alarm 管理
- 最佳实践验证

**运行方式**:
```bash
bun run test:service-worker:unit
```

**状态**: ✅ 可以正常运行（使用 Mock）

---

## ⚠️ E2E 测试（需要额外配置）

**文件**: `termination.test.ts`

**测试内容**:
- Service Worker 终止后的状态恢复
- Alarm 触发后的 Service Worker 重启
- 消息传递的可靠性
- 性能和资源管理

**运行方式**:
```bash
# 1. 安装 Puppeteer
bun add -d puppeteer

# 2. 构建扩展
bun run build

# 3. 运行测试
bun run test:service-worker:e2e
```

**状态**: ⏳ 需要安装 Puppeteer 才能运行

**注意事项**:
- ⚠️ 这些测试会启动真实的 Chrome 浏览器（headless: false）
- ⚠️ 测试时间较长（包含等待 Service Worker 终止的时间）
- ⚠️ 需要先构建扩展到 `dist/` 目录
- ⚠️ 某些测试可能因为 Chrome 的内部策略而不稳定

---

## 🎯 为什么 Service Worker 测试被排除在常规测试之外？

1. **需要特殊环境**: E2E 测试需要 Puppeteer 和真实浏览器
2. **运行时间长**: 包含等待 Service Worker 终止的测试（30+ 秒）
3. **可能不稳定**: 依赖 Chrome 的内部行为
4. **需要构建**: 必须先构建扩展才能测试

因此，这些测试被配置为**可选测试**，不会在常规 `bun run test:run` 中运行。

---

## 📚 Service Worker 最佳实践

基于这些测试，以下是 Service Worker 开发的最佳实践：

### ✅ DO（推荐）

1. **使用 `chrome.storage` 存储状态**
   ```typescript
   // ✅ 正确：持久化存储
   await chrome.storage.local.set({ count: 1 })
   ```

2. **使用 `chrome.alarms` 调度任务**
   ```typescript
   // ✅ 正确：持久化定时任务
   await chrome.alarms.create('task', { delayInMinutes: 1 })
   ```

3. **在异步消息处理器中返回 `true`**
   ```typescript
   // ✅ 正确：保持消息通道开放
   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
     setTimeout(() => sendResponse({ result: 'done' }), 100)
     return true // 保持通道开放
   })
   ```

4. **在启动时重新注册所有监听器**
   ```typescript
   // ✅ 正确：每次启动都注册
   chrome.runtime.onMessage.addListener(handleMessage)
   chrome.alarms.onAlarm.addListener(handleAlarm)
   ```

### ❌ DON'T（避免）

1. **不要使用全局变量存储状态**
   ```typescript
   // ❌ 错误：Service Worker 终止后丢失
   let globalState = { count: 0 }
   ```

2. **不要使用 `setTimeout` 调度长期任务**
   ```typescript
   // ❌ 错误：Service Worker 终止后失效
   setTimeout(() => doTask(), 60000)
   ```

3. **不要假设 Service Worker 会一直运行**
   ```typescript
   // ❌ 错误：假设状态会保留
   let cache = {}
   function getData() {
     if (!cache.data) {
       cache.data = fetchData() // 终止后丢失
     }
     return cache.data
   }
   ```

---

## 🔗 参考文档

- [Chrome Extensions Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Testing Service Worker Termination](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)
- [Chrome Extensions Testing Best Practices](https://developer.chrome.com/docs/extensions/how-to/test/)

---

## 📝 总结

| 测试类型 | 文件 | 状态 | 运行命令 |
|---------|------|------|---------|
| 单元测试 | `lifecycle.test.ts` | ✅ 完成 | `bun run test:service-worker:unit` |
| E2E 测试 | `termination.test.ts` | ⏳ 需要 Puppeteer | `bun run test:service-worker:e2e` |

**Service Worker 测试已经完整实现，但 E2E 测试需要额外的 Puppeteer 依赖才能运行。**
