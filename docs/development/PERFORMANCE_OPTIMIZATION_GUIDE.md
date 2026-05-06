# 性能优化指南

本文档介绍 AcuityBookmarks 项目的性能优化策略和工具使用方法。

---

## 📊 性能监控

### IndexedDB 性能监控

项目提供了完整的 IndexedDB 性能监控工具，可以帮助你：
- 监控 IndexedDB 操作性能
- 检测慢查询
- 跟踪失败操作
- 分析性能瓶颈

#### 基本使用

```typescript
import { performanceMonitor } from '@/infrastructure/indexeddb/manager'

// 获取性能统计
const stats = performanceMonitor.getStats()
console.log('总操作数:', stats.totalOperations)
console.log('成功率:', stats.successRate)
console.log('平均耗时:', stats.averageDuration, 'ms')

// 按操作类型查看统计
console.log('读操作:', stats.byType.read)
console.log('写操作:', stats.byType.write)

// 按对象存储查看统计
console.log('书签存储:', stats.byStore.bookmarks)
```

#### 检测慢查询

```typescript
// 获取耗时超过 100ms 的查询
const slowQueries = performanceMonitor.getSlowQueries(100, 10)

slowQueries.forEach(query => {
  console.log(`慢查询: ${query.type} ${query.storeName}`)
  console.log(`耗时: ${query.duration}ms`)
  console.log(`记录数: ${query.recordCount}`)
})
```

#### 检测失败操作

```typescript
// 获取最近的失败操作
const failedOps = performanceMonitor.getFailedOperations(10)

failedOps.forEach(op => {
  console.log(`失败操作: ${op.type} ${op.storeName}`)
  console.log(`错误: ${op.error}`)
})
```

#### 导出性能数据

```typescript
// 导出所有性能数据供分析
const data = performanceMonitor.export()

// 保存到文件或发送到分析服务
console.log('性能数据:', JSON.stringify(data, null, 2))
```

---

## 🔍 搜索缓存优化

### LRU 缓存策略

项目使用 LRU（Least Recently Used）缓存策略来管理搜索结果缓存：

- **自动淘汰**: 当缓存满时，自动淘汰最久未使用的条目
- **O(1) 性能**: 利用 Map 的插入顺序，实现 O(1) 的淘汰操作
- **智能失效**: 根据书签变更类型，选择性失效缓存

#### 缓存配置

```typescript
import { QueryCache } from '@/core/query-engine/query-cache'

// 创建缓存实例
const cache = new QueryCache({
  maxSize: 1000,        // 最大缓存条目数
  ttl: 5 * 60 * 1000,   // 缓存生存时间（5分钟）
  logger: logger        // Logger 实例
})
```

#### 缓存预热

```typescript
// 预热常用查询
await cache.warmup([
  { query: 'javascript', results: [...] },
  { query: 'vue', results: [...] },
  { query: 'react', results: [...] }
])
```

#### 智能失效

```typescript
// 全量同步：清空所有缓存
cache.invalidateByChange('full_sync')

// 书签新增：保留缓存（TTL 自然过期）
cache.invalidateByChange('bookmark_created')

// 书签删除：只失效包含已删除书签的缓存
cache.invalidateByChange('bookmark_deleted', ['bookmark-id-1', 'bookmark-id-2'])
```

#### 缓存统计

```typescript
// 获取缓存统计
const stats = cache.getStats()

console.log('缓存大小:', stats.size)
console.log('命中率:', stats.hitRate)
console.log('命中次数:', stats.hits)
console.log('未命中次数:', stats.misses)

// 查看热门查询
stats.entries.forEach(entry => {
  console.log(`查询: ${entry.key}`)
  console.log(`命中次数: ${entry.hits}`)
  console.log(`缓存时长: ${entry.age}ms`)
})
```

---

## ⚡ 性能优化最佳实践

### 1. IndexedDB 批量操作

**问题**: 大量单条操作会导致性能下降

**解决方案**: 使用批量操作 API

```typescript
// ❌ 错误：逐条插入
for (const bookmark of bookmarks) {
  await indexedDBManager.updateBookmark(bookmark)
}

// ✅ 正确：批量插入
await indexedDBManager.insertBookmarks(bookmarks, {
  batchSize: 2000,              // 批次大小
  delayBetweenBatches: 10,      // 批次间延迟（ms）
  progressCallback: (current, total) => {
    console.log(`进度: ${current}/${total}`)
  },
  errorCallback: (error, item) => {
    console.error('插入失败:', error, item)
  }
})
```

