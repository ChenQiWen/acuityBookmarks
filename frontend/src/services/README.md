# 统一应用服务与核心能力

## 概述

本目录文档介绍前端应用层服务如何统一调用核心能力（Diff 引擎、执行器、搜索）。
你应优先通过 Application Services 调用，而不是直接引用 utils。

包含三大部分：
- 搜索：`searchAppService`
- 书签变更计划与执行：`bookmarkChangeAppService`（内部使用 core/diff-engine 与 core/executor）
- 设置与健康状态：`settingsAppService`、`healthAppService`

## 书签搜索服务

`BookmarkSearchService` 是一个统一的本地书签搜索引擎，整合了项目中所有的搜索功能，提供高效、一致的书签检索体验。

### 主要特性

### 🚀 **多种搜索模式**
- **快速搜索 (fast)**: 基于索引的高速搜索，适用于实时搜索场景
- **精确搜索 (accurate)**: 基于评分的精确匹配，支持相关性排序和高亮
- **内存搜索 (memory)**: 在内存中进行实时搜索，响应速度最快

### 🎯 **智能匹配算法**
- **标题匹配**: 权重最高 (100/50)
- **URL匹配**: 中等权重 (30)
- **域名匹配**: 中等权重 (20)
- **关键词匹配**: 低权重 (15)
- **标签匹配**: 最低权重 (10)

### 🔍 **搜索字段支持**
- `title`: 书签标题
- `url`: 完整URL
- `domain`: 域名
- `keywords`: 关键词
- `tags`: 标签
- `path`: 文件夹路径

### ⚡ **性能优化**
- 搜索结果缓存
- 智能去重
- 结果数量限制
- 性能统计监控

## 基本用法

### 1) 搜索（通过应用服务，推荐）

```typescript
import { searchAppService } from '@/application/search/search-app-service'

// 搜索页面
const searchResults = await searchAppService.search('react hooks')

// 弹窗页面 - 快速搜索模式（由调用方决定 limit 等参数）
const popupResults = await searchAppService.search('vue components')

// 侧边栏 - 推荐统一走 searchAppService
const sideResults = await searchAppService.search('typescript')
```

## 各页面专用配置（搜索）

### SearchPopup 页面
```typescript
// 配置：精确搜索 + 高亮 + 完整字段
{
  mode: 'accurate',
  fields: ['title', 'url', 'domain', 'keywords', 'tags'],
  enableHighlight: true,
  minScore: 5,
  limit: 20
}
```

### Popup 弹窗
```typescript
// 配置：快速搜索 + 基础字段
{
  mode: 'fast',
  fields: ['title', 'url', 'domain'],
  enableHighlight: false,
  limit: 50
}
```

### SidePanel 侧边栏
```typescript
// 配置：内存搜索 + 实时响应
{
  mode: 'fast', // 或使用内存搜索
  fields: ['title', 'url', 'domain'],
  enableHighlight: false,
  limit: 50
}
```

## 搜索选项详解

### LocalSearchOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `'fast' \| 'accurate' \| 'memory'` | `'fast'` | 搜索模式 |
| `fields` | `SearchField[]` | `['title']` | 搜索字段 |
| `limit` | `number` | `50` | 结果数量限制 |
| `minScore` | `number` | `0` | 最低匹配分数 |
| `sortBy` | `'relevance' \| 'title' \| 'date' \| 'url'` | `'relevance'` | 排序方式 |
| `enableHighlight` | `boolean` | `false` | 是否启用高亮 |
| `deduplicate` | `boolean` | `true` | 是否去重 |

### 搜索结果格式

```typescript
interface StandardSearchResult {
  id: string              // 书签ID
  title: string           // 书签标题
  url: string             // 书签URL
  domain?: string         // 网站域名
  path?: string[]         // 文件夹路径
  score: number           // 匹配分数
  matchedFields: string[] // 匹配字段
  highlights?: Record<string, string[]> // 高亮信息
  isFolder: boolean       // 是否为文件夹
  dateAdded?: number      // 添加时间
  tags?: string[]         // 标签
  keywords?: string[]     // 关键词
}
```

## 性能监控（搜索）

### 搜索统计
```typescript
interface SearchStats {
  query: string           // 查询关键词
  mode: SearchMode        // 搜索模式
  duration: number        // 搜索耗时 (ms)
  totalResults: number    // 结果总数
  returnedResults: number // 返回结果数
  maxScore: number        // 最高分数
  avgScore: number        // 平均分数
}
```

