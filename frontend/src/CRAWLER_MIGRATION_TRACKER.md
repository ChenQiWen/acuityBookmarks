# 🚀 爬取系统后台化迁移追踪文档

## 📋 迁移目标

将爬取任务从前端页面迁移到 Service Worker 后台运行，实现：

- ✅ 关闭浏览器后继续爬取
- ✅ 使用 `chrome.alarms` 定期调度
- ✅ 所有页面实时同步进度
- ✅ 资源优化（空闲时段执行）

---

## 🏗️ 架构对比

### ❌ 旧架构（前端运行）

```
前端页面
  ↓ 调用
bookmark-crawler-trigger.ts
  ↓ 调用
local-bookmark-crawler.ts
  ↓ 使用
crawl-task-scheduler.ts (前端实例)
  ↓ 执行
Offscreen Document (HTML 解析)
```

**问题：**

- 页面关闭后任务停止
- 每个页面独立实例，无法共享状态
- 依赖 `setTimeout`，不可靠

### ✅ 新架构（后台运行）

```
chrome.alarms / 前端消息
  ↓ 触发
BackgroundCrawlerManager (Service Worker)
  ↓ 调度
CrawlTaskScheduler (后台单例)
  ↓ 执行
Offscreen Document (HTML 解析)
  ↓ 广播
所有前端页面（实时进度同步）
```

**优势：**

- 后台持续运行，不依赖页面
- 全局单例，状态一致
- `chrome.alarms` 可靠调度
- 多页面实时同步

---

## 📦 已完成的基础设施

| 文件                                    | 说明                             | 状态      |
| --------------------------------------- | -------------------------------- | --------- |
| `background/crawler-manager.ts`         | 后台爬取管理器（Service Worker） | ✅ 已创建 |
| `services/background-crawler-client.ts` | 前端客户端封装                   | ✅ 已创建 |
| `composables/useCrawler.ts`             | Vue Composable (推荐使用)        | ✅ 已创建 |
| `background/main.ts`                    | 注册到 Service Worker            | ✅ 已更新 |
| `background/CRAWLER_ARCHITECTURE.md`    | 架构文档                         | ✅ 已创建 |
| `composables/CRAWLER_USAGE_GUIDE.md`    | 使用指南                         | ✅ 已创建 |

---

## 🎯 需要迁移的文件

### 1. ⭐ `services/bookmark-crawler-trigger.ts` (核心)

**当前状态：** 所有函数都在前端运行

**迁移策略：**

#### 1.1 可以直接废弃的函数

| 函数                            | 原因                                 | 替代方案                                       |
| ------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `startPeriodicCrawl()`          | 已由 `BackgroundCrawlerManager` 实现 | 自动运行，无需调用                             |
| `stopPeriodicCrawl()`           | 定期爬取是核心功能，不应停止         | 如需控制，在 `BackgroundCrawlerManager` 中添加 |
| `startAutocrawlOnBookmarkAdd()` | 应在 Service Worker 监听             | 迁移到 `background/bookmarks.ts`               |

#### 1.2 需要改为消息通信的函数

| 函数                          | 迁移方式                                                           | 优先级         |
| ----------------------------- | ------------------------------------------------------------------ | -------------- |
| `crawlUnprocessedBookmarks()` | 已在 `BackgroundCrawlerManager` 实现                               | P0 - 已完成 ✅ |
| `crawlBookmarksByIds()`       | 包装为 `backgroundCrawlerClient.startCrawl(ids)`                   | P0 - 需迁移    |
| `crawlChromeBookmarks()`      | 包装为 `backgroundCrawlerClient.startCrawl(ids)`                   | P1 - 需迁移    |
| `recrawlAllBookmarks()`       | 包装为 `backgroundCrawlerClient.startCrawl(allIds, {force: true})` | P1 - 需迁移    |

#### 1.3 保留的工具函数

| 函数               | 说明                   | 无需修改 |
| ------------------ | ---------------------- | -------- |
| `getCrawlStatus()` | 纯数据查询，前端可调用 | ✅       |
| `testCrawlUrl()`   | 开发调试工具           | ✅       |

---

### 2. 🧠 `services/smart-recommendation-engine.ts`

**当前使用：** `crawlSingleBookmark()` - 在智能推荐时爬取书签

**迁移策略：**

```typescript
// ❌ 旧代码
await crawlSingleBookmark(chromeBookmark)

// ✅ 新代码
await backgroundCrawlerClient.startCrawl([bookmark.id], {
  maxConcurrent: 1,
  onlyWhenIdle: false // 用户主动触发，立即执行
})
```

**优先级：** P1（智能推荐是辅助功能，不影响核心）

---

### 3. 📄 页面组件（目前没有使用）

#### 已检查的页面