### 2. 搜索结果缓存

**问题**: 重复搜索导致性能浪费

**解决方案**: 使用搜索缓存

```typescript
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'

// 搜索服务内置缓存，自动管理
const results = await bookmarkSearchService.search('javascript', {
  strategy: 'hybrid',
  limit: 20
})

// 重复搜索会命中缓存，速度提升 50-80%
const cachedResults = await bookmarkSearchService.search('javascript', {
  strategy: 'hybrid',
  limit: 20
})
```

### 3. 虚拟滚动

**问题**: 渲染大量列表项导致性能下降

**解决方案**: 使用虚拟滚动

```vue
<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'

const virtualizer = useVirtualizer({
  count: bookmarks.length,
  getScrollElement: () => scrollElement.value,
  estimateSize: () => 48,       // 每项高度
  overscan: 10,                 // 预渲染 10 项
  scrollBehavior: 'smooth'      // 平滑滚动
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

### 4. 防抖和节流

**问题**: 频繁触发事件导致性能下降

**解决方案**: 使用防抖和节流

```typescript
import { useDebounceFn, useThrottleFn } from '@vueuse/core'

// 防抖：延迟执行，只执行最后一次
const debouncedSearch = useDebounceFn((query: string) => {
  performSearch(query)
}, 300)

// 节流：限制执行频率
const throttledScroll = useThrottleFn(() => {
  handleScroll()
}, 100)
```

### 5. 让出主线程

**问题**: 长时间运行的操作阻塞 UI

**解决方案**: 定期让出主线程

```typescript
async function processLargeArray(items: unknown[]) {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i])
    
    // 每 100 项让出主线程
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
}
```

---

## 📈 性能指标

### 目标指标

| 指标 | 目标值 | 当前值 | 状态 |
|------|--------|--------|------|
| 全量同步（2万书签） | < 10s | ~8-12s | 🟡 接近目标 |
| 搜索响应时间 | < 100ms | ~50-150ms | 🟡 基本达标 |
| UI 渲染 FPS | > 60 | ~55-60 | 🟡 基本达标 |
| 内存占用 | < 500MB | ~300-400MB | ✅ 达标 |
| 缓存命中率 | > 50% | 待测试 | ⏳ 待验证 |

### 性能测试

```typescript
// 测试全量同步性能
async function testFullSync() {
  const start = performance.now()
  await bookmarkSyncService.syncAllBookmarks()
  const duration = performance.now() - start
  console.log(`全量同步耗时: ${duration}ms`)
}

// 测试搜索性能
async function testSearch() {
  const queries = ['javascript', 'vue', 'react', 'typescript']
  
  for (const query of queries) {
    const start = performance.now()
    await bookmarkSearchService.search(query)
    const duration = performance.now() - start
    console.log(`搜索 "${query}" 耗时: ${duration}ms`)
  }
}

// 测试缓存命中率
async function testCacheHitRate() {
  const cache = bookmarkSearchService.getCache()
  const stats = cache.getStats()
  console.log(`缓存命中率: ${(stats.hitRate * 100).toFixed(2)}%`)
}
```

---

## 🔧 性能调试工具

### Chrome DevTools

1. **Performance 面板**
   - 录制性能分析
   - 查看火焰图
   - 分析长任务

2. **Memory 面板**
   - 堆快照
   - 内存泄漏检测
   - 内存分配时间线

3. **Network 面板**
   - 网络请求分析
   - 资源加载时间
   - 缓存命中情况

### Vue DevTools

1. **Performance 面板**
   - 组件渲染时间
   - 组件更新频率
   - 性能瓶颈分析

2. **Timeline 面板**
   - 事件时间线
   - 组件生命周期
   - 状态变更追踪

---

## 📚 相关文档

- [第四阶段性能优化完成报告](../PHASE4_PERFORMANCE_COMPLETE.md)
- [第四阶段性能优化方案](../PHASE4_PERFORMANCE_PLAN.md)
- [性能监控工具源码](../../frontend/src/infrastructure/indexeddb/performance-monitor.ts)
- [查询缓存源码](../../frontend/src/core/query-engine/query-cache.ts)

---

**维护者**: System  
**最后更新**: 2026-05-06
