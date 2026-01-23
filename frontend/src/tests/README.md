# 🧪 测试目录

## 📁 目录结构

```
tests/
├── setup.ts                          # ⭐ 全局测试配置（Chrome API Mock）
│
├── unit/                             # 单元测试（9 个）
│   ├── bookmark-tree.test.ts         # 书签树结构转换
│   └── search-service.test.ts        # 搜索服务
│
├── integration/                      # 集成测试（5 个）
│   └── BookmarkList.test.ts          # Vue 组件测试
│
├── chrome/                           # Chrome API 测试（16 个）
│   ├── background-script.test.ts     # Background Script
│   └── alarms.test.ts                # Alarms API
│
├── service-worker/                   # Service Worker 测试（28 个）⭐
│   ├── lifecycle.test.ts             # 单元测试（17 个）
│   ├── termination.test.ts           # E2E 测试（11 个）
│   └── README.md                     # Service Worker 测试说明
│
├── performance/                      # 性能测试（4 个）
│   └── benchmark.test.ts             # 2 万书签性能
│
├── contract/                         # 契约测试（4 个）
│   └── api.test.ts                   # API 接口校验
│
└── visual/                           # 视觉测试（可选）
    └── bookmark-list.spec.ts         # Playwright 截图对比
```

---

## 🚀 快速运行

### 运行所有测试

```bash
# 从项目根目录
cd frontend
bun run test:all:complete
```

### 运行特定类型的测试

```bash
bun run test:unit              # 单元测试
bun run test:integration       # 集成测试
bun run test:chrome            # Chrome API 测试
bun run test:service-worker    # Service Worker 单元测试
bun run test:performance       # 性能测试
bun run test:contract          # 契约测试
```

### 运行 E2E 测试

```bash
bun run build                  # 先构建扩展
bun run test:service-worker:e2e  # 运行 E2E 测试
```

---

## 📊 测试统计

| 类型 | 数量 | 速度 | 工具 |
|------|------|------|------|
| 单元测试 | 9 | ⚡ ~100ms | Vitest |
| 集成测试 | 5 | ⚡ ~200ms | Vue Test Utils |
| Chrome API 测试 | 16 | ⚡ ~300ms | Vitest + Mock |
| Service Worker 单元测试 | 17 | ⚡ ~700ms | Vitest + Mock |
| Service Worker E2E 测试 | 11 | 🐢 ~30-60s | Puppeteer |
| 性能测试 | 4 | ⚡ ~50ms | Vitest |
| 契约测试 | 4 | ⚡ ~50ms | Vitest + Zod |
| **总计** | **66** | **~1-2 分钟** | - |

---

## 🎯 测试重点

### Service Worker 测试 ⭐

**为什么重要？**
- Chrome Extension Manifest V3 的核心
- Service Worker 会自动终止和重启
- 需要测试状态持久化和消息传递

**测试内容：**
- ✅ 状态持久化（chrome.storage）
- ✅ 定时任务（chrome.alarms）
- ✅ 消息传递（chrome.runtime.onMessage）
- ✅ Service Worker 终止和重启
- ✅ 消息丢失场景处理

---

## 📚 详细文档

- **[../RUN-ALL-TESTS.md](../RUN-ALL-TESTS.md)** - 快速运行指南
- **[../TEST-GUIDE.md](../TEST-GUIDE.md)** - 详细测试指南
- **[../TEST-STATUS.md](../TEST-STATUS.md)** - 测试状态报告
- **[../TESTING.md](../TESTING.md)** - 测试策略和最佳实践
- **[./service-worker/README.md](./service-worker/README.md)** - Service Worker 测试详情

---

## 🛠️ 测试工具

### 核心工具

- **Vitest** - 测试运行器（比 Jest 快 10 倍）
- **Happy-DOM** - 浏览器环境模拟（比 jsdom 快 2-3 倍）
- **Vue Test Utils** - Vue 组件测试
- **Puppeteer** - E2E 测试（Chrome 官方推荐）
- **fake-indexeddb** - IndexedDB Mock

### Chrome API Mock

所有 Chrome API 都在 `setup.ts` 中 Mock：
- ✅ `chrome.runtime.*` - 消息传递
- ✅ `chrome.storage.*` - 存储
- ✅ `chrome.bookmarks.*` - 书签
- ✅ `chrome.alarms.*` - 定时任务
- ✅ `chrome.tabs.*` - 标签页

---

## 🎉 开始测试

```bash
cd frontend
bun run test:all:complete
```

**预期结果**: ✅ 66 个测试全部通过
