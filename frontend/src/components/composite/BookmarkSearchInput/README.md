# BookmarkSearchInput

## 📝 组件说明

书签搜索输入组件 - 只负责搜索逻辑，不负责结果展示。

### 🎯 设计理念

遵循**单一职责原则**：

- ✅ 提供搜索输入框
- ✅ 调用核心书签检索服务
- ✅ 返回标准书签树结构数据
- ❌ 不负责展示结果（由父组件决定）

### 📊 数据流

```
用户输入 → 防抖 → 搜索服务 → emit('search-complete', results)
                                ↓
                          父组件接收结果
                                ↓
                    决定如何展示（Tree / List / Grid）
```

## 🚀 基础用法

### 从 IndexedDB 搜索（默认）

```vue
<template>
  <div>
    <BookmarkSearchInput @search-complete="handleResults" />

    <!-- 父组件决定如何展示结果 -->
    <BookmarkTree :nodes="results" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const results = ref([])

const handleResults = searchResults => {
  results.value = searchResults
  console.log('找到书签:', searchResults.length)
}
</script>
```

### 从内存数据搜索

```vue
<template>
  <BookmarkSearchInput
    mode="memory"
    :data="myBookmarks"
    @search-complete="handleResults"
  />
</template>

<script setup>
const myBookmarks = ref([...])
</script>
```

## 📖 API

### Props

| 属性           | 类型                      | 默认值        | 说明                               |
| -------------- | ------------------------- | ------------- | ---------------------------------- |
| `mode`         | `'indexeddb' \| 'memory'` | `'indexeddb'` | 搜索模式                           |
| `data`         | `BookmarkNode[]`          | -             | 内存数据源（mode='memory' 时使用） |
| `limit`        | `number`                  | `100`         | 搜索结果数量限制                   |
| `debounce`     | `number`                  | `300`         | 防抖延迟（毫秒）                   |
| `disabled`     | `boolean`                 | `false`       | 是否禁用                           |
| `showStats`    | `boolean`                 | `true`        | 是否显示统计信息                   |
| `initialQuery` | `string`                  | `''`          | 初始搜索关键词                     |

### Events

| 事件              | 参数                        | 说明     |
| ----------------- | --------------------------- | -------- |
| `search-complete` | `(results: BookmarkNode[])` | 搜索完成 |
| `search-start`    | `(query: string)`           | 搜索开始 |
| `search-error`    | `(error: Error)`            | 搜索错误 |
| `search-clear`    | `()`                        | 搜索清空 |

### Expose Methods

| 方法           | 参数              | 返回值           | 说明             |
| -------------- | ----------------- | ---------------- | ---------------- |
| `search`       | `(query: string)` | `Promise<void>`  | 手动触发搜索     |
| `getResults`   | -                 | `BookmarkNode[]` | 获取当前搜索结果 |
| `clear`        | -                 | `void`           | 清空搜索         |
| `isSearching`  | -                 | `Ref<boolean>`   | 是否正在搜索     |
| `totalResults` | -                 | `Ref<number>`    | 总结果数         |

## 💡 使用场景

### 场景 1：搜索 + 树形展示

```vue
<template>
  <BookmarkSearchInput @search-complete="results = $event" />
  <BookmarkTree :nodes="results" />
</template>
```

### 场景 2：搜索 + 列表展示

```vue
<template>
  <BookmarkSearchInput @search-complete="results = $event" />
  <BookmarkList :items="results" />
</template>
```

### 场景 3：搜索 + 自定义展示

```vue
<template>
  <BookmarkSearchInput @search-complete="handleResults" />

  <div v-for="bookmark in filteredResults" :key="bookmark.id">
    {{ bookmark.title }}
  </div>
</template>

<script setup>
const filteredResults = computed(() => {
  // 自定义过滤逻辑
  return results.value.filter(...)
})
</script>
```

### 场景 4：手动控制搜索

```vue
<template>
  <BookmarkSearchInput ref="searchRef" />
  <Button @click="triggerSearch">搜索</Button>
</template>

<script setup>
const searchRef = ref()

const triggerSearch = async () => {
  await searchRef.value?.search('React')
  const results = searchRef.value?.getResults()
  console.log(results)
}
</script>
```

## 🎨 样式定制

组件提供了 CSS 变量支持：

```css
.bookmark-search-input {
  --search-input-bg: var(--color-surface);
  --search-input-border: var(--color-border);
  --search-input-focus-border: var(--color-primary);
}
```

## ⚠️ 注意事项

1. **职责单一**：此组件只负责搜索，不负责展示结果
2. **数据源灵活**：默认 IndexedDB，可传入内存数据
3. **标准输出**：返回标准 `BookmarkNode[]` 格式
4. **防抖优化**：自动防抖，避免频繁搜索
5. **父组件决定展示**：由父组件自由选择如何展示结果

## 📦 相关组件

- `BookmarkTree` - 树形展示搜索结果
- `useBookmarkSearch` - 底层搜索 Composable
- `QueryAppService` - 核心搜索服务