| 页面                              | 是否使用爬取 | 状态        |
| --------------------------------- | ------------ | ----------- |
| `pages/management/Management.vue` | ❌ 未使用    | ✅ 无需迁移 |
| `pages/popup/Popup.vue`           | ❌ 未使用    | ✅ 无需迁移 |
| `pages/side-panel/SidePanel.vue`  | ❌ 未使用    | ✅ 无需迁移 |
| `pages/settings/**/*.vue`         | ❌ 未使用    | ✅ 无需迁移 |

#### 未来可能需要添加爬取功能的页面

| 页面             | 功能场景                   | 建议                           |
| ---------------- | -------------------------- | ------------------------------ |
| `Management.vue` | 手动触发爬取所选书签       | 使用 `useCrawler()` composable |
| `Popup.vue`      | 显示爬取进度状态           | 使用 `useCrawler()` 只读模式   |
| Settings 相关    | 爬取配置（并发数、间隔等） | 使用 `chrome.storage.local`    |

---

## 🔄 迁移步骤（渐进式）

### Phase 1: 核心服务迁移 (P0)

- [x] 1.1 创建 `BackgroundCrawlerManager`
- [x] 1.2 创建 `BackgroundCrawlerClient`
- [x] 1.3 创建 `useCrawler` composable
- [ ] 1.4 更新 `bookmark-crawler-trigger.ts` 中的关键函数
  - [ ] 包装 `crawlBookmarksByIds()`
  - [ ] 添加废弃提示注释
  - [ ] 保留向后兼容（暂时）

### Phase 2: 智能推荐迁移 (P1)

- [ ] 2.1 更新 `smart-recommendation-engine.ts`
- [ ] 2.2 测试推荐爬取功能

### Phase 3: 前端页面集成 (P2)

- [ ] 3.1 Management.vue 添加手动爬取按钮
- [ ] 3.2 Popup.vue 显示爬取状态
- [ ] 3.3 Settings.vue 添加爬取配置

### Phase 4: 清理工作 (P3)

- [ ] 4.1 移除 `bookmark-crawler-trigger.ts` 中的废弃函数
- [ ] 4.2 更新所有导入路径
- [ ] 4.3 添加迁移完成日志

---

## 🧪 测试清单

### 功能测试

- [ ] 后台定期爬取（chrome.alarms）
- [ ] 手动触发爬取（前端消息）
- [ ] 多页面进度同步
- [ ] 关闭页面后继续运行
- [ ] 重启浏览器后恢复任务

### 性能测试

- [ ] 大量书签（1万+）爬取性能
- [ ] 并发控制（不超过 `maxConcurrent`）
- [ ] 内存占用（Service Worker）
- [ ] Offscreen Document 生命周期

### 兼容性测试

- [ ] 向后兼容旧代码（过渡期）
- [ ] 错误处理（网络失败、超时）
- [ ] 边界情况（空书签、无效 URL）

---

## 📊 迁移进度

**总体进度：** 40% (基础设施完成)

| 阶段              | 进度 | 状态      |
| ----------------- | ---- | --------- |
| Phase 1: 核心服务 | 75%  | 🟡 进行中 |
| Phase 2: 智能推荐 | 0%   | ⚪ 未开始 |
| Phase 3: 前端集成 | 0%   | ⚪ 未开始 |
| Phase 4: 清理工作 | 0%   | ⚪ 未开始 |

---

## 🚨 注意事项

### 1. Service Worker 限制

- ❌ 不能使用 `window`、`document`、`localStorage`
- ✅ 必须使用 `chrome.storage.*` 替代
- ✅ 定时器使用 `chrome.alarms` 替代 `setTimeout`

### 2. Offscreen Document

- 爬取任务依然需要 Offscreen Document 解析 HTML
- `BackgroundCrawlerManager` 会自动管理 Offscreen 生命周期
- 无需前端页面干预

### 3. 向后兼容

- 旧代码暂时保留，添加 `@deprecated` 注释
- 新代码优先使用 `useCrawler()` composable
- 过渡期：3个版本（约3个月）

### 4. 调试技巧

```javascript
// Service Worker Console
chrome.alarms.getAll(alarms => console.log(alarms))
chrome.alarms.create('crawl-periodic', { when: Date.now() })

// 查看后台爬取状态
chrome.runtime.sendMessage({ type: 'GET_CRAWL_PROGRESS' }, res =>
  console.log(res)
)
```

---

## 📚 相关文档

- [架构文档](./background/CRAWLER_ARCHITECTURE.md)
- [使用指南](./composables/CRAWLER_USAGE_GUIDE.md)
- [产品文档](../../文档/产品文档/AcuityBookmarks-产品文档-v3.0.md)

---

**最后更新：** 2025-10-27  
**维护者：** AcuityBookmarks Team