### 缓存管理
```typescript
// 清除搜索缓存
bookmarkSearchService.clearCache()

// 获取缓存统计
const cacheStats = bookmarkSearchService.getCacheStats()
logger.info('SearchService', `缓存大小: ${cacheStats.size}/${cacheStats.maxSize}`)
```

## 书签变更：计划与执行（Plan & Execute）

推荐通过应用层服务一次性完成差异分析与执行，并在 UI 中获取可视化进度：

```ts
import { bookmarkChangeAppService } from '@/application/bookmark/bookmark-change-app-service'

// original 与 target 为 Chrome 的书签树结构（或经过转换的等价结构）
const { ok, value, error } = await bookmarkChangeAppService.planAndExecute(original, target, {
  onProgress: (p) => {
    // 进度指标：总任务、已完成、失败
    // p.total, p.completed, p.failed, p.currentOperation, p.estimatedTimeRemaining
  }
})

if (ok) {
  // value.diff: DiffResult（来自 core/bookmark/services/diff-engine）
  // value.execution: ExecutionResult（来自 core/bookmark/services/executor）
}
```

如需单独执行（已获得 DiffResult）：

```ts
import { SmartBookmarkExecutor } from '@/core/bookmark/services/executor'

const executor = new SmartBookmarkExecutor()
const execResult = await executor.executeDiff(diffResult, (p) => {/* 同上 */})
```

注意：避免在 UI/store 中直接操作 Chrome API，统一通过应用层或核心执行器处理。

### Diff 与执行器（核心能力）

- Diff 引擎：`@/core/bookmark/services/diff-engine`
  - 导出：`smartBookmarkDiffEngine`、`OperationType`、`BookmarkOperation`、`DiffResult`
- 执行器：`@/core/bookmark/services/executor`
  - 导出：`SmartBookmarkExecutor`、`smartBookmarkExecutor`、`ExecutionResult`、`ProgressCallback`

> 兼容说明：`utils/smart-bookmark-diff-engine` 与 `utils/smart-bookmark-executor` 仍保留转发导出，但请尽快迁移到 core 路径。

## 迁移指南（搜索）

### 从旧的搜索实现迁移

1. **替换搜索调用**:
   ```typescript
   // 旧代码
   const results = await indexedDBManager.searchBookmarks(query, options)
   
   // 新代码
   const { results } = await bookmarkSearchService.search(query, {
     mode: 'accurate',
     limit: options.limit
   })
   ```

2. **更新结果处理**:
   ```typescript
   // 旧格式：results[].bookmark
   // 新格式：results[] (直接是书签信息)
   ```

3. **使用应用服务**:
  ```typescript
  // 推荐使用应用层的 searchAppService，而不是旧的统一API
  import { searchAppService } from '@/application/search/search-app-service'
  const results = await searchAppService.search(query)
  ```

## 扩展计划

### 未来支持的搜索模式
- **AI搜索**: 基于LLM的语义搜索
- **全文搜索**: 网页内容的全文检索
- **智能推荐**: 基于用户行为的个性化推荐

### Omnibox集成
统一搜索服务为未来的omnibox功能提供了完美的基础：
```typescript
// 未来的omnibox实现
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const { results } = await bookmarkSearchService.search(text, {
    mode: 'fast',
    limit: 5
  })
  
  suggest(results.map(r => ({
    content: r.url,
    description: `📖 ${r.title} - ${r.domain}`
  })))
})
```

## 注意事项

1. **初始化**: 搜索服务会自动初始化，无需手动调用
2. **错误处理**: 所有搜索方法都包含完整的错误处理
3. **性能**: 缓存机制大大提升了重复搜索的性能
4. **兼容性**: 完全向后兼容现有的API接口

## 故障排除

### 常见问题

**Q: 搜索结果为空？**
A: 检查搜索关键词是否过短（<2字符），或者降低minScore设置。

**Q: 搜索速度慢？**
A: 尝试使用'fast'模式，或者减少搜索字段数量。

**Q: 结果不准确？**
A: 使用'accurate'模式，并调整minScore参数。

**Q: 内存使用过高？**
A: 定期调用clearCache()清理搜索缓存。
