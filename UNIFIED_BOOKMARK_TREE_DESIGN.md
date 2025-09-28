# 🌳 统一书签目录树组件设计方案

## 🎯 设计目标

创建一个全局统一的书签目录树组件，类似于 `BookmarkSearchBox`，通过配置化实现不同场景的需求。

## 🏗️ 组件架构

```
components/
├── BookmarkTreeView.vue              # 🎯 主组件 (全局统一入口)
├── bookmark-tree/                    
│   ├── index.ts                      # 导出和类型定义
│   ├── BookmarkTreeContainer.vue     # 树容器 (虚拟滚动支持)
│   ├── BookmarkTreeNode.vue          # 树节点 (递归组件)
│   ├── BookmarkFolder.vue            # 文件夹组件
│   ├── BookmarkItem.vue              # 书签项组件
│   ├── BookmarkTreeDragLayer.vue     # 拖拽层
│   ├── composables/
│   │   ├── useBookmarkTree.ts        # 核心树逻辑
│   │   ├── useTreeVirtualization.ts  # 虚拟滚动
│   │   ├── useTreeExpansion.ts       # 展开/收起
│   │   ├── useTreeDragDrop.ts        # 拖拽功能
│   │   ├── useTreeSelection.ts       # 选择功能
│   │   └── useTreeKeyboard.ts        # 键盘导航
│   ├── utils/
│   │   ├── tree-utils.ts             # 树操作工具
│   │   ├── flatten-tree.ts           # 树扁平化 (虚拟滚动用)
│   │   └── tree-search.ts            # 树内搜索
│   └── types/
│       ├── tree-config.ts            # 配置类型
│       ├── tree-events.ts            # 事件类型
│       └── tree-data.ts              # 数据类型
```

## 🔧 主组件 API 设计

### BookmarkTreeView.vue

```vue
<template>
  <div class="bookmark-tree-view" :class="treeViewClasses">
    <BookmarkTreeContainer
      :nodes="processedNodes"
      :config="computedConfig"
      :expanded-folders="expandedFolders"
      :selected-nodes="selectedNodes"
      :virtual-config="virtualConfig"
      @node-click="handleNodeClick"
      @node-double-click="handleNodeDoubleClick"
      @folder-toggle="handleFolderToggle"
      @node-select="handleNodeSelect"
      @nodes-reorder="handleNodesReorder"
      @context-menu="handleContextMenu"
    />
  </div>
</template>

<script setup lang="ts">
// 使用统一的 composable
const {
  processedNodes,
  expandedFolders,
  selectedNodes,
  // ... 其他状态和方法
} = useBookmarkTree(props.nodes, props.config)
</script>
```

### 📋 Props 配置接口

```typescript
interface BookmarkTreeProps {
  // === 数据源 ===
  nodes: BookmarkNode[]                    // 书签数据
  loading?: boolean                        // 加载状态
  
  // === 核心配置 ===
  config?: BookmarkTreeConfig              // 主要配置对象
  
  // === 快捷配置 (常用配置的简化写法) ===
  mode?: 'sidebar' | 'management' | 'picker' | 'readonly'
  size?: 'compact' | 'comfortable' | 'spacious'
  theme?: 'light' | 'dark' | 'auto'
  
  // === 虚拟滚动 ===
  virtual?: boolean | VirtualConfig       // 启用虚拟滚动
  height?: string | number                 // 固定高度 (虚拟滚动必需)
  
  // === 功能开关 ===
  searchable?: boolean                     // 内置搜索
  draggable?: boolean                      // 拖拽功能
  editable?: boolean                       // 编辑功能
  selectable?: boolean | 'single' | 'multiple' // 选择功能
  
  // === UI 配置 ===
  showIcons?: boolean                      // 显示图标
  showCounts?: boolean                     // 显示计数
  showPath?: boolean                       // 显示路径
  indentSize?: number                      // 缩进大小
  
  // === 行为配置 ===
  expandMode?: 'standard' | 'accordion' | 'manual'  // 展开模式
  autoExpand?: boolean                     // 自动展开
  persistState?: boolean                   // 状态持久化
  
  // === 初始状态 ===
  initialExpanded?: string[]               // 初始展开的文件夹
  initialSelected?: string[]               // 初始选中的节点
}

// 详细配置对象
interface BookmarkTreeConfig {
  // 功能特性
  features: {
    search: SearchConfig | boolean
    drag: DragConfig | boolean  
    edit: EditConfig | boolean
    select: SelectConfig | boolean
    virtual: VirtualConfig | boolean
    keyboard: KeyboardConfig | boolean
  }
  
  // UI 外观
  appearance: {
    size: 'compact' | 'comfortable' | 'spacious'
    theme: 'light' | 'dark' | 'auto'
    density: number
    borderless: boolean
    rounded: boolean
  }
  
  // 交互行为
  behavior: {
    expandMode: 'standard' | 'accordion' | 'manual'
    clickToExpand: boolean
    doubleClickToEdit: boolean
    autoCollapse: boolean
    persistState: boolean
    lazyLoad: boolean
  }
  
  // 性能配置
  performance: {
    virtual: VirtualConfig
    debounceMs: number
    throttleMs: number
    cacheSize: number
  }
}
```

