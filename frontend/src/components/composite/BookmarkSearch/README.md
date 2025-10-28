# BookmarkSearch 组件

书签搜索组件 - `searchAppService` 的 UI 层体现。

## 📖 重要概念

### 为什么叫"搜索"而非"搜索"？

在本项目中：

- ✅ **所有数据都在本地 IndexedDB**（2万+ 书签）
- ✅ **不存在网络请求**
- ✅ **从已有集合中过滤符合条件的书签**

这是**搜索（Filter）**的定义，而非"搜索（Search）"。

### 核心特性

- ✅ **服务聚合**：封装 `searchAppService` 所有能力
- ✅ **自动转换**：将搜索结果自动转换为 `BookmarkNode[]` 格式
- ✅ **即插即用**：直接使用 `BookmarkTree` 显示结果
- ✅ **完整状态**：加载、空状态、无结果状态
- ✅ **高亮支持**：自动高亮匹配关键词
- ✅ **性能监控**：显示搜索耗时和结果统计

---

## 🚀 基础使用

### 最简单的用法

```vue
<template>
  <BookmarkSearch :query="filterQuery" />
</template>

<script setup>
import { ref } from 'vue'
import { BookmarkSearch } from '@/components'

const filterQuery = ref('React')
</script>
```

---

## 📋 Props

| 参数            | 类型                                       | 默认值          | 说明                             |
| --------------- | ------------------------------------------ | --------------- | -------------------------------- |
| `query`         | `string`                                   | **必需**        | 搜索条件（关键字）               |
| `limit`         | `number`                                   | `100`           | 搜索结果数量限制                 |
| `showStats`     | `boolean`                                  | `true`          | 是否显示统计信息                 |
| `treeHeight`    | `string \| number`                         | `'100%'`        | 树的高度                         |
| `treeSize`      | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | 树的尺寸                         |
| `selectable`    | `boolean \| 'single' \| 'multiple'`        | `false`         | 是否可选择                       |
| `editable`      | `boolean`                                  | `false`         | 是否可编辑                       |
| `virtual`       | `boolean`                                  | `true`          | 是否启用虚拟滚动                 |
| `showToolbar`   | `boolean`                                  | `false`         | 是否显示工具栏                   |
| `treeProps`     | `Record<string, unknown>`                  | `{}`            | 传递给 BookmarkTree 的额外 props |
| `filterOptions` | `BookmarkSearchOptions`                    | `{}`            | 搜索选项                         |

### FilterOptions 详细说明

```typescript
interface BookmarkSearchOptions {
  fuzzy?: boolean // 是否启用模糊匹配
  threshold?: number // 匹配阈值 (0-1)
  sortBy?: 'relevance' | 'title' | 'date'
  filterFolders?: boolean // 是否过滤文件夹
}
```

---

## 🎯 Events

| 事件名             | 参数                                                  | 说明     |
| ------------------ | ----------------------------------------------------- | -------- |
| `filter-complete`  | `(results: EnhancedSearchResult[])`                   | 搜索完成 |
| `filter-error`     | `(error: Error)`                                      | 搜索错误 |
| `node-click`       | `(node: BookmarkNode, event: MouseEvent)`             | 节点点击 |
| `node-select`      | `(id: string, node: BookmarkNode, selected: boolean)` | 节点选择 |
| `selection-change` | `(ids: string[], nodes: BookmarkNode[])`              | 选择变更 |

---

## 💡 使用示例

### 1. 基础搜索

```vue
<template>
  <div class="filter-container">
    <Input v-model="query" placeholder="搜索书签..." />
    <BookmarkSearch :query="query" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { BookmarkSearch, Input } from '@/components'

const query = ref('')
</script>
```

### 2. 高级配置

```vue
<template>
  <BookmarkSearch
    :query="query"
    :limit="50"
    :show-stats="true"
    tree-height="600px"
    tree-size="compact"
    :virtual="true"
    :filter-options="{
      fuzzy: true,
      threshold: 0.6,
      sortBy: 'relevance',
      filterFolders: true
    }"
    @filter-complete="handleFilterComplete"
    @node-click="handleNodeClick"
  />
</template>

<script setup>
import { ref } from 'vue'
import { BookmarkSearch } from '@/components'
import type { EnhancedSearchResult, BookmarkNode } from '@/types'

const query = ref('Vue.js')

function handleFilterComplete(results: EnhancedSearchResult[]) {
  console.log(`找到 ${results.length} 个结果`)
}

function handleNodeClick(node: BookmarkNode, event: MouseEvent) {
  console.log('点击书签:', node.title)
  if (node.url) {
    window.open(node.url, '_blank')
  }
}
</script>
```

