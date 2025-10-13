# Service Worker 环境说明

## 🎯 核心概念

Chrome Extension 使用 **Service Worker** 作为后台脚本（Manifest V3），与传统的网页环境完全不同。

---

## 📊 环境对比

| 特性           | Service Worker | Window（网页） |
| -------------- | -------------- | -------------- |
| **全局对象**   | `self`         | `window`       |
| **通用全局**   | `globalThis`   | `globalThis`   |
| **DOM API**    | ❌ 无          | ✅ 有          |
| **document**   | ❌ 无          | ✅ 有          |
| **Chrome API** | ✅ 有          | ✅ 有          |
| **控制台位置** | Service Worker | DevTools       |

---

## 🚫 常见错误

### 错误 1: 使用 window 对象

```javascript
// ❌ Service Worker 中会报错
const crawler = window.bookmarkCrawler
// ReferenceError: window is not defined
```

**解决方案**：

```javascript
// ✅ 使用 self 或 globalThis
const crawler = self.bookmarkCrawler
// 或
const crawler = globalThis.bookmarkCrawler
```

### 错误 2: 访问 DOM

```javascript
// ❌ Service Worker 中会报错
document.querySelector('#app')
// ReferenceError: document is not defined
```

**解决方案**：

如果需要操作 DOM，应该在 Content Script 或页面中执行。

### 错误 3: 使用 localStorage

```javascript
// ❌ Service Worker 中会报错
localStorage.setItem('key', 'value')
// ReferenceError: localStorage is not defined
```

**解决方案**：

```javascript
// ✅ 使用 chrome.storage API
await chrome.storage.local.set({ key: 'value' })
const { key } = await chrome.storage.local.get('key')
```

---

## 🔧 如何在 Service Worker 中测试

### 步骤 1: 打开 Service Worker 控制台

```
1. 打开 chrome://extensions
2. 找到 AcuityBookmarks 扩展
3. 点击 "Service Worker" 链接
4. 这会打开 Service Worker 的开发者工具
```

### 步骤 2: 检查环境

```javascript
// 检查当前环境
console.log(
  '当前环境:',
  typeof window !== 'undefined' ? 'Window' : 'Service Worker'
)
console.log('self:', self)
console.log('globalThis:', globalThis)
```

**输出（Service Worker）**：

```
当前环境: Service Worker
self: ServiceWorkerGlobalScope { ... }
globalThis: ServiceWorkerGlobalScope { ... }
```

### 步骤 3: 使用正确的全局对象

```javascript
// ✅ Service Worker 中测试爬取功能
// 方式 1: 使用 self
const crawler = self.bookmarkCrawler

// 方式 2: 使用 globalThis（推荐）
const crawler = globalThis.bookmarkCrawler

// 方式 3: 直接导入模块（最推荐）
const { crawlSingleBookmark } = await import(
  './assets/app-services.CvlJmFwV.js'
)
```

---

## 📝 兼容性写法

### 方式 1: 条件判断

```javascript
// 兼容 Service Worker 和 Window
const global = typeof window !== 'undefined' ? window : self

// 使用
global.myVariable = 'value'
```

### 方式 2: 使用 globalThis（推荐）

```javascript
// ES2020+ 通用写法
globalThis.myVariable = 'value'

// 在任何环境都可用
console.log(globalThis.myVariable)
```

### 方式 3: 同时挂载

```javascript
// 同时支持 window 和 self
if (typeof globalThis !== 'undefined') {
  globalThis.myAPI = {
    /* ... */
  }

  // 额外挂载到 self
  if (typeof self !== 'undefined') {
    self.myAPI = globalThis.myAPI
  }
}
```

---

## 🧪 测试爬取功能的正确方法

### 在 Service Worker 控制台

```javascript
// ❌ 错误写法
const crawler = window.bookmarkCrawler // ReferenceError!

// ✅ 正确写法
const crawler = self.bookmarkCrawler
// 或
const crawler = globalThis.bookmarkCrawler

// 使用
await crawler.testUrl('https://github.com')
```

### 在 Management 页面控制台（有 window）

```javascript
// ✅ 都可以用
const crawler = window.bookmarkCrawler
const crawler = self.bookmarkCrawler
const crawler = globalThis.bookmarkCrawler

// 推荐：直接导入
const { crawlSingleBookmark } = await import(
  './assets/app-services.CvlJmFwV.js'
)
```