### 🎮 事件系统

```typescript
interface BookmarkTreeEvents {
  // 节点事件
  'node-click': (node: BookmarkNode, event: MouseEvent) => void
  'node-double-click': (node: BookmarkNode, event: MouseEvent) => void
  'node-hover': (node: BookmarkNode | null) => void
  'node-context-menu': (node: BookmarkNode, event: MouseEvent) => void
  
  // 文件夹事件
  'folder-toggle': (folderId: string, expanded: boolean) => void
  'folder-expand': (folderId: string) => void
  'folder-collapse': (folderId: string) => void
  
  // 选择事件
  'node-select': (nodeId: string, selected: boolean) => void
  'selection-change': (selectedIds: string[]) => void
  
  // 拖拽事件
  'nodes-reorder': (sourceIds: string[], targetId: string, position: 'before' | 'after' | 'inside') => void
  'drag-start': (dragData: DragData) => void
  'drag-end': (result: DragResult) => void
  
  // 编辑事件
  'node-edit': (node: BookmarkNode) => void
  'node-delete': (node: BookmarkNode) => void
  'node-create': (parentId: string, type: 'folder' | 'bookmark') => void
  
  // 搜索事件
  'search': (query: string) => void
  'search-result': (results: SearchResult[]) => void
  
  // 状态事件
  'ready': () => void
  'loading': (loading: boolean) => void
  'error': (error: Error) => void
}
```

## 🚀 虚拟滚动集成

### VirtualConfig 配置

```typescript
interface VirtualConfig {
  enabled: boolean
  itemHeight: number                     // 单项高度
  buffer: number                         // 缓冲区大小
  threshold: number                      // 启用阈值
  overscan: number                       // 额外渲染项数
  estimatedItemHeight?: number           // 动态高度估算
  getItemHeight?: (item: FlattenedNode) => number  // 自定义高度计算
}

// 默认虚拟配置
const DEFAULT_VIRTUAL_CONFIG: VirtualConfig = {
  enabled: true,
  itemHeight: 32,
  buffer: 5,
  threshold: 100,                        // 超过100项启用虚拟滚动
  overscan: 3
}
```

### 树扁平化处理

```typescript
// composables/useTreeVirtualization.ts
export function useTreeVirtualization(
  nodes: Ref<BookmarkNode[]>,
  expandedFolders: Ref<Set<string>>,
  config: VirtualConfig
) {
  const flattenedNodes = computed(() => {
    if (!config.enabled) return []
    
    return flattenTree(nodes.value, expandedFolders.value, {
      includeHidden: false,
      maxDepth: config.maxDepth,
      filter: config.filter
    })
  })
  
  const visibleRange = ref({ start: 0, end: 0 })
  const containerHeight = ref(0)
  
  const visibleNodes = computed(() => {
    return flattenedNodes.value.slice(
      visibleRange.value.start,
      visibleRange.value.end + config.overscan
    )
  })
  
  return {
    flattenedNodes,
    visibleNodes,
    visibleRange,
    totalHeight: computed(() => flattenedNodes.value.length * config.itemHeight),
    updateVisibleRange,
    scrollToNode,
    scrollToIndex
  }
}
```

## 📱 使用示例

### 1. 侧边栏模式

```vue
<template>
  <BookmarkTreeView
    :nodes="bookmarks"
    mode="sidebar"
    size="compact"
    :virtual="bookmarks.length > 50"
    :config="{
      features: {
        drag: false,
        edit: false,
        select: 'single'
      },
      behavior: {
        expandMode: 'standard',
        clickToExpand: true
      }
    }"
    @node-click="navigateToBookmark"
    @folder-toggle="saveFolderState"
  />
</template>
```

