# LLM 模块使用指南

## 概述

LLM 模块提供了统一的 AI 功能接口，支持：

- Chrome 内置 LLM（免费、本地处理）
- Cloudflare Workers AI（后端降级方案）

## 架构

```
AIAppService (应用层)
    ↓
LLMAdapter (适配器层)
    ↓
┌─────────────────┬─────────────────┐
│ BuiltInLLMClient│ BackendLLMClient│
│ (Chrome 内置)    │ (Cloudflare)    │
└─────────────────┴─────────────────┘
```

## 快速开始

### 1. 书签分类

```typescript
import { aiAppService } from '@/application/ai/ai-app-service'

// 分类单个书签
const result = await aiAppService.categorizeBookmark({
  title: 'React Hooks 指南',
  url: 'https://react.dev/hooks',
  description: 'React Hooks 的完整指南'
})

console.log(result.category) // '技术'
console.log(result.provider) // 'builtin' 或 'cloudflare'
```

### 2. 生成书签摘要

```typescript
const summary = await aiAppService.summarizeBookmark({
  title: 'React Hooks 指南',
  url: 'https://react.dev/hooks',
  content: 'React Hooks 是 React 16.8 引入的新特性...'
})

console.log(summary.summary) // 'React Hooks 是 React 16.8...'
```

### 3. 一键整理书签

```typescript
const bookmarks = [
  { id: '1', title: 'React 文档', url: 'https://react.dev' },
  { id: '2', title: 'Vue 文档', url: 'https://vuejs.org' },
  { id: '3', title: '设计系统', url: 'https://designsystem.com' }
]

const results = await aiAppService.organizeBookmarks(bookmarks)

results.forEach(result => {
  console.log(`${result.id}: ${result.category} -> ${result.suggestedFolder}`)
})
```

### 4. 语义搜索增强

```typescript
const enhanced = await aiAppService.enhanceSemanticSearch('react hooks')

console.log(enhanced.keywords) // ['react', 'hooks']
console.log(enhanced.concepts) // ['React Hooks', '函数组件']
console.log(enhanced.synonyms) // ['useState', 'useEffect']
```

### 5. 生成标签

```typescript
const tags = await aiAppService.generateTags({
  title: 'React Hooks 指南',
  url: 'https://react.dev/hooks',
  content: '...'
})

console.log(tags) // ['React', 'Hook', 'JavaScript']
```

## 高级用法

### 检测可用 LLM 提供者

```typescript
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'

const capabilities = await llmAdapter.detectCapabilities()

capabilities.forEach(cap => {
  console.log(`${cap.provider}: ${cap.available ? '可用' : '不可用'}`)
  if (!cap.available) {
    console.log(`原因: ${cap.reason}`)
  }
})
```

### 手动选择 LLM 提供者

```typescript
// 强制使用内置 LLM
llmAdapter.setStrategy('builtin')

// 强制使用后端
llmAdapter.setStrategy('backend')

// 自动选择（默认）
llmAdapter.setStrategy('auto')
```

### 获取 Chrome 内置 LLM 启用指南

```typescript
const guide = aiAppService.getBuiltInLLMGuide()

console.log(guide.title)
console.log(guide.steps)
console.log(guide.requirements)
```

## 使用场景

### 场景 1: 添加书签时自动分类

```typescript
// 在书签创建后
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (bookmark.url) {
    const category = await aiAppService.categorizeBookmark({
      title: bookmark.title,
      url: bookmark.url
    })

    // 将书签移动到对应文件夹
    await chrome.bookmarks.move(id, {
      parentId: category.category
    })
  }
})
```

### 场景 2: 批量整理书签栏

```typescript
// 在用户点击"一键整理"按钮时
async function organizeBookmarkBar() {
  const bookmarkBar = await chrome.bookmarks.getTree()
  const bookmarks = extractBookmarks(bookmarkBar[0])

  const results = await aiAppService.organizeBookmarks(bookmarks)

  // 应用整理结果
  for (const result of results) {
    await chrome.bookmarks.move(result.id, {
      parentId: getOrCreateFolder(result.suggestedFolder)
    })
  }
}
```

### 场景 3: 增强搜索功能

```typescript
// 在用户输入搜索查询时
async function enhancedSearch(query: string) {
  const enhanced = await aiAppService.enhanceSemanticSearch(query)

  // 使用增强的关键词进行搜索
  const results = await queryAppService.search(enhanced.keywords.join(' '))

  return results
}
```

## 注意事项

1. **Chrome 内置 LLM 需要手动启用**
   - 需要 Chrome 127+ 版本
   - 需要在 `chrome://flags` 中启用相关功能
   - 需要下载约 22GB 的模型文件

2. **自动降级**
   - 如果内置 LLM 不可用，会自动降级到后端
   - 如果后端也失败，会抛出错误

3. **性能考虑**
   - 内置 LLM：本地处理，无网络延迟
   - 后端 LLM：需要网络请求，可能有延迟

4. **成本考虑**
   - 内置 LLM：完全免费
   - 后端 LLM：需要消耗 Cloudflare Workers AI 配额

## 错误处理

```typescript
try {
  const result = await aiAppService.categorizeBookmark(bookmark)
} catch (error) {
  if (error.message.includes('内置 LLM')) {
    // 内置 LLM 不可用，提示用户启用
    showEnableGuide()
  } else {
    // 其他错误
    console.error('分类失败:', error)
  }
}
```