### 3. 多选模式

```vue
<template>
  <BookmarkSearch
    :query="query"
    selectable="multiple"
    :show-toolbar="true"
    @selection-change="handleSelectionChange"
  />
</template>

<script setup>
import { ref } from 'vue'
import { BookmarkSearch } from '@/components'
import type { BookmarkNode } from '@/types'

const query = ref('JavaScript')
const selectedNodes = ref<BookmarkNode[]>([])

function handleSelectionChange(ids: string[], nodes: BookmarkNode[]) {
  selectedNodes.value = nodes
  console.log(`已选中 ${nodes.length} 个书签`)
}
</script>
```

### 4. 使用 Ref 调用方法

```vue
<template>
  <div>
    <Button @click="triggerFilter">搜索</Button>
    <Button @click="getResults">获取结果</Button>

    <BookmarkSearch ref="filterRef" :query="query" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { BookmarkSearch, Button } from '@/components'
import type { BookmarkSearchExpose } from '@/components/composite/BookmarkSearch/BookmarkSearch.d'

const filterRef = ref<BookmarkSearchExpose | null>(null)
const query = ref('React')

async function triggerFilter() {
  await filterRef.value?.filter('Vue')
}

function getResults() {
  const results = filterRef.value?.getResults()
  const nodes = filterRef.value?.getNodes()
  console.log('原始结果:', results)
  console.log('转换后的节点:', nodes)
}
</script>
```

---

## 🧩 配合 Composable 使用

如果需要更灵活的控制，可以使用 `useBookmarkSearch` composable：

```vue
<template>
  <div>
    <Input v-model="query" placeholder="搜索..." />

    <div v-if="isFiltering">搜索中...</div>
    <div v-else-if="error">{{ error.message }}</div>
    <div v-else>
      找到 {{ totalResults }} 个结果 ({{ executionTime }}ms)

      <BookmarkTree :nodes="bookmarkNodes" />
    </div>
  </div>
</template>

<script setup>
import { useBookmarkSearch } from '@/composables/useBookmarkSearch'
import { BookmarkTree, Input } from '@/components'

const {
  query,
  bookmarkNodes,
  isFiltering,
  error,
  totalResults,
  executionTime
} = useBookmarkSearch({
  limit: 50,
  autoFilter: true
})
</script>
```

---

## 🏗️ 架构设计

```
用户输入搜索条件 (query)
    ↓
BookmarkSearch 组件
    ↓
searchAppService.searchWithMetadata()
    ↓
从本地 IndexedDB 搜索书签
    ↓
返回 EnhancedSearchResult[]
    ↓
转换为 BookmarkNode[]
    ↓
BookmarkTree 显示
```

---

## 🎨 样式定制

组件提供了基础样式，可以通过 CSS 变量或覆盖类名来定制：

```css
.bookmark-search {
  /* 自定义样式 */
}

.filter-stats {
  /* 统计信息样式 */
}

.filter-loading {
  /* 加载状态样式 */
}

.filter-empty,
.filter-no-results {
  /* 空状态样式 */
}
```

---

## ⚠️ 注意事项

1. **性能优化**
   - 组件默认启用虚拟滚动（`virtual: true`）
   - 大量结果时建议限制 `limit` 值
   - 使用 `debounce` 处理输入防抖

2. **数据格式**
   - 组件自动将 `EnhancedSearchResult` 转换为 `BookmarkNode`
   - 转换后的节点包含额外的搜索信息（`filterScore`、`pathString`、`matchedFields`）

3. **事件处理**
   - `node-click` 事件不会自动打开链接，需要手动处理
   - `selection-change` 在多选模式下触发

4. **术语规范**
   - 对外（UI、API）：**搜索（Filter）**
   - 对内（实现）：search/filter 都可以（技术术语）

---

## 📚 相关文档

- [BookmarkTree 组件](../BookmarkTree/README.md)
- [searchAppService 文档](../../../application/search/README.md)
- [useBookmarkSearch Composable](../../../composables/useBookmarkSearch.ts)

---

## 🔧 故障排查

### 搜索无结果

1. 检查 IndexedDB 是否已初始化
2. 确认书签数据已同步
3. 检查搜索条件是否正确

### 性能问题

1. 减少 `limit` 值
2. 启用虚拟滚动 `virtual: true`
3. 使用 `debounce` 处理输入

### 样式问题

1. 检查 `treeHeight` 是否设置
2. 确认父容器有固定高度
3. 检查 CSS 变量是否正确

---

**最后更新**: 2025-10-27
