# 后台爬取架构

## 📖 架构概述

爬取任务现在运行在 **Service Worker 后台**，不依赖前端页面是否打开。

```
┌─────────────────────────────────────────────┐
│  Service Worker (background)                │
│  ├─ BackgroundCrawlerManager                │ ← 核心管理器
│  │  ├─ chrome.alarms (定期触发)             │ ← 每小时自动爬取
│  │  ├─ chrome.runtime.onMessage (响应前端)  │ ← 处理手动触发
│  │  └─ CrawlTaskScheduler (调度器)          │ ← 任务队列
│  │                                           │
│  └─ Offscreen Document (DOM解析)            │ ← 解析 HTML
│     ├─ DOMParser                             │
│     └─ 返回元数据                            │
└─────────────────────────────────────────────┘
         ↑                       ↓
    消息通信              进度广播
         ↓                       ↑
┌─────────────────────────────────────────────┐
│  Frontend (Management/Popup 等页面)         │
│  └─ BackgroundCrawlerClient                 │ ← 客户端封装
│     ├─ startCrawl()                          │ ← 触发爬取
│     ├─ onProgress()                          │ ← 监听进度
│     └─ pause/resume/cancel()                 │ ← 控制爬取
└─────────────────────────────────────────────┘
```

## 🔑 核心组件

### 1. BackgroundCrawlerManager (Service Worker)

**位置**：`frontend/src/background/crawler-manager.ts`

**职责**：

- 管理爬取任务的完整生命周期
- 使用 `chrome.alarms` 定期自动爬取
- 响应前端页面的手动爬取请求
- 广播爬取进度到所有打开的页面

**特性**：

- ✅ 后台持续运行（即使关闭所有页面）
- ✅ 浏览器重启后自动恢复
- ✅ 使用 Offscreen Document 解析 HTML
- ✅ 状态持久化到 chrome.storage

### 2. BackgroundCrawlerClient (Frontend)

**位置**：`frontend/src/services/background-crawler-client.ts`

**职责**：

- 为前端页面提供简单的 API
- 封装消息通信细节
- 管理事件监听器

## 📝 使用示例

### 在 Management 页面中使用

```typescript
// ==================== Management.vue ====================
import { createCrawlerClient } from '@/services/background-crawler-client'
import { ref, onMounted, onUnmounted } from 'vue'

// 创建客户端
const crawlerClient = createCrawlerClient()

// 响应式状态
const crawlProgress = ref(0)
const isCrawling = ref(false)

onMounted(() => {
  // 监听进度更新
  const unsubscribeProgress = crawlerClient.onProgress(stats => {
    crawlProgress.value = stats.progress
    isCrawling.value = stats.running > 0
  })

  // 监听完成
  const unsubscribeComplete = crawlerClient.onComplete(stats => {
    console.log('爬取完成！', stats)
    isCrawling.value = false
  })

  // 监听错误
  const unsubscribeError = crawlerClient.onError(error => {
    console.error('爬取错误:', error.message)
  })

  // 清理
  onUnmounted(() => {
    unsubscribeProgress()
    unsubscribeComplete()
    unsubscribeError()
    crawlerClient.dispose()
  })
})

// 手动触发爬取
async function startCrawl() {
  const result = await crawlerClient.startCrawl({
    bookmarkIds: selectedBookmarkIds.value,
    priority: 'high'
  })

  if (result.success) {
    console.log('✅ 爬取已启动')
  } else {
    console.error('❌ 启动失败:', result.error)
  }
}

// 暂停/恢复
async function togglePause() {
  if (isPaused.value) {
    await crawlerClient.resume()
  } else {
    await crawlerClient.pause()
  }
}

// 取消
async function cancel() {
  await crawlerClient.cancel()
}
```

### 获取当前进度

```typescript
// 获取一次性进度快照
const stats = await crawlerClient.getProgress()
if (stats) {
  console.log(`进度: ${stats.completed}/${stats.total} (${stats.progress}%)`)
}
```

## 🔧 后台定时任务

### 定时爬取配置

```typescript
// crawler-manager.ts
private readonly CRAWL_INTERVAL_MINUTES = 60  // 每小时

// chrome.alarms.create('crawl-periodic', {
//   periodInMinutes: 60
// })
```

### 触发时机

1. **自动触发**：每小时自动爬取未处理的书签
2. **手动触发**：前端页面调用 `startCrawl()`
3. **Service Worker 启动时**：可选择立即执行一次

### 爬取策略

