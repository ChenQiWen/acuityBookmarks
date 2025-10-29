# BookmarkSearchInput 使用示例

## 📚 完整使用案例

### 案例 1：侧边栏搜索 (Side Panel)

```vue
<template>
  <div class="side-panel">
    <!-- ✅ 搜索输入：只需监听 @search-complete 事件 -->
    <BookmarkSearchInput
      @search-complete="handleSearchResults"
      :show-stats="true"
    />

    <!-- 展示区域 -->
    <div v-if="showResults" class="search-results">
      <BookmarkTree
        :nodes="searchResults"
        :height="'calc(100vh - 200px)'"
        :virtual="true"
        :highlight-matches="true"
        @node-click="handleBookmarkClick"
      />
    </div>

    <!-- 默认视图 -->
    <div v-else class="default-view">
      <BookmarkRecommendations />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BookmarkSearchInput, BookmarkTree } from '@/components'

const searchResults = ref([])
const showResults = ref(false)

// ✅ 统一处理搜索结果和清空操作
// 清空时会收到空数组 []
const handleSearchResults = results => {
  searchResults.value = results
  showResults.value = results.length > 0
}

const handleBookmarkClick = node => {
  if (node.url) {
    window.open(node.url, '_blank')
  }
}
</script>
```

### 案例 2：管理页面搜索 (Management)

```vue
<template>
  <div class="management-search">
    <BookmarkSearchInput
      ref="searchRef"
      mode="memory"
      :data="allBookmarks"
      :limit="500"
      @search-complete="handleSearch"
    />

    <!-- 搜索结果 -->
    <div v-if="filteredBookmarks.length > 0" class="results">
      <div class="results-header">
        <h3>搜索结果 ({{ filteredBookmarks.length }})</h3>
        <Button @click="exportResults">导出</Button>
      </div>

      <BookmarkTree
        :nodes="filteredBookmarks"
        :selectable="'multiple'"
        :editable="true"
        @selection-change="handleSelectionChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBookmarkStore } from '@/stores'

const bookmarkStore = useBookmarkStore()
const searchRef = ref()
const filteredBookmarks = ref([])
const selectedBookmarks = ref([])

// 从 store 获取所有书签
const allBookmarks = computed(() => bookmarkStore.allBookmarks)

const handleSearch = results => {
  filteredBookmarks.value = results
}

const handleSelectionChange = selected => {
  selectedBookmarks.value = selected
}

const exportResults = () => {
  // 导出逻辑
  console.log('导出书签:', filteredBookmarks.value)
}
</script>
```

### 案例 3：Popup 快速搜索

```vue
<template>
  <div class="popup-search">
    <BookmarkSearchInput
      :debounce="150"
      :limit="10"
      @search-complete="handleQuickSearch"
      @search-start="showLoading = true"
    />

    <div v-if="showLoading" class="loading">
      <Spinner size="sm" />
    </div>

    <div v-else-if="quickResults.length > 0" class="quick-results">
      <div
        v-for="bookmark in quickResults"
        :key="bookmark.id"
        class="quick-item"
        @click="openBookmark(bookmark)"
      >
        <Icon :name="bookmark.url ? 'icon-web' : 'icon-folder'" />
        <span class="title">{{ bookmark.title }}</span>
        <span v-if="bookmark.url" class="url">{{ bookmark.url }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const quickResults = ref([])
const showLoading = ref(false)

const handleQuickSearch = results => {
  quickResults.value = results.slice(0, 10) // 只显示前 10 个
  showLoading.value = false
}

const openBookmark = bookmark => {
  if (bookmark.url) {
    chrome.tabs.create({ url: bookmark.url })
    window.close() // 关闭 popup
  }
}
</script>
```

### 案例 4：高级搜索（自定义过滤）

```vue
<template>
  <div class="advanced-search">
    <BookmarkSearchInput ref="searchRef" @search-complete="handleRawResults" />

    <!-- 额外过滤选项 -->
    <div class="filters">
      <Checkbox v-model="onlyFavorites">只显示收藏</Checkbox>
      <Checkbox v-model="onlyRecent">最近添加</Checkbox>
      <Select v-model="sortBy" :options="sortOptions" />
    </div>

    <!-- 过滤后的结果 -->
    <BookmarkTree :nodes="processedResults" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const searchRef = ref()
const rawResults = ref([])
const onlyFavorites = ref(false)
const onlyRecent = ref(false)
const sortBy = ref('title')

const handleRawResults = results => {
  rawResults.value = results
}

const processedResults = computed(() => {
  let results = [...rawResults.value]

  // 过滤收藏
  if (onlyFavorites.value) {
    results = results.filter(b => b.isFavorite)
  }

  // 过滤最近添加（7天内）
  if (onlyRecent.value) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    results = results.filter(b => b.dateAdded > sevenDaysAgo)
  }

  // 排序
  if (sortBy.value === 'title') {
    results.sort((a, b) => a.title.localeCompare(b.title))
  } else if (sortBy.value === 'date') {
    results.sort((a, b) => b.dateAdded - a.dateAdded)
  }

  return results
})
</script>
```