### 2. 管理页面模式

```vue
<template>
  <BookmarkTreeView
    :nodes="bookmarks"
    mode="management"
    size="comfortable"
    :virtual="true"
    height="600px"
    :config="{
      features: {
        drag: true,
        edit: true,
        select: 'multiple',
        search: { placeholder: '搜索书签...', realtime: true }
      },
      behavior: {
        expandMode: 'standard',
        doubleClickToEdit: true,
        persistState: true
      }
    }"
    @nodes-reorder="handleReorder"
    @node-edit="editBookmark"
    @node-delete="deleteBookmark"
    @selection-change="updateSelection"
  />
</template>
```

### 3. 选择器模式

```vue
<template>
  <BookmarkTreeView
    :nodes="bookmarks"
    mode="picker"
    size="compact"
    :virtual="bookmarks.length > 100"
    height="400px"
    :config="{
      features: {
        drag: false,
        edit: false,
        select: 'multiple',
        search: true
      },
      appearance: {
        borderless: true,
        rounded: true
      }
    }"
    @selection-change="updateSelectedBookmarks"
  />
</template>
```

### 4. 高性能虚拟模式

```vue
<template>
  <BookmarkTreeView
    :nodes="massiveBookmarkTree"
    :virtual="{
      enabled: true,
      itemHeight: 28,
      threshold: 50,
      buffer: 10,
      overscan: 5
    }"
    height="100vh"
    :config="{
      performance: {
        debounceMs: 100,
        throttleMs: 16,
        cacheSize: 1000
      }
    }"
  />
</template>
```

## 🔄 实施步骤

### Phase 1: 核心组件创建 (Day 1)
```bash
# 1. 创建目录结构
mkdir -p components/bookmark-tree/{composables,utils,types}

# 2. 核心文件
- BookmarkTreeView.vue           # 主入口组件
- composables/useBookmarkTree.ts # 核心逻辑
- types/tree-config.ts           # 配置类型
```

### Phase 2: 虚拟滚动集成 (Day 1-2)
```bash
# 3. 虚拟滚动相关
- BookmarkTreeContainer.vue      # 虚拟滚动容器
- composables/useTreeVirtualization.ts
- utils/flatten-tree.ts
```

### Phase 3: 功能模块 (Day 2-3)
```bash
# 4. 功能模块
- composables/useTreeExpansion.ts
- composables/useTreeDragDrop.ts
- composables/useTreeSelection.ts
- composables/useTreeKeyboard.ts
```

### Phase 4: 迁移现有组件 (Day 3-4)
```bash
# 5. 逐步替换
- 侧边栏 SidePanel.vue
- 管理页面 Management.vue
- 搜索页面等其他使用场景
```

### Phase 5: 测试和优化 (Day 4-5)
```bash
# 6. 测试和性能优化
- 单元测试
- 性能基准测试
- 大数据集测试 (10K+ 书签)
- 内存使用优化
```

## 🎯 预期收益

### 📊 代码质量
- **-70% 代码重复**: 3套实现 → 1套统一实现
- **+90% 类型安全**: 完整的TypeScript支持
- **+80% 测试覆盖**: 集中测试一套组件

### 🚀 性能提升
- **虚拟滚动**: 支持10K+书签无压力
- **智能缓存**: 减少不必要的重渲染
- **懒加载**: 按需加载节点数据

### 🛠️ 开发效率
- **配置化**: 新场景只需配置，无需开发
- **一致性**: 所有地方行为完全一致
- **维护性**: Bug修复和新功能一处搞定

### 📱 用户体验
- **流畅性**: 虚拟滚动保证大数据集流畅
- **一致性**: 各页面交互体验统一
- **响应性**: 优化的事件处理和状态管理

## 🚧 风险控制

### 渐进式迁移
1. **并行开发**: 新组件与旧组件并存
2. **分步替换**: 逐个页面迁移和测试
3. **回滚机制**: 保留旧组件作为备份
4. **A/B测试**: 部分功能先试点

### 兼容性保证
1. **接口兼容**: 保持现有事件和props
2. **样式兼容**: 支持现有主题系统
3. **功能兼容**: 确保所有现有功能都支持