```typescript
// 未处理的书签定义：
// 1. 没有元数据的书签
// 2. 元数据过期的书签（30天以上）

private filterUnprocessedBookmarks(bookmarks: BookmarkRecord[]): BookmarkRecord[] {
  return bookmarks.filter(bookmark => {
    if (!bookmark.url) return false
    if (!bookmark.hasMetadata) return true  // 没有元数据

    // 元数据过期
    if (bookmark.metadataUpdatedAt) {
      const age = Date.now() - bookmark.metadataUpdatedAt
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      return age > thirtyDays
    }

    return false
  })
}
```

## 📡 消息协议

### Frontend → Backend

```typescript
// 1. 启动爬取
{
  type: 'START_CRAWL',
  data: {
    bookmarkIds?: string[],  // 可选，指定书签ID
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'urgent',
      respectRobots?: boolean
    }
  }
}

// 2. 获取进度
{ type: 'GET_CRAWL_PROGRESS' }

// 3. 暂停
{ type: 'PAUSE_CRAWL' }

// 4. 恢复
{ type: 'RESUME_CRAWL' }

// 5. 取消
{ type: 'CANCEL_CRAWL' }
```

### Backend → Frontend

```typescript
// 1. 进度更新
{
  type: 'CRAWL_PROGRESS_UPDATE',
  data: {
    total: number,
    completed: number,
    failed: number,
    pending: number,
    running: number,
    progress: number  // 0-100
  }
}

// 2. 任务完成
{
  type: 'CRAWL_TASK_COMPLETE',
  data: { /* task info */ }
}

// 3. 全部完成
{
  type: 'CRAWL_COMPLETE',
  data: { /* statistics */ }
}

// 4. 错误
{
  type: 'CRAWL_ERROR',
  data: { message: string }
}
```

## 🎯 对比：旧架构 vs 新架构

| 特性           | 旧架构（前端）      | 新架构（后台）            |
| -------------- | ------------------- | ------------------------- |
| **运行位置**   | Management 页面     | Service Worker            |
| **持续运行**   | ❌ 页面关闭后停止   | ✅ 后台持续运行           |
| **定期爬取**   | ❌ 需要页面打开     | ✅ chrome.alarms 定期触发 |
| **浏览器重启** | ❌ 任务丢失         | ✅ 自动恢复               |
| **资源占用**   | ❌ 占用页面资源     | ✅ 按需唤醒               |
| **用户体验**   | ❌ 必须保持页面打开 | ✅ 可以关闭所有页面       |
| **进度同步**   | ❌ 仅当前页面       | ✅ 所有页面实时同步       |

## ⚠️ 注意事项

### Service Worker 限制

1. **没有 DOM API**：必须使用 Offscreen Document 解析 HTML
2. **可能被终止**：不活跃 30 秒后可能被终止，但 chrome.alarms 会唤醒它
3. **持久化状态**：使用 chrome.storage 而非内存变量

### 前端页面

1. **异步通信**：所有消息都是异步的
2. **错误处理**：必须处理消息发送失败的情况
3. **清理监听器**：组件卸载时必须清理

## 🚀 迁移指南

### 旧代码（前端调用）

```typescript
// ❌ 旧方式：直接使用调度器
import { crawlTaskScheduler } from '@/services/crawl-task-scheduler'

await crawlTaskScheduler.scheduleBookmarksCrawl(bookmarks, {
  onProgress: stats => {
    /* ... */
  }
})
```

### 新代码（消息通信）

```typescript
// ✅ 新方式：通过客户端
import { createCrawlerClient } from '@/services/background-crawler-client'

const client = createCrawlerClient()
client.onProgress(stats => {
  /* ... */
})
await client.startCrawl({ bookmarkIds: ids })
```

## 📊 监控与调试

### 查看后台日志

```javascript
// Chrome DevTools → Service Worker → Console
// 所有日志带有 'BackgroundCrawler' 前缀
```

### 查看 Alarms

```javascript
// Chrome DevTools → Application → Service Workers → Inspect
chrome.alarms.getAll().then(console.log)
```

### 手动触发

```javascript
// 在 Service Worker Console 中
chrome.alarms.create('crawl-periodic', { when: Date.now() })
```

## 🔗 相关文件

- **后台管理器**：`frontend/src/background/crawler-manager.ts`
- **前端客户端**：`frontend/src/services/background-crawler-client.ts`
- **任务调度器**：`frontend/src/services/crawl-task-scheduler.ts`
- **Offscreen 管理**：`frontend/src/background/offscreen-manager.ts`
- **本地爬虫**：`frontend/src/services/local-crawler-worker.ts`

---

**最后更新**：2025-10-27
**架构版本**：v2.0 (Service Worker 后台爬取)