### 案例 5：搜索历史记录

```vue
<template>
  <div class="search-with-history">
    <BookmarkSearchInput
      ref="searchRef"
      @search-start="addToHistory"
      @search-complete="handleSearch"
    />

    <!-- 搜索历史 -->
    <div v-if="searchHistory.length > 0" class="history">
      <h4>最近搜索</h4>
      <div
        v-for="(item, index) in searchHistory"
        :key="index"
        class="history-item"
        @click="searchAgain(item)"
      >
        <Icon name="icon-history" />
        <span>{{ item }}</span>
      </div>
    </div>

    <BookmarkTree :nodes="results" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const searchRef = ref()
const results = ref([])
const searchHistory = ref([])

const addToHistory = query => {
  if (!searchHistory.value.includes(query)) {
    searchHistory.value.unshift(query)
    searchHistory.value = searchHistory.value.slice(0, 5) // 只保留最近 5 个
  }
}

const handleSearch = searchResults => {
  results.value = searchResults
}

const searchAgain = query => {
  searchRef.value?.search(query)
}
</script>
```

### 案例 6：多数据源搜索

```vue
<template>
  <div class="multi-source-search">
    <!-- 数据源切换 -->
    <Tabs v-model="activeSource">
      <Tab value="all">全部书签</Tab>
      <Tab value="favorites">收藏夹</Tab>
      <Tab value="recent">最近添加</Tab>
    </Tabs>

    <!-- 搜索输入（根据数据源切换） -->
    <BookmarkSearchInput
      :key="activeSource"
      :mode="searchMode"
      :data="currentDataSource"
      @search-complete="results = $event"
    />

    <BookmarkTree :nodes="results" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBookmarkStore } from '@/stores'

const bookmarkStore = useBookmarkStore()
const activeSource = ref('all')
const results = ref([])

const searchMode = computed(() => {
  return activeSource.value === 'all' ? 'indexeddb' : 'memory'
})

const currentDataSource = computed(() => {
  switch (activeSource.value) {
    case 'favorites':
      return bookmarkStore.favorites
    case 'recent':
      return bookmarkStore.recentBookmarks
    default:
      return []
  }
})
</script>
```

## 🎯 关键要点

1. **职责单一**：组件只负责搜索，父组件决定如何展示
2. **灵活配置**：支持 IndexedDB 和内存两种数据源
3. **事件驱动**：通过事件传递结果，松耦合
4. **性能优化**：内置防抖、支持虚拟滚动
5. **可扩展**：父组件可以进一步过滤和处理结果

## 💡 设计哲学：为什么不需要 `@search-clear` 事件？

### ❌ 旧设计（冗余）

```vue
<BookmarkSearchInput
  @search-complete="handleSearch"
  @search-clear="handleClear"  <!-- 冗余！ -->
/>

<script setup>
const handleSearch = (results) => {
  searchResults.value = results
}

const handleClear = () => {
  searchResults.value = []  // 这不就是空数组吗？
}
</script>
```

### ✅ 新设计（简洁）

```vue
<BookmarkSearchInput
  @search-complete="handleSearch"  <!-- 统一处理！ -->
/>

<script setup>
const handleSearch = (results) => {
  searchResults.value = results
  // 当清空时，results 就是 []
  // 不需要单独的 handleClear 函数
}
</script>
```

### 核心原则

> **"清空"本质上就是"搜索结果为空"！**

- ✅ 组件内部统一：清空时 emit `search-complete([])`
- ✅ 父组件简化：只需一个事件处理器
- ✅ 逻辑集中：所有数据变化通过 `search-complete` 事件
- 🔔 `search-clear` 事件保留，但仅用于特殊场景（如关闭搜索框UI）

### 何时使用 `@search-clear`？

只在需要**额外 UI 操作**时使用：

```vue
<!-- 例如：清空时展开/收起树节点 -->
<BookmarkSearchInput
  @search-complete="handleSearch"
  @search-clear="collapseAllTreeNodes"  <!-- 额外的 UI 操作 -->
/>
```

但大多数情况下，这些操作可以在 `handleSearch` 中根据结果长度判断：

```vue
<script setup>
const handleSearch = async results => {
  searchResults.value = results

  if (results.length > 0) {
    // 有结果：展开树
    await nextTick()
    treeRef.value?.expandAll()
  } else {
    // 清空：收起树
    treeRef.value?.collapseAll()
  }
}
</script>
```

**结论**：95% 的场景只需要 `@search-complete` 事件！
