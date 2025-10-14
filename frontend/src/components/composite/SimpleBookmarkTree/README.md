# SimpleBookmarkTree 组件

简化版统一书签目录树组件，提供书签的树形展示和交互功能。

## 特性

- 🌳 树形结构展示书签
- 🔍 支持搜索功能
- 📱 响应式设计
- ⚡ 虚拟滚动支持
- 🎯 无障碍支持
- 🖱️ 丰富的交互事件

## Props

| 属性                | 类型               | 默认值  | 说明                 |
| ------------------- | ------------------ | ------- | -------------------- |
| `nodes`             | `BookmarkNode[]`   | `[]`    | 书签节点数据         |
| `searchable`        | `boolean`          | `true`  | 是否可搜索           |
| `virtualEnabled`    | `boolean`          | `false` | 是否启用虚拟滚动     |
| `height`            | `string \| number` | -       | 容器高度             |
| `strictChromeOrder` | `boolean`          | `true`  | 是否严格按Chrome顺序 |
| `highlightMatches`  | `boolean`          | `true`  | 高亮匹配项           |
| `treeConfig`        | `object`           | -       | 树配置选项           |

### treeConfig 配置

| 属性           | 类型      | 默认值  | 说明         |
| -------------- | --------- | ------- | ------------ |
| `showFavicons` | `boolean` | `true`  | 显示网站图标 |
| `showUrls`     | `boolean` | `false` | 显示URL      |
| `expandLevel`  | `number`  | `1`     | 默认展开层级 |
| `maxDepth`     | `number`  | -       | 最大深度限制 |

## Events

| 事件          | 参数                                      | 说明              |
| ------------- | ----------------------------------------- | ----------------- |
| `node-click`  | `(node: BookmarkNode, event: MouseEvent)` | 节点点击事件      |
| `node-select` | `(node: BookmarkNode)`                    | 节点选择事件      |
| `node-toggle` | `(node: BookmarkNode, expanded: boolean)` | 节点展开/折叠事件 |
| `search`      | `(query: string)`                         | 搜索事件          |
| `node-hover`  | `(node: BookmarkNode \| null)`            | 节点悬停事件      |

## 使用示例

### 基础用法

```vue
<template>
  <SimpleBookmarkTree :nodes="bookmarkNodes" @node-click="handleNodeClick" />
</template>

<script setup>
import { ref } from 'vue'
import { SimpleBookmarkTree } from '@/components'

const bookmarkNodes = ref([])

const handleNodeClick = (node, event) => {
  console.log('点击了节点:', node)
}
</script>
```

### 带搜索功能

```vue
<template>
  <SimpleBookmarkTree
    :nodes="bookmarkNodes"
    :searchable="true"
    :highlight-matches="true"
    @search="handleSearch"
  />
</template>

<script setup>
const handleSearch = query => {
  console.log('搜索:', query)
}
</script>
```

### 虚拟滚动

```vue
<template>
  <SimpleBookmarkTree
    :nodes="bookmarkNodes"
    :virtual-enabled="true"
    height="400px"
  />
</template>
```

## 注意事项

- 这是一个复合组件，包含业务逻辑
- 依赖 `SimpleTreeNode` 子组件
- 需要 `BookmarkNode` 类型数据
- 支持大量数据的虚拟滚动
- 自动处理书签的展开/折叠状态
