# 性能优化指南

本文档说明 AcuityBookmarks 项目的性能优化策略和最佳实践。

## 目录

- [性能目标](#性能目标)
- [加载性能优化](#加载性能优化)
- [运行时性能优化](#运行时性能优化)
- [内存优化](#内存优化)
- [性能监控](#性能监控)
- [最佳实践](#最佳实践)

---

## 性能目标

### Core Web Vitals

| 指标 | 目标 | 说明 |
|------|------|------|
| **FCP** (First Contentful Paint) | < 1.8s | 首次内容绘制时间 |
| **LCP** (Largest Contentful Paint) | < 2.5s | 最大内容绘制时间 |
| **FID** (First Input Delay) | < 100ms | 首次输入延迟 |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 累积布局偏移 |
| **TTFB** (Time to First Byte) | < 600ms | 首字节时间 |

### 应用性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| **首屏加载** | < 1s | Popup 页面首屏加载时间 |
| **页面切换** | < 300ms | Management 页面切换时间 |
| **搜索响应** | < 100ms | 搜索结果返回时间 |
| **内存使用** | < 50MB | 应用内存占用 |
| **Bundle 大小** | < 2MB | 总 Bundle 大小（gzip 后） |

---

## 加载性能优化

### 1. 代码分割

**策略：**
- 按路由分割（Popup、Management、Settings 等）
- 按功能分割（搜索、拖拽、AI 等）
- 按依赖分割（Vue、Pinia、FlexSearch 等）

**实现：**
```typescript
// 懒加载组件
const BookmarkList = defineAsyncComponent(() => import('./BookmarkList.vue'))

// 懒加载模块
const loadHeavyModule = createLazyModule(() => import('./heavy-module'))
```

### 2. 懒加载

**组件懒加载：**
```typescript
import { createLazyComponent } from '@/utils/lazy-load'

const BookmarkTree = createLazyComponent({
  loader: () => import('./BookmarkTree.vue'),
  delay: 200,
  timeout: 10000,
  preloadOnIdle: true
})
```

**模块懒加载：**
```typescript
// 字体服务懒加载
const loadFontService = () => import('@/application/font/font-service')

// 使用时加载
const { fontService } = await loadFontService()
```

### 3. 预加载

**关键资源预加载：**
```typescript
import { preloadComponent, preloadComponents } from '@/utils/lazy-load'

// 高优先级预加载（立即）
preloadComponent(() => import('./BookmarkList.vue'), 'high')

// 低优先级预加载（空闲时）
preloadComponents([
  () => import('./BookmarkTree.vue'),
  () => import('./BookmarkSearch.vue')
])
```

**图片懒加载：**
```typescript
import { lazyLoadImages } from '@/utils/lazy-load'

// 在组件挂载后调用
onMounted(() => {
  lazyLoadImages('img[data-src]')
})
```

### 4. 资源优化

**图片优化：**
- 使用 WebP 格式
- 压缩图片（TinyPNG）
- 使用 srcset 响应式图片
- 懒加载非首屏图片

**字体优化：**
- 使用 woff2 格式
- 字体子集化（只包含需要的字符）
- 使用 font-display: swap
- 预加载关键字体

**CSS 优化：**
- 提取关键 CSS（内联首屏 CSS）
- 异步加载非关键 CSS
- 使用 CSS 变量减少重复
- 移除未使用的 CSS

---

## 运行时性能优化

### 1. 虚拟滚动

**使用场景：**
- 书签列表（2万+ 书签）
- 搜索结果列表
- 文件夹树

**实现：**
```vue
<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'

const virtualizer = useVirtualizer({
  count: bookmarks.value.length,
  getScrollElement: () => scrollElement.value,
  estimateSize: () => 48, // 每项高度
  overscan: 5 // 预渲染项数
})
</script>

<template>
  <div ref="scrollElement" class="scroll-container">
    <div :style="{ height: `${virtualizer.getTotalSize()}px` }">
      <div
        v-for="item in virtualizer.getVirtualItems()"
        :key="item.key"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${item.size}px`,
          transform: `translateY(${item.start}px)`
        }"
      >
        <BookmarkItem :bookmark="bookmarks[item.index]" />
      </div>
    </div>
  </div>
</template>
```

### 2. 防抖和节流

**防抖（Debounce）：**
```typescript
import { useDebounceFn } from '@vueuse/core'

const debouncedSearch = useDebounceFn((query: string) => {
  // 搜索逻辑
}, 300)
```

**节流（Throttle）：**
```typescript
import { useThrottleFn } from '@vueuse/core'

const throttledScroll = useThrottleFn(() => {
  // 滚动处理逻辑
}, 100)
```

### 3. Web Worker

**搜索 Worker：**
```typescript
// 主线程
const worker = new Worker(new URL('@/workers/query-worker.ts', import.meta.url), {
  type: 'module'
})

worker.postMessage({ type: 'query', q: 'search term' })

worker.onmessage = (e) => {
  const { type, hits } = e.data
  if (type === 'result') {
    // 处理搜索结果
  }
}
```

**Worker 线程：**
```typescript
// query-worker.ts
self.onmessage = (e) => {
  const { type, q } = e.data
  if (type === 'query') {
    const results = performSearch(q)
    self.postMessage({ type: 'result', hits: results })
  }
}
```

### 4. 缓存策略

**内存缓存：**
```typescript
const cache = new Map<string, SearchResult[]>()

function search(query: string) {
  // 检查缓存
  if (cache.has(query)) {
    return cache.get(query)
  }
  
  // 执行搜索
  const results = performSearch(query)
  
  // 缓存结果
  cache.set(query, results)
  
  return results
}
```

**IndexedDB 缓存：**
```typescript
// 缓存搜索索引
await indexedDBManager.setSearchIndex(index)

// 读取缓存
const cachedIndex = await indexedDBManager.getSearchIndex()
```

---

## 内存优化

### 1. 避免内存泄漏

**清理事件监听器：**
```typescript
onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
```

**清理定时器：**
```typescript
const timer = setInterval(() => {
  // 定时任务
}, 1000)

onUnmounted(() => {
  clearInterval(timer)
})
```

**清理 Observer：**
```typescript
const observer = new IntersectionObserver(callback)

onUnmounted(() => {
  observer.disconnect()
})
```

### 2. 优化数据结构

**使用 Map 代替 Object：**
```typescript
// ❌ 慢
const bookmarks: Record<string, Bookmark> = {}
const bookmark = bookmarks[id]

// ✅ 快
const bookmarks = new Map<string, Bookmark>()
const bookmark = bookmarks.get(id)
```

**使用 Set 代替 Array：**
```typescript
// ❌ 慢（O(n)）
const ids: string[] = []
const exists = ids.includes(id)

// ✅ 快（O(1)）
const ids = new Set<string>()
const exists = ids.has(id)
```

### 3. 分页加载

**无限滚动：**
```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['bookmarks'],
  queryFn: ({ pageParam = 0 }) => fetchBookmarks(pageParam),
  getNextPageParam: (lastPage, pages) => lastPage.nextCursor
})

// 滚动到底部时加载更多
onScroll(() => {
  if (isBottom() && hasNextPage) {
    fetchNextPage()
  }
})
```

---

## 性能监控

### 1. 使用性能监控器

**初始化：**
```typescript
import { performanceMonitor } from '@/utils/performance-monitor'

// 启动监控
performanceMonitor.initialize()

// 获取指标
const metrics = performanceMonitor.getMetrics()

// 获取评分
const score = performanceMonitor.getPerformanceScore()

// 获取建议
const suggestions = performanceMonitor.getOptimizationSuggestions()

// 打印报告
performanceMonitor.printReport()
```

### 2. Chrome DevTools

**Performance 面板：**
1. 打开 DevTools → Performance
2. 点击 Record 开始录制
3. 执行操作（加载页面、搜索等）
4. 停止录制，分析性能瓶颈

**Memory 面板：**
1. 打开 DevTools → Memory
2. 选择 Heap snapshot
3. 拍摄快照，分析内存使用

**Lighthouse：**
1. 打开 DevTools → Lighthouse
2. 选择 Performance
3. 生成报告，查看优化建议

### 3. 自定义性能指标

**测量函数执行时间：**
```typescript
function measurePerformance<T>(fn: () => T, label: string): T {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  console.log(`${label}: ${duration.toFixed(2)}ms`)
  return result
}

// 使用
const results = measurePerformance(() => {
  return performSearch(query)
}, 'Search')
```

**测量异步函数：**
```typescript
async function measureAsyncPerformance<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  console.log(`${label}: ${duration.toFixed(2)}ms`)
  return result
}
```

---

## 最佳实践

### 1. 首屏优化

**优先级：**
1. 关键 CSS（内联）
2. 关键 JavaScript（内联或预加载）
3. 首屏内容
4. 非关键 CSS（异步加载）
5. 非关键 JavaScript（懒加载）
6. 非首屏内容（懒加载）

**实现：**
```typescript
// 1. 优先挂载应用
app.mount('#app')

// 2. 延迟加载非关键功能
setTimeout(async () => {
  const { initCrossPageSync } = await import('@/composables/useCrossPageSync')
  initCrossPageSync()
}, 1000)

// 3. 空闲时预加载
requestIdleCallback(() => {
  preloadComponents([
    () => import('./BookmarkTree.vue'),
    () => import('./BookmarkSearch.vue')
  ])
})
```

### 2. 交互优化

**立即反馈：**
```typescript
// ❌ 等待异步操作完成
async function deleteBookmark(id: string) {
  await api.deleteBookmark(id)
  bookmarks.value = bookmarks.value.filter(b => b.id !== id)
}

// ✅ 立即更新 UI，异步操作在后台
async function deleteBookmark(id: string) {
  // 立即更新 UI
  bookmarks.value = bookmarks.value.filter(b => b.id !== id)
  
  // 后台删除
  try {
    await api.deleteBookmark(id)
  } catch (error) {
    // 失败时回滚
    bookmarks.value = [...bookmarks.value, deletedBookmark]
  }
}
```

**防止重复操作：**
```typescript
const isDeleting = ref(false)

async function deleteBookmark(id: string) {
  if (isDeleting.value) return
  
  isDeleting.value = true
  try {
    await api.deleteBookmark(id)
  } finally {
    isDeleting.value = false
  }
}
```

### 3. 渲染优化

**使用 v-show 代替 v-if：**
```vue
<!-- ❌ 频繁切换时慢 -->
<div v-if="isVisible">Content</div>

<!-- ✅ 频繁切换时快 -->
<div v-show="isVisible">Content</div>
```

**使用 key 优化列表：**
```vue
<!-- ❌ 没有 key -->
<div v-for="item in items">{{ item.name }}</div>

<!-- ✅ 有 key -->
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

**避免不必要的响应式：**
```typescript
// ❌ 所有属性都是响应式
const data = reactive({
  id: '123',
  name: 'Bookmark',
  metadata: { /* 大量数据 */ }
})

// ✅ 只有需要的属性是响应式
const data = {
  id: '123',
  name: ref('Bookmark'),
  metadata: { /* 大量数据 */ }
}
```

### 4. 网络优化

**批量请求：**
```typescript
// ❌ 多次请求
for (const id of ids) {
  await api.getBookmark(id)
}

// ✅ 批量请求
await api.getBookmarks(ids)
```

**请求缓存：**
```typescript
import { useQuery } from '@tanstack/vue-query'

const { data } = useQuery({
  queryKey: ['bookmarks', id],
  queryFn: () => api.getBookmark(id),
  staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  cacheTime: 10 * 60 * 1000 // 10 分钟后清除缓存
})
```

---

## 性能检查清单

### 加载性能

- [ ] FCP < 1.8s
- [ ] LCP < 2.5s
- [ ] TTFB < 600ms
- [ ] Bundle 大小 < 2MB (gzip)
- [ ] 首屏加载 < 1s

### 运行时性能

- [ ] FID < 100ms
- [ ] 搜索响应 < 100ms
- [ ] 页面切换 < 300ms
- [ ] 无明显卡顿
- [ ] 60fps 流畅滚动

### 内存性能

- [ ] 内存使用 < 50MB
- [ ] 无内存泄漏
- [ ] 长时间运行稳定

### 用户体验

- [ ] CLS < 0.1
- [ ] 立即反馈
- [ ] 加载状态提示
- [ ] 错误处理完善

---

## 参考资料

- [Web Vitals](https://web.dev/vitals/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Vue Performance](https://vuejs.org/guide/best-practices/performance.html)
- [TanStack Virtual](https://tanstack.com/virtual/latest)

---

**最后更新**: 2026-05-07  
**版本**: 1.0.0
