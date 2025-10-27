# 通用书签筛选组件 🔍

这是一个完全封装的、可复用的书签筛选系统，提供统一的筛选逻辑和灵活的UI选择。

## 🎯 功能特性

- ✅ **统一筛选逻辑**: 一处编写，到处使用
- ✅ **防抖筛选**: 自动防抖优化，避免频繁请求
- ✅ **多种预设配置**: 不同场景的预设配置
- ✅ **TypeScript支持**: 完整的类型安全
- ✅ **错误处理**: 内置错误处理和状态管理
- ✅ **性能优化**: 智能缓存和结果限制

## 🚀 快速开始

### 方式一：使用Composable（推荐）

```typescript
import { createBookmarkSearchPresets } from '../composables/useBookmarkSearch'

// 在组件中使用
const searchPresets = createBookmarkSearchPresets()
const {
  searchQuery,
  searchResults,
  isSearching,
  error,
  handleSearchInput,
  clearSearch
} = searchPresets.quickSearch(bookmarkTree.value)

// 在模板中使用
<Input
  v-model="searchQuery"
  placeholder="筛选书签..."
  @input="handleSearchInput"
/>
```

### 方式二：使用现成的UI组件

```vue
<template>
  <BookmarkSearchBox
    :bookmark-tree="bookmarkTree"
    placeholder="筛选书签..."
    show-path
    @result-click="handleResultClick"
  />
</template>

<script setup>
import BookmarkSearchBox from '../components/BookmarkSearchBox.vue'

const handleResultClick = result => {
  // 处理筛选结果点击
  console.log('点击了:', result.title)
}
</script>
```

## 🎨 预设配置

系统提供了多种预设配置，适合不同的使用场景：

### 1. quickSearch - 快速筛选

适用于下拉框、快速选择等场景

- 防抖: 150ms
- 结果限制: 10个
- 自动筛选: 开启

```typescript
const search = searchPresets.quickSearch(bookmarkTree)
```

### 2. detailSearch - 详细筛选

适用于筛选页面等需要更多结果的场景

- 防抖: 300ms
- 结果限制: 100个
- 自动筛选: 开启

```typescript
const search = searchPresets.detailSearch(bookmarkTree)
```

### 3. managementSearch - 管理页面筛选

适用于管理页面的筛选需求

- 防抖: 200ms
- 结果限制: 50个
- 支持目录展开关联

```typescript
const search = searchPresets.managementSearch(bookmarkTree)
```

### 4. sidebarSearch - 侧边栏筛选

适用于侧边栏导航场景

- 防抖: 200ms
- 结果限制: 20个
- 优化显示效果

```typescript
const search = searchPresets.sidebarSearch(bookmarkTree)
```

## ⚙️ 自定义配置

如果预设配置不满足需求，可以完全自定义：

```typescript
import { useBookmarkSearch } from '../composables/useBookmarkSearch'

const customSearch = useBookmarkSearch({
  debounceDelay: 500, // 防抖延迟
  limit: 30, // 结果限制
  autoSearch: false, // 手动筛选
  bookmarkTree, // 书签数据源
  resultFilter: results => {
    // 自定义结果过滤
    return results.filter(r => r.url?.includes('github.com'))
  },
  onError: error => {
    // 自定义错误处理
    console.error('筛选出错:', error)
  }
})
```

## 📋 API 参考

### useBookmarkSearch 返回值

```typescript
{
  // 响应式状态
  searchQuery: Ref<string>           // 筛选查询字符串
  searchResults: Ref<Result[]>       // 筛选结果列表
  isSearching: Ref<boolean>          // 是否正在筛选
  error: Ref<string | null>          // 错误信息
  stats: Ref<SearchStats>            // 筛选统计

  // 方法
  handleSearchInput: (query: string) => void    // 处理筛选输入
  performSearch: (query?: string) => Promise<Result[]>  // 执行筛选
  searchImmediate: (query?: string) => Promise<Result[]> // 立即筛选
  clearSearch: () => void            // 清除筛选

  // 工具方法
  hasResults: () => boolean          // 是否有结果
  isEmpty: () => boolean             // 筛选框是否为空
  hasError: () => boolean            // 是否有错误
  getResultById: (id: string) => Result | undefined     // 根据ID获取结果
}
```

### BookmarkSearchBox Props

```typescript
{
  // 筛选配置
  bookmarkTree?: BookmarkNode[]      // 书签树数据
  searchOptions?: SearchOptions      // 筛选选项

  // 输入框属性
  placeholder?: string               // 占位符
  variant?: 'outlined' | 'filled'    // 输入框样式
  density?: 'compact' | 'comfortable' // 密度

  // 显示选项
  showDropdown?: boolean             // 显示下拉框
  showStats?: boolean                // 显示统计信息
  showPath?: boolean                 // 显示路径
  showUrl?: boolean                  // 显示URL
  maxDisplayResults?: number         // 最大显示结果数

  // 样式
  class?: string                     // 自定义样式类
  dropdownClass?: string             // 下拉框样式类
}
```

## 🔧 实际使用示例

### Management页面示例

```typescript
// 1. 导入
import { createBookmarkSearchPresets } from '../composables/useBookmarkSearch'

// 2. 创建筛选实例
const searchPresets = createBookmarkSearchPresets()
const { searchQuery, searchResults, handleSearchInput, clearSearch } =
  searchPresets.managementSearch(originalTree.value)

// 3. 处理筛选结果点击
const handleSearchResultClick = async result => {
  // 打开书签
  if (result.url) {
    chrome.tabs.create({ url: result.url })
  }

  // 展开相关文件夹
  if (result.path?.length > 0) {
    result.path.forEach(pathItem => {
      const folderId = findFolderIdByTitle(pathItem, originalTree.value)
      if (folderId) {
        expandedFolders.value.add(folderId)
      }
    })
    clearSearch() // 清除筛选，显示展开的目录
  }
}
```

### SidePanel页面示例

```typescript
// 使用预设配置，简化代码
const searchPresets = createBookmarkSearchPresets()
const { searchQuery, searchResults, isSearching } = searchPresets.sidebarSearch(
  bookmarkTree.value
)

// 模板中的v-model会自动触发筛选
// <Input v-model="searchQuery" placeholder="筛选..." />
```

## 🎉 优势对比

### 使用通用筛选前

```typescript
// ❌ 每个页面都要重复实现
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
let searchTimeout = null

const handleSearch = async () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    // 重复的筛选逻辑...
  }, 200)
}
```

### 使用通用筛选后

```typescript
// ✅ 一行代码搞定
const search = searchPresets.quickSearch(bookmarkTree)
```

## 📈 性能优化

- **防抖筛选**: 避免频繁的筛选请求
- **结果限制**: 控制渲染的结果数量
- **内存筛选**: 优先使用已加载的数据
- **自动清理**: 组件卸载时自动清理定时器
- **错误处理**: 内置错误恢复机制

现在所有页面的筛选功能都统一了，维护更简单，代码更优雅！🚀
