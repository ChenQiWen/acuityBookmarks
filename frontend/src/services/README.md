# 统一书签搜索服务

## 概述

`BookmarkSearchService` 是一个统一的本地书签搜索引擎，整合了项目中所有的搜索功能，提供高效、一致的书签检索体验。

## 主要特性

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

### 1. 直接使用搜索服务

```typescript
import { getHybridSearchEngine } from '../services/hybrid-search-engine'

// 简单搜索
const { results, stats } = await bookmarkSearchService.search('vue')

// 高级搜索
const { results, stats } = await bookmarkSearchService.search('javascript', {
  mode: 'accurate',
  fields: ['title', 'url', 'keywords'],
  limit: 20,
  minScore: 10,
  enableHighlight: true,
  sortBy: 'relevance'
})

logger.info('SearchService', `找到 ${results.length} 个结果，耗时 ${stats.duration}ms`)
```

### 2. 通过统一API使用

```typescript
import { searchPopupAPI, popupAPI, sidePanelAPI } from '../utils/unified-bookmark-api'

// 搜索页面 - 精确搜索模式
const searchResults = await searchPopupAPI.searchBookmarks('react hooks')

// 弹窗页面 - 快速搜索模式
const popupResults = await popupAPI.searchBookmarks('vue components')

// 侧边栏 - 支持内存搜索
const sideResults = await sidePanelAPI.searchBookmarks('typescript', bookmarkTree)
```

## 各页面专用配置

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

## 性能监控

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

## 迁移指南

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

3. **使用专用API**:
   ```typescript
   // 推荐使用页面专用API，而不是直接调用搜索服务
   import { searchPopupAPI } from '../utils/unified-bookmark-api'
   const results = await searchPopupAPI.searchBookmarks(query)
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