---

## 🎯 推荐测试流程

### 1. Service Worker 控制台测试

**打开方式**：

- chrome://extensions → Service Worker

**测试代码**：

```javascript
// 方式 A: 使用全局对象
self.bookmarkCrawler.testUrl('https://github.com')

// 方式 B: 动态导入（推荐）
const { testCrawlUrl } = await import(
  './src/services/bookmark-crawler-trigger.js'
)
await testCrawlUrl('https://github.com')
```

### 2. Management 页面控制台测试

**打开方式**：

- 右键扩展图标 → 管理书签 → F12

**测试代码**：

```javascript
// 完整测试脚本
;(async function quickTest() {
  // 导入模块
  const { crawlSingleBookmark, getCrawlStatistics } = await import(
    './assets/app-services.CvlJmFwV.js'
  )

  // 获取测试书签
  const bookmarks = await chrome.bookmarks.search({})
  const testBookmark = bookmarks.find(b => b.url)

  // 爬取
  await crawlSingleBookmark(testBookmark)

  // 查看统计
  const stats = await getCrawlStatistics()
  console.log('统计:', stats)
})()
```

---

## 📚 Chrome Extension API 可用性

### 在 Service Worker 中可用

```javascript
✅ chrome.bookmarks
✅ chrome.storage
✅ chrome.tabs
✅ chrome.runtime
✅ chrome.alarms
✅ chrome.contextMenus
✅ chrome.notifications
✅ chrome.offscreen  // 我们用这个！
```

### 在 Service Worker 中不可用

```javascript
❌ chrome.scripting.executeScript (需要在 background 调用，不是直接在 SW)
❌ DOM 相关 API
❌ window、document、localStorage
❌ XHR (使用 fetch 替代)
```

---

## 🔍 调试技巧

### 技巧 1: 判断当前环境

```javascript
function getEnvironment() {
  if (typeof window !== 'undefined' && window.document) {
    return 'Browser Window'
  }
  if (
    typeof WorkerGlobalScope !== 'undefined' &&
    self instanceof WorkerGlobalScope
  ) {
    return 'Web Worker'
  }
  if (
    typeof ServiceWorkerGlobalScope !== 'undefined' &&
    self instanceof ServiceWorkerGlobalScope
  ) {
    return 'Service Worker'
  }
  return 'Unknown'
}

console.log('当前环境:', getEnvironment())
```

### 技巧 2: 条件日志

```javascript
// 只在 Service Worker 中输出
if (typeof ServiceWorkerGlobalScope !== 'undefined') {
  console.log('[SW] Service Worker 已加载')
}

// 只在 Window 中输出
if (typeof window !== 'undefined') {
  console.log('[Window] 页面已加载')
}
```

### 技巧 3: 错误捕获

```javascript
try {
  // 尝试访问 window
  console.log(window)
} catch (error) {
  console.log('当前环境不支持 window 对象')
  console.log('使用 self 替代:', self)
}
```

---

## ⚠️ 注意事项

1. **不要假设 window 存在**
   - 始终使用 `globalThis` 或条件判断

2. **Offscreen Document 是特殊情况**
   - Offscreen Document 有 DOM，但是受限的
   - 我们的爬取功能就是利用这一点

3. **模块导入路径**
   - Service Worker 中的相对路径从扩展根目录开始
   - 页面中的路径从当前页面开始

4. **异步操作**
   - Service Worker 中大量使用 async/await
   - 不要使用 setTimeout 长时间任务，使用 chrome.alarms

---

## 📖 相关文档

- [Service Worker API](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [Offscreen Documents](https://developer.chrome.com/docs/extensions/reference/offscreen/)
- [globalThis (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis)

---

## 🎉 总结

| 场景           | 使用                 | 不要使用            |
| -------------- | -------------------- | ------------------- |
| 通用全局对象   | ✅ `globalThis`      | ❌ `window`         |
| Service Worker | ✅ `self`            | ❌ `window`         |
| Window 环境    | ✅ `window` / `self` | ❌ 假设存在         |
| 存储           | ✅ `chrome.storage`  | ❌ `localStorage`   |
| 网络请求       | ✅ `fetch`           | ❌ `XMLHttpRequest` |

**记住：Service Worker 是一个独立的执行环境，没有 DOM，没有 window！**
