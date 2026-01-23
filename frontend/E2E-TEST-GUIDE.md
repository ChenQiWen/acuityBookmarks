# 🧪 E2E 测试指南

## 📋 测试前准备

### 1. 验证 Puppeteer 安装

首次运行 E2E 测试前，建议先验证 Puppeteer 是否正常工作：

```bash
cd frontend
node test-puppeteer.js
```

**预期结果：**

```
🚀 测试 Puppeteer 安装...
⏳ 启动浏览器...
✅ 浏览器启动成功！耗时: 2500ms (2.5秒)
⏳ 创建测试页面...
✅ 页面创建成功
⏳ 访问测试网站...
✅ 页面标题: Example Domain
⏳ 关闭浏览器...
✅ 浏览器已关闭
🎉 Puppeteer 工作正常！
```

**如果失败：**

- ⏳ **首次运行**：Puppeteer 正在下载 Chromium（~300MB），请耐心等待
- 🌐 **网络问题**：检查网络连接，确保可以访问 Google CDN
- 💾 **磁盘空间**：确保有足够的磁盘空间（至少 500MB）

### 2. 构建扩展

E2E 测试需要构建后的扩展：

```bash
cd frontend
bun run build
```

**验证构建成功：**

```bash
ls -la dist/
# 应该看到 manifest.json, background.js 等文件
```

---

## 🚀 运行 E2E 测试

### 方式 1: 运行简化版测试（推荐）

```bash
cd frontend
bun run test:service-worker:e2e
```

**测试内容：**

- ✅ Service Worker 启动测试
- ✅ chrome.storage 状态恢复测试
- ✅ 消息传递可靠性测试

**预期输出：**

```
🚀 启动浏览器...
📦 扩展路径: /path/to/frontend/dist
✅ 浏览器已启动
⏳ 等待 Service Worker 启动...
✅ Service Worker 已启动
✅ 测试页面已创建

 ✓ src/tests/service-worker/termination-simple.test.ts (3)
   ✓ Service Worker 终止测试（简化版） (3)
     ✓ 基础功能测试 (2)
       ✓ 应该成功启动 Service Worker
       ✓ 应该能够获取 Service Worker 实例
     ✓ 状态恢复测试 (1)
       ✓ 应该在终止后恢复 chrome.storage 状态
     ✓ 消息传递可靠性测试 (1)
       ✓ 应该在 Service Worker 终止后仍能接收消息

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  10:30:00
   Duration  45.2s
```

### 方式 2: 运行完整版测试

```bash
cd frontend
bun run test:service-worker
```

**注意：** 完整版测试包含更多测试用例，运行时间更长（~2 分钟）。

---

## ⏱️ 超时配置

E2E 测试的超时时间已优化：

| 配置项                 | 时间   | 说明                                        |
| ---------------------- | ------ | ------------------------------------------- |
| `hookTimeout`          | 180 秒 | 启动浏览器（首次运行可能需要下载 Chromium） |
| `testTimeout`          | 120 秒 | 单个测试用例                                |
| `browserLaunchTimeout` | 180 秒 | Puppeteer 启动浏览器                        |

**如果仍然超时：**

1. **检查 Chromium 下载进度**

   ```bash
   # 查看 Puppeteer 缓存目录
   ls -la ~/.cache/puppeteer/
   ```

2. **手动下载 Chromium**

   ```bash
   cd frontend
   npx puppeteer browsers install chrome
   ```

3. **增加超时时间**
   编辑 `frontend/vitest.e2e.config.ts`：
   ```typescript
   hookTimeout: 300000, // 增加到 5 分钟
   ```

---

## 🐛 常见问题

### 问题 1: 浏览器启动超时

**症状：**

```
Error: Timed out after 180000 ms waiting for target
```

**原因：**

- Chromium 正在下载中
- 系统资源不足
- 扩展加载失败

**解决方案：**

1. 运行 `node test-puppeteer.js` 验证 Puppeteer
2. 检查 `dist/` 目录是否存在
3. 重新构建扩展：`bun run build`

### 问题 2: Service Worker 未启动

**症状：**

```
Error: Service Worker target not found
```

**原因：**

- 扩展未正确加载
- manifest.json 配置错误

**解决方案：**

1. 检查 `dist/manifest.json` 是否存在
2. 验证 `background.service_worker` 配置
3. 手动加载扩展到 Chrome 测试

### 问题 3: TypeScript 类型错误

**症状：**

```
Error: 找不到名称"chrome"
```

**解决方案：**
已修复！使用 `@ts-expect-error` 注释处理 Puppeteer 上下文中的 chrome API。

---

## 📊 测试覆盖

### 简化版测试（4 个测试）

| 测试用例            | 说明                | 耗时 |
| ------------------- | ------------------- | ---- |
| Service Worker 启动 | 验证 SW 正常启动    | ~5s  |
| 获取 SW 实例        | 验证可以获取 worker | ~2s  |
| chrome.storage 恢复 | 验证终止后状态恢复  | ~15s |
| 消息传递可靠性      | 验证终止后消息传递  | ~10s |

**总耗时：** ~45 秒

### 完整版测试（11 个测试）

包含简化版 + 以下测试：

| 测试用例       | 说明                | 耗时 |
| -------------- | ------------------- | ---- |
| IndexedDB 恢复 | 验证 IDB 数据持久化 | ~15s |
| Alarm 触发     | 验证 Alarm 重启 SW  | ~20s |
| 长时间任务     | 验证长任务处理      | ~10s |
| 消息丢失场景   | 验证边界情况        | ~15s |
| 消息重试机制   | 验证幂等性          | ~10s |
| 持久化队列     | 验证任务队列        | ~15s |
| 失败检测       | 验证错误处理        | ~5s  |

**总耗时：** ~2 分钟

---

## 🎯 推荐工作流

### 日常开发（快速反馈）

```bash
# 1. 运行单元测试（< 1 秒）
bun run test:run

# 结果: ✅ 55 个测试通过
```

### 发布前（完整验证）

```bash
# 1. 验证 Puppeteer
node test-puppeteer.js

# 2. 构建扩展
bun run build

# 3. 运行 E2E 测试
bun run test:service-worker:e2e

# 4. 运行所有测试
bun run test:all:complete
```

---

## 📚 相关文档

- [TEST-GUIDE.md](./TEST-GUIDE.md) - 单元测试指南
- [RUN-ALL-TESTS.md](./RUN-ALL-TESTS.md) - 快速运行指南
- [TEST-SUMMARY.md](./TEST-SUMMARY.md) - 测试总结报告
- [Chrome Extensions Testing](https://developer.chrome.com/docs/extensions/how-to/test) - 官方测试文档

---

## 💡 提示

1. **首次运行慢是正常的** - Chromium 下载需要时间
2. **E2E 测试是可选的** - 单元测试已提供足够覆盖
3. **发布前运行 E2E** - 确保 Service Worker 在真实环境中正常工作
4. **使用简化版测试** - 更快的反馈循环

---

**最后更新**: 2025-01-23
