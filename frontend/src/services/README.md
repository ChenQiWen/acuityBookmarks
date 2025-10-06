# 统一应用服务与核心能力

## 概述

本目录文档介绍前端应用层服务如何统一调用核心能力（Diff 引擎、执行器、搜索）。
你应优先通过 Application Services 调用，而不是直接引用 utils。

包含三大部分：
- 搜索：`searchAppService`
- 书签变更计划与执行：`bookmarkChangeAppService`（内部使用 core/diff-engine 与 core/executor）
- 设置与健康状态：`settingsAppService`、`healthAppService`

## 书签搜索服务（统一入口）

统一入口只有两个层级：

- 应用层服务：`searchAppService.search(query, { strategy: 'fuse' | 'hybrid', limit })`
- 组合式封装：`useBookmarkSearch` 与 `createBookmarkSearchPresets`（内部调用上面的应用层服务）

说明：原 `services/hybrid-search-engine.ts` 与 `services/fuse-search.ts` 已移除/弃用，请勿再引用。

### 主要特性

### 🚀 **搜索策略**
- `fuse`: 本地模糊搜索（默认）
- `hybrid`: 原生 `chrome.bookmarks.search` 与 Fuse 结果合并（深度模式）

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

### 1) 搜索（通过应用层，推荐）

```typescript
import { searchAppService } from '@/application/search/search-app-service'

// 搜索页面
const searchResults = await searchAppService.search('react hooks', { strategy: 'fuse', limit: 50 })

// 弹窗页面 - 快速搜索模式（由调用方决定 limit 等参数）
const popupResults = await searchAppService.search('vue components', { strategy: 'fuse', limit: 50 })

// 侧边栏 - 推荐统一走 searchAppService
const sideResults = await searchAppService.search('typescript', { strategy: 'fuse', limit: 50 })

### 2) 通过 Composable（页面集成更简洁）

```ts
import { createBookmarkSearchPresets } from '@/composables/useBookmarkSearch'

const presets = createBookmarkSearchPresets()
const search = presets.managementSearch()
search.searchImmediate('react') // deep -> 自动走 hybrid
```
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

### 选项（统一入口）

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `strategy` | `'fuse' \| 'hybrid'` | `'fuse'` | 搜索策略 |
| `limit` | `number` | `100` | 结果数量上限 |

### 搜索结果格式

返回类型沿用 IndexedDB 管道的 `SearchResult[]`：

```ts
interface SearchResult {
  bookmark: BookmarkRecord
  score: number
  matchedFields: string[]
  highlights: Record<string, string[]>
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
// 如需手动缓存控制，可由页面层自行管理；searchAppService 默认无需手动清缓存。

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

## 命名规范与职责边界（重要）

为避免“smart/unified/lightweight/modern”混用导致的困惑，现行规范如下：

- API 门面：`utils/unified-bookmark-api.ts`
  - 定位：对外统一通信与 IndexedDB 回退门面，不承载搜索/差异/执行实现
  - 页面若需要搜索/执行等能力，优先调用应用层服务（如 `searchAppService`、`bookmarkChangeAppService`）

- 搜索：`application/search/search-app-service.ts`
  - 策略：`'fuse' | 'hybrid'`
  - 组合式封装：`composables/useBookmarkSearch.ts`

- 书签变更（Plan & Execute）：
  - Diff 引擎：`core/bookmark/services/diff-engine.ts`
  - 执行器：`core/bookmark/services/executor.ts`
  - 应用层封装：`application/bookmark/bookmark-change-app-service.ts`

- 轻量内容增强：`services/lightweight-bookmark-enhancer.ts`
  - 定位：低成本抓取标题/描述/基础 meta 与本地缓存

- 现代化书签服务：`services/modern-bookmark-service.ts`
  - 定位：原生事件/特性桥接，统一代理到应用层服务（如搜索）

> 历史兼容：`utils/smart-bookmark-diff-engine.ts`、`utils/smart-bookmark-executor.ts` 已移除；请改用上面的 core 路径。

## 迁移对照表（从旧名到规范名）

| 旧文件/概念 | 现行/规范位置 |
| --- | --- |
| `services/hybrid-search-engine.ts` | `application/search/search-app-service.ts`（策略统一） |
| `services/fuse-search.ts` | `core/search/strategies/fuse-strategy.ts`（由应用层封装调度） |
| `utils/smart-bookmark-diff-engine.ts` | `core/bookmark/services/diff-engine.ts` |
| `utils/smart-bookmark-executor.ts` | `core/bookmark/services/executor.ts` |
| `unified-*.ts`（API 门面） | `utils/unified-bookmark-api.ts`（职责收敛为通信与回退） |

> 如需进一步统一命名为 `bookmark-api.ts` 等，将在后续版本按低风险路径进行重命名并提供 codemod。

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
  const results = await searchAppService.search(text, { strategy: 'fuse', limit: 5 })
  
  suggest(results.map(r => ({
    content: r.url,
    description: `📖 ${r.title} - ${r.domain}`
  })))
})
```

## 注意事项

1. 初始化：应用层服务负责数据初始化与降级处理，无需手动干预
2. 错误处理：应用层服务包含完整错误处理，Composable 可通过 onError 覆盖
3. 性能：Hybrid 会自动合并去重并排序，limit 控制返回量
4. 兼容性：旧的 hybrid/fuse 服务已弃用，请迁移到 `searchAppService` 或 `useBookmarkSearch`

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
